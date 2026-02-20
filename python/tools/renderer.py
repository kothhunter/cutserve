#!/usr/bin/env python3
from __future__ import annotations

"""
Headless Renderer - Video Clip Compiler (FFmpeg filter_complex + encode)

Frame-accurate trim and concat with re-encode so cuts are exact and there are
no freezes at boundaries. Uses hardware encoding when available (Video Toolbox
on macOS) for speed; falls back to libx264 with preset fast. MP4 input recommended.

Supports optional score overlay, stat screen, and resolution via --config JSON.

Requires: ffmpeg on PATH (https://ffmpeg.org/download.html)

Usage:
    python tools/renderer.py --video path/to/video.mp4 --clips path/to/clips.json --output path/to/output.mp4
    python tools/renderer.py --video ... --clips ... --output ... --config path/to/export-config.json
"""

import json
import platform
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


# Optional: set by --ffmpeg-dir to use bundled binaries
_ffmpeg_dir: str | None = None


def find_ffmpeg() -> str:
    """Return path to ffmpeg binary. Check bundled dir first, then Homebrew, then PATH."""
    # Bundled ffmpeg (passed via --ffmpeg-dir from Electron in production)
    if _ffmpeg_dir:
        suffix = ".exe" if platform.system() == "Windows" else ""
        bundled = Path(_ffmpeg_dir) / f"ffmpeg{suffix}"
        if bundled.exists():
            return str(bundled)
    # Check Homebrew paths - these typically have full drawtext support
    for candidate in ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"]:
        if Path(candidate).exists():
            return candidate
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError(
            "ffmpeg was not found on your system.\n\n"
            "The export uses ffmpeg to cut and concatenate video.\n\n"
            "Install ffmpeg:\n"
            "  • macOS:  brew install ffmpeg\n"
            "  • Windows:  https://ffmpeg.org/download.html  (add to PATH)\n"
            "  • Linux:  sudo apt install ffmpeg   (or your package manager)"
        )
    return ffmpeg


def find_ffprobe() -> str:
    """Return path to ffprobe (same dir as ffmpeg)."""
    # Bundled ffprobe
    if _ffmpeg_dir:
        suffix = ".exe" if platform.system() == "Windows" else ""
        bundled = Path(_ffmpeg_dir) / f"ffprobe{suffix}"
        if bundled.exists():
            return str(bundled)
    ffmpeg = find_ffmpeg()
    ffprobe = Path(ffmpeg).parent / ("ffprobe.exe" if platform.system() == "Windows" else "ffprobe")
    if not ffprobe.exists():
        return shutil.which("ffprobe") or str(ffprobe)
    return str(ffprobe)


MAX_OUTPUT_FPS = 120

RESOLUTIONS: dict[str, tuple[int, int]] = {
    "720p":  (1280, 720),
    "1080p": (1920, 1080),
    "1440p": (2560, 1440),
    "4k":    (3840, 2160),
}


def get_video_fps(video_path: Path, ffprobe: str) -> float:
    """Return the frame rate of the first video stream, capped at MAX_OUTPUT_FPS."""
    result = subprocess.run(
        [ffprobe, "-v", "quiet", "-select_streams", "v:0",
         "-print_format", "json", "-show_streams", str(video_path)],
        capture_output=True, text=True,
    )
    if result.returncode == 0:
        data = json.loads(result.stdout)
        for s in data.get("streams", []):
            # r_frame_rate is like "30/1" or "30000/1001"
            rfr = s.get("r_frame_rate", "")
            if "/" in rfr:
                num, den = rfr.split("/", 1)
                try:
                    source_fps = float(num) / float(den)
                    if source_fps > 0:
                        return round(min(source_fps, MAX_OUTPUT_FPS), 3)
                except (ValueError, ZeroDivisionError):
                    pass
    return 30.0


def get_video_resolution(video_path: Path, ffprobe: str) -> tuple[int, int]:
    """Return (width, height) of the first video stream."""
    result = subprocess.run(
        [ffprobe, "-v", "quiet", "-select_streams", "v:0",
         "-print_format", "json", "-show_streams", str(video_path)],
        capture_output=True, text=True,
    )
    if result.returncode == 0:
        data = json.loads(result.stdout)
        for s in data.get("streams", []):
            w = s.get("width")
            h = s.get("height")
            if w and h:
                return (int(w), int(h))
    return (1920, 1080)


def has_audio_stream(video_path: Path, ffprobe: str) -> bool:
    """Return True if the file has at least one audio stream."""
    result = subprocess.run(
        [ffprobe, "-v", "quiet", "-print_format", "json", "-show_streams", str(video_path)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return False
    data = json.loads(result.stdout)
    return any(s.get("codec_type") == "audio" for s in data.get("streams", []))


def load_clips(data_path: Path) -> list:
    """Load and filter clips from JSON (exclude trash, keep only kept clips)."""
    with open(data_path, "r") as f:
        data = json.load(f)
    clips = data.get("clips", [])
    filtered = [
        c for c in clips
        if c.get("keep", True) is not False and c.get("status") != "trash"
    ]
    print(f"Loaded {len(filtered)} clips (filtered from {len(clips)} total)")
    return filtered


def run_ffmpeg(cmd: list[str]) -> tuple[bool, str]:
    """Run an ffmpeg command. Return (success, stderr_text)."""
    result = subprocess.run(cmd, capture_output=True, text=True)
    err = (result.stderr or result.stdout or "").strip()
    return (result.returncode == 0, err)


def escape_drawtext(s: str) -> str:
    """Escape special characters for FFmpeg drawtext filter."""
    s = str(s).replace("\n", " ").replace("\r", "").replace("\x00", "")
    for old, new in [("\\", "\\\\"), ("'", "\\'"), (":", "\\:"), ("%", "\\%"), ('"', '\\"')]:
        s = s.replace(old, new)
    return s


def get_default_font_path() -> str | None:
    """Return a system font path for drawtext, or None to use FFmpeg default."""
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial.ttf",  # macOS
        "/Library/Fonts/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",  # Linux
        "C:\\Windows\\Fonts\\arial.ttf",  # Windows
    ]
    for p in candidates:
        if Path(p).exists():
            return p
    return None


def get_default_bold_font_path() -> str | None:
    """Return a bold system font path for drawtext (score text)."""
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",  # macOS
        "/Library/Fonts/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",  # Linux
        "C:\\Windows\\Fonts\\arialbd.ttf",  # Windows
    ]
    for p in candidates:
        if Path(p).exists():
            return p
    return get_default_font_path()  # Fallback to regular


def get_clip_state(match_flow: dict, clip: dict) -> tuple[int, int]:
    """Get team1Score, team2Score for a clip from match flow."""
    clip_id = str(clip.get("id", 0))
    state = match_flow.get(clip_id, {})
    if isinstance(state, dict):
        return (int(state.get("team1Score", 0)), int(state.get("team2Score", 0)))
    return (0, 0)


def _build_drawtext_filters(
    tc: dict,
    s1: int,
    s2: int,
    team1_name: str,
    team2_name: str,
    include_names: bool,
    font_path: str | None = None,
    scale_x: float = 1.0,
    scale_y: float = 1.0,
    score_font_path: str | None = None,
    name_font_path: str | None = None,
) -> str:
    """Build comma-separated drawtext filter chain (scores, optionally team names).
    scale_x, scale_y: multiply coords/font for 720p (e.g. 1280/1920, 720/1080).
    score_font_path, name_font_path: absolute paths to bundled TTF files from config.
    """
    # Use config-provided font paths if available, fall back to system fonts
    score_font = score_font_path or get_default_bold_font_path() or get_default_font_path()
    name_font = name_font_path or font_path or get_default_font_path()
    score_font_esc = score_font.replace("\\", "\\\\").replace(":", "\\:") if score_font else ""
    name_font_esc = name_font.replace("\\", "\\\\").replace(":", "\\:") if name_font else ""
    score_font_opt = f"fontfile='{score_font_esc}':" if score_font_esc else ""
    name_font_opt = f"fontfile='{name_font_esc}':" if name_font_esc else ""

    def _scale(v: float, s: float) -> int:
        return int(round(v * s))

    # Preview uses transform: translate(-50%, -50%) so text is CENTERED on (x,y).
    # FFmpeg drawtext uses top-left by default, so use x='cx-text_w/2':y='cy-text_h/2' to match.
    parts = []
    cx1 = _scale(tc.get("score1", {}).get("x", 400), scale_x)
    cy1 = _scale(tc.get("score1", {}).get("y", 80), scale_y)
    c1 = tc.get("score1", {}).get("color", "#ffffff").replace("#", "0x")
    fs = _scale(tc.get("fontSize", 64), scale_y)
    parts.append(f"drawtext={score_font_opt}text='{escape_drawtext(str(s1))}':fontcolor={c1}:fontsize={fs}:x='{cx1}-text_w/2':y='{cy1}-text_h/2'")

    cx2 = _scale(tc.get("score2", {}).get("x", 1400), scale_x)
    cy2 = _scale(tc.get("score2", {}).get("y", 80), scale_y)
    c2 = tc.get("score2", {}).get("color", "#ffffff").replace("#", "0x")
    parts.append(f"drawtext={score_font_opt}text='{escape_drawtext(str(s2))}':fontcolor={c2}:fontsize={fs}:x='{cx2}-text_w/2':y='{cy2}-text_h/2'")

    if include_names:
        # Name positions: same center convention as preview (translate -50%, -50%)
        cxn1 = _scale(tc.get("name1", {}).get("x", 200), scale_x)
        cyn1 = _scale(tc.get("name1", {}).get("y", 60), scale_y)
        cn1 = tc.get("name1", {}).get("color", "#e2e8f0").replace("#", "0x")
        fs1 = _scale(tc.get("name1", {}).get("fontSize", 65), scale_y)
        parts.append(f"drawtext={name_font_opt}text='{escape_drawtext(team1_name)}':fontcolor={cn1}:fontsize={fs1}:x='{cxn1}-text_w/2':y='{cyn1}-text_h/2'")
        cxn2 = _scale(tc.get("name2", {}).get("x", 1500), scale_x)
        cyn2 = _scale(tc.get("name2", {}).get("y", 60), scale_y)
        cn2 = tc.get("name2", {}).get("color", "#e2e8f0").replace("#", "0x")
        fs2 = _scale(tc.get("name2", {}).get("fontSize", 65), scale_y)
        parts.append(f"drawtext={name_font_opt}text='{escape_drawtext(team2_name)}':fontcolor={cn2}:fontsize={fs2}:x='{cxn2}-text_w/2':y='{cyn2}-text_h/2'")

    return ",".join(parts)


def _run_encode(
    ffmpeg: str,
    inputs: list[str],
    filter_complex: str,
    output_path: Path,
    has_audio: bool,
    fps: float = 30.0,
    resolution: tuple[int, int] = (1920, 1080),
) -> tuple[bool, str]:
    """Run ffmpeg encode with given inputs and filter_complex."""
    on_mac = platform.system() == "Darwin"
    out_w, out_h = resolution
    # Scale VideoToolbox bitrate by resolution and fps relative to 1080p30 baseline
    pixel_ratio = (out_w * out_h) / (1920 * 1080)
    fps_ratio = min(fps / 30.0, 2.0)
    vt_bitrate = f"{max(10, int(15 * pixel_ratio * fps_ratio))}M"
    encoders_to_try = []
    if on_mac:
        encoders_to_try.append(("h264_videotoolbox", ["-c:v", "h264_videotoolbox", "-b:v", vt_bitrate]))
    encoders_to_try.append(("libx264", ["-c:v", "libx264", "-preset", "fast", "-crf", "23"]))

    fps_str = str(fps)
    last_err = ""
    for name, video_codec_args in encoders_to_try:
        cmd = [ffmpeg, "-y"]
        for inp in inputs:
            cmd.extend(["-i", inp])
        cmd.extend(["-filter_complex", filter_complex, "-map", "[outv]", "-map", "[outa]"])
        cmd.extend(video_codec_args)
        cmd.extend(["-r", fps_str, "-c:a", "aac", "-b:a", "192k", "-map_metadata", "-1", "-movflags", "+faststart", str(output_path)])
        ok, err = run_ffmpeg(cmd)
        if ok:
            return True, err
        last_err = err
        # Try next encoder only if this one is unavailable
        if "Unknown encoder" in err or "videotoolbox" in err.lower() or "not found" in err.lower():
            continue
        return False, err
    return False, f"No suitable encoder found. Last error:\n{last_err}"


def _run_fast_copy(
    ffmpeg: str,
    video_path: Path,
    clips: list,
    output_path: Path,
) -> None:
    """Fast-path: stream-copy video, re-encode audio for precise A/V sync.
    Cuts land on the nearest keyframe, so clips may start a fraction of a second early.
    Audio is re-encoded (trivially fast) to avoid desync from misaligned packet boundaries.
    """
    n = len(clips)
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        segment_paths: list[Path] = []
        for i, clip in enumerate(clips):
            start = round(float(clip["start"]), 3)
            end = round(float(clip["end"]), 3)
            seg = tmp / f"seg_{i:04d}.mp4"
            cmd = [
                ffmpeg, "-y",
                "-ss", str(start), "-to", str(end),
                "-i", str(video_path),
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                "-avoid_negative_ts", "make_zero",
                "-map_metadata", "-1",
                "-movflags", "+faststart",
                str(seg),
            ]
            ok, err = run_ffmpeg(cmd)
            if not ok:
                raise RuntimeError(f"Fast copy segment {i+1}/{n} failed.\n{err}")
            segment_paths.append(seg)
            print(f"  Segment {i+1}/{n} extracted")

        # Concat all segments
        concat_file = tmp / "concat.txt"
        with open(concat_file, "w") as f:
            for seg in segment_paths:
                f.write(f"file '{seg}'\n")

        cmd = [
            ffmpeg, "-y",
            "-f", "concat", "-safe", "0",
            "-i", str(concat_file),
            "-c", "copy", "-movflags", "+faststart",
            str(output_path),
        ]
        ok, err = run_ffmpeg(cmd)
        if not ok:
            raise RuntimeError(f"Fast copy concat failed.\n{err}")


def render_highlights(
    video_path: Path,
    clips: list,
    output_path: Path,
    config: dict | None = None,
) -> None:
    """
    Frame-accurate trim + concat with encode. No freezes at cuts; A/V in sync.
    Optional overlay and stat screen via config.
    """
    if not video_path.exists():
        raise FileNotFoundError(f"Video file not found: {video_path}")

    if len(clips) == 0:
        print("WARNING: No clips to render.")
        return

    ffmpeg = find_ffmpeg()
    ffprobe = find_ffprobe()
    video_abs = video_path.resolve()
    output_abs = output_path.resolve()
    has_audio = has_audio_stream(video_abs, ffprobe)
    fps = get_video_fps(video_abs, ffprobe)
    print(f"Source video frame rate: {fps} fps")

    cfg = config or {}
    show_overlay = cfg.get("showOverlay", False)
    overlay_path = cfg.get("overlayPath")
    text_config = cfg.get("textConfig", {})
    team1_name = cfg.get("team1Name", "Team 1")
    team2_name = cfg.get("team2Name", "Team 2")
    include_names = cfg.get("includeNames", False)
    match_flow = cfg.get("matchFlow", {})
    show_stat = cfg.get("showStatScreen", False)
    stat_path = cfg.get("statScreenPath")
    stat_duration = float(cfg.get("statDuration", 10))
    resolution = cfg.get("resolution", "1080p")
    fps_config = cfg.get("fps", "source")
    logo_config = cfg.get("logoConfig", {})
    team1_logo_path = cfg.get("team1LogoPath")
    team2_logo_path = cfg.get("team2LogoPath")
    score_font_path = cfg.get("scoreFontPath")
    name_font_path = cfg.get("nameFontPath")

    n = len(clips)
    total_clip_duration = sum(float(c["end"]) - float(c["start"]) for c in clips)
    w, h = RESOLUTIONS.get(resolution, (1920, 1080))
    # Scale factor for overlay coords (defined in 1920x1080 space)
    scale_x = w / 1920
    scale_y = h / 1080
    # Always apply scale+pad when output resolution differs from source
    source_w, source_h = get_video_resolution(video_abs, ffprobe)
    needs_scale = (source_w != w or source_h != h)
    scale = f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2," if needs_scale else ""

    # Determine output FPS based on config
    source_fps = fps  # already probed above
    if fps_config == "source":
        fps = source_fps
    else:
        try:
            requested_fps = float(fps_config)
            # Don't interpolate: cap at source fps
            fps = min(requested_fps, source_fps)
        except (ValueError, TypeError):
            pass  # keep source fps
    fps = round(min(fps, MAX_OUTPUT_FPS), 3)
    print(f"Output frame rate: {fps} fps (config: {fps_config})")

    has_overlay_img = show_overlay and overlay_path and Path(overlay_path).exists()
    has_drawtext = show_overlay and text_config
    has_stat = show_stat and stat_path and Path(stat_path).exists()
    if show_stat and not has_stat:
        print(f"Note: Stat screen requested but path missing/invalid: {stat_path}")
    elif has_stat:
        print(f"Stat screen enabled: {stat_path} ({stat_duration}s)")

    use_drawtext = has_drawtext
    if use_drawtext:
        print(f"Using ffmpeg: {ffmpeg} (drawtext enabled)")

    has_logo1 = bool(team1_logo_path and Path(team1_logo_path).exists())
    has_logo2 = bool(team2_logo_path and Path(team2_logo_path).exists())
    logo1_cfg = logo_config.get("logo1", {})
    logo2_cfg = logo_config.get("logo2", {})

    inputs = [str(video_abs)]
    if has_overlay_img:
        inputs.append(str(Path(overlay_path).resolve()))
    overlay_idx = 1 if has_overlay_img else -1
    next_idx = len(inputs)
    logo1_idx = next_idx if has_logo1 else -1
    if has_logo1:
        inputs.append(str(Path(team1_logo_path).resolve()))
        next_idx += 1
    logo2_idx = next_idx if has_logo2 else -1
    if has_logo2:
        inputs.append(str(Path(team2_logo_path).resolve()))

    def build_filter(use_dt: bool):
        parts = []
        for i, clip in enumerate(clips):
            start = round(float(clip["start"]), 3)
            end = round(float(clip["end"]), 3)
            dur = round(end - start, 3)
            # Trim video segment (fps filter normalises high-fps sources like 120fps)
            trim = f"[0:v]trim=start={start}:end={end},setpts=PTS-STARTPTS,fps={fps}"
            if scale:
                trim += f",{scale.rstrip(',')}"
            trim += f"[vb{i}]"
            parts.append(trim)

            if has_overlay_img:
                parts.append(
                    f"[{overlay_idx}:v]scale={w}:{h},loop=-1:1,trim=duration={dur},setpts=PTS-STARTPTS,fps={fps}[ov{i}]"
                )
                parts.append(f"[vb{i}][ov{i}]overlay=0:0[vo{i}]")
                last_label = f"[vo{i}]"
            else:
                last_label = f"[vb{i}]"

            # Overlay logos - preview uses translate(-50%,-50%) so (x,y) is CENTER. Overlay uses top-left.
            if has_logo1:
                cx = logo1_cfg.get("x", 0) * scale_x
                cy = logo1_cfg.get("y", 0) * scale_y
                lw = int(round(logo1_cfg.get("width", 110) * scale_x))
                lh = int(round(logo1_cfg.get("height", 110) * scale_y))
                lx = int(round(cx - lw / 2))
                ly = int(round(cy - lh / 2))
                parts.append(
                    f"[{logo1_idx}:v]scale={lw}:{lh},loop=-1:1,trim=duration={dur},setpts=PTS-STARTPTS,fps={fps}[lg1{i}]"
                )
                parts.append(f"{last_label}[lg1{i}]overlay={lx}:{ly}[vl1{i}]")
                last_label = f"[vl1{i}]"
            if has_logo2:
                cx = logo2_cfg.get("x", 0) * scale_x
                cy = logo2_cfg.get("y", 0) * scale_y
                lw = int(round(logo2_cfg.get("width", 110) * scale_x))
                lh = int(round(logo2_cfg.get("height", 110) * scale_y))
                lx = int(round(cx - lw / 2))
                ly = int(round(cy - lh / 2))
                parts.append(
                    f"[{logo2_idx}:v]scale={lw}:{lh},loop=-1:1,trim=duration={dur},setpts=PTS-STARTPTS,fps={fps}[lg2{i}]"
                )
                parts.append(f"{last_label}[lg2{i}]overlay={lx}:{ly}[vl2{i}]")
                last_label = f"[vl2{i}]"

            if use_dt:
                s1, s2 = get_clip_state(match_flow, clip)
                dt = _build_drawtext_filters(
                    text_config, s1, s2, team1_name, team2_name, include_names,
                    scale_x=scale_x, scale_y=scale_y,
                    score_font_path=score_font_path, name_font_path=name_font_path,
                )
                # No comma after last_label - [vo0],drawtext creates empty filter '' before drawtext
                parts.append(f"{last_label}{dt}[v{i}]")
            else:
                # No comma: [label]filter[out] is valid; comma would create empty filter
                parts.append(f"{last_label}format=pix_fmts=yuv420p[v{i}]")

            if has_audio:
                parts.append(f"[0:a]atrim=start={start}:end={end},asetpts=PTS-STARTPTS[a{i}]")

        # Concat expects interleaved [v0][a0][v1][a1]... for n segments
        if has_audio:
            concat_in = "".join(f"[v{i}][a{i}]" for i in range(n))
            parts.append(f"{concat_in}concat=n={n}:v=1:a=1[outv][outa]")
        else:
            concat_v = "".join(f"[v{i}]" for i in range(n))
            parts.append(f"{concat_v}concat=n={n}:v=1:a=0[outv]")
            parts.append(f"anullsrc=r=44100:cl=stereo,duration={total_clip_duration}[outa]")
        return ";".join(parts)

    # Fast-path: stream copy when no overlays/text/stat/logos and no resolution change
    # Stream copy can't change fps, so force re-encode if user picked a specific fps
    fps_needs_reencode = (fps_config != "source" and fps != source_fps)
    needs_reencode = (
        has_overlay_img or use_drawtext or has_stat
        or has_logo1 or has_logo2 or needs_scale
        or fps_needs_reencode
    )
    if not needs_reencode:
        print("Fast-path export: stream copy (no re-encoding)")
        for i, clip in enumerate(clips):
            tag = clip.get("tag", "Unknown")
            print(f"Clip {i + 1}/{n}: {round(float(clip['start']), 1):.1f}s -> {round(float(clip['end']), 1):.1f}s [{tag}]")
        _run_fast_copy(ffmpeg, video_abs, clips, output_abs)
        print(f"\n✓ Successfully rendered (fast copy): {output_abs}")
        print(f"  Total duration: ~{total_clip_duration:.1f}s")
        return

    for i, clip in enumerate(clips):
        tag = clip.get("tag", "Unknown")
        print(f"Clip {i + 1}/{n}: {round(float(clip['start']), 1):.1f}s -> {round(float(clip['end']), 1):.1f}s [{tag}]")

    filter_complex = build_filter(use_drawtext)

    def try_encode(out_path: Path) -> tuple[bool, str]:
        return _run_encode(ffmpeg, inputs, filter_complex, out_path, has_audio, fps, (w, h))

    if has_stat:
        # Two-pass: render clips first, then concat with stat screen
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            temp_mp4 = Path(tmp.name)
        try:
            ok, err = try_encode(temp_mp4)
            if not ok:
                print("--- FFmpeg encode error (full stderr) ---")
                print(err)
                print("--- end stderr ---")
                print("--- filter_complex (first 1200 chars) ---")
                print(filter_complex[:1200] + ("..." if len(filter_complex) > 1200 else ""))
                print("--- end filter_complex ---")
                print("Manual drawtext test: ffmpeg -f lavfi -i color=c=black:s=1280x720:d=2 -vf \"drawtext=text='Test':fontsize=48:x=100:y=100:fontcolor=white\" -t 2 -y /tmp/drawtext_test.mp4")
            if not ok and use_drawtext and "No such filter" in err:
                print("Note: FFmpeg lacks drawtext (needs libfreetype). Exporting without score text.")
                filter_complex = build_filter(False)
                ok, err = _run_encode(ffmpeg, inputs, filter_complex, temp_mp4, has_audio, fps, (w, h))
            if not ok:
                raise RuntimeError(f"Encode failed.\nffmpeg stderr:\n{err}\n\nFilter (first 500 chars): {filter_complex[:500]}{'...' if len(filter_complex) > 500 else ''}")

            # Create stat screen video from image
            stat_abs = Path(stat_path).resolve()
            with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp2:
                stat_mp4 = Path(tmp2.name)
            try:
                # Force stat screen to exact duration (loop image + trim, and -t to be sure)
                stat_dur_str = str(stat_duration)
                stat_filter = f"loop=-1:1,trim=duration={stat_dur_str},setpts=PTS-STARTPTS"
                # Always scale stat screen to match output resolution
                stat_filter = f"scale={w}:{h}," + stat_filter
                fps_str = str(fps)
                stat_cmd = [
                    ffmpeg, "-y", "-loop", "1", "-r", fps_str, "-i", str(stat_abs),
                    "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=stereo:d={stat_dur_str}",
                    "-vf", stat_filter, "-map", "0:v", "-map", "1:a",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", fps_str,
                    "-c:a", "aac", "-b:a", "192k",
                    "-t", stat_dur_str,
                    "-movflags", "+faststart", str(stat_mp4)
                ]
                ok, err = run_ffmpeg(stat_cmd)
                if not ok:
                    raise RuntimeError(f"Stat screen encode failed.\n{err}")

                # Concat clips + stat screen
                concat_list = tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False)
                concat_list.write(f"file '{temp_mp4.resolve()}'\n")
                concat_list.write(f"file '{stat_mp4.resolve()}'\n")
                concat_list.close()

                concat_cmd = [
                    ffmpeg, "-y", "-f", "concat", "-safe", "0",
                    "-i", concat_list.name,
                    "-c", "copy", str(output_abs)
                ]
                ok, err = run_ffmpeg(concat_cmd)
                Path(concat_list.name).unlink(missing_ok=True)
                if not ok:
                    raise RuntimeError(f"Concat failed.\n{err}")
            finally:
                stat_mp4.unlink(missing_ok=True)
        finally:
            temp_mp4.unlink(missing_ok=True)
    else:
        ok, err = _run_encode(ffmpeg, inputs, filter_complex, output_abs, has_audio, fps, (w, h))
        if not ok:
            print("--- FFmpeg encode error (full stderr) ---")
            print(err)
            print("--- end stderr ---")
            print("--- filter_complex (first 1200 chars) ---")
            print(filter_complex[:1200] + ("..." if len(filter_complex) > 1200 else ""))
            print("--- end filter_complex ---")
            print("Manual drawtext test: ffmpeg -f lavfi -i color=c=black:s=1280x720:d=2 -vf \"drawtext=text='Test':fontsize=48:x=100:y=100:fontcolor=white\" -t 2 -y /tmp/drawtext_test.mp4")
        if not ok and use_drawtext and "No such filter" in err:
            print("Note: FFmpeg lacks drawtext (needs libfreetype). Exporting without score text.")
            filter_complex = build_filter(False)
            ok, err = _run_encode(ffmpeg, inputs, filter_complex, output_abs, has_audio, fps, (w, h))
        if not ok:
            raise RuntimeError(f"Encode failed.\nffmpeg stderr:\n{err}\n\nFilter (first 500 chars): {filter_complex[:500]}{'...' if len(filter_complex) > 500 else ''}")

    total_dur = total_clip_duration + (stat_duration if has_stat else 0)
    print(f"\n✓ Successfully rendered: {output_abs}")
    print(f"  Total duration: {total_dur:.1f}s")


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Render condensed highlight video (frame-accurate, MP4)"
    )
    parser.add_argument("--video", required=True, help="Path to source video (MP4 recommended)")
    parser.add_argument("--clips", required=True, help="Path to clips JSON")
    parser.add_argument("--output", required=True, help="Path to output MP4")
    parser.add_argument("--config", help="Path to export config JSON (optional)")
    parser.add_argument("--ffmpeg-dir", help="Directory containing bundled ffmpeg/ffprobe binaries")
    args = parser.parse_args()

    global _ffmpeg_dir
    if args.ffmpeg_dir:
        _ffmpeg_dir = args.ffmpeg_dir

    video_path = Path(args.video)
    data_path = Path(args.clips)
    output_path = Path(args.output)
    config = None
    if args.config and Path(args.config).exists():
        with open(args.config, "r") as f:
            config = json.load(f)

    if not video_path.exists():
        print(f"ERROR: Video file not found: {video_path}", file=sys.stderr)
        sys.exit(1)
    if not data_path.exists():
        print(f"ERROR: Clips file not found: {data_path}", file=sys.stderr)
        sys.exit(1)

    try:
        clips = load_clips(data_path)
    except Exception as e:
        print(f"ERROR: Failed to load clips: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        find_ffmpeg()
    except RuntimeError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        render_highlights(video_path, clips, output_path, config)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
