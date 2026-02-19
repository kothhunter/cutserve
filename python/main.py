#!/usr/bin/env python3
"""
Roundnet Condenser - Automatic Rally Detection Engine

Ingests a long video file and outputs a JSON file of detected clips
(Rallies/Serves) with precise start/end times.

Usage:
    python main.py video.mp4                    # Basic usage
    python main.py video.mp4 -o clips.json      # Custom output
    python main.py video.mp4 --preview          # Show debug overlay
    python main.py video.mp4 --fast             # Fast mode (lower accuracy)

Output Format (clips.json):
    {
        "video": "game.mp4",
        "fps": 30.0,
        "duration": 3600.0,
        "clips": [
            {"start": 10.5, "end": 25.3, "duration": 14.8, "tag": "Rally", "confidence": "High", "peak_energy": 95},
            ...
        ]
    }
"""

import argparse
import json
import sys
import time
import cv2
from pathlib import Path
from datetime import datetime

from core import Config, PoseDetector, EnergyCalculator, StateMachine, ZoneManager
from tools.visualizer import Visualizer


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Automatic rally detection for Roundnet/Spikeball videos",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s game.mp4
      Process video with default settings, output to clips.json

  %(prog)s game.mp4 -z custom_zones.json -o my_clips.json
      Use custom zone file and output path

  %(prog)s game.mp4 --preview --debug
      Show preview window with debug overlay

  %(prog)s game.mp4 --fast
      Process faster (skips more frames, lower accuracy)

Workflow:
  1. First, draw zones: python -m tools.zone_wizard_poly video.mp4
  2. Then process: python main.py video.mp4
  3. Review clips.json output
        """
    )
    
    # Required arguments
    parser.add_argument(
        "video",
        help="Path to input video file"
    )
    
    # File options
    parser.add_argument(
        "-z", "--zones",
        default="court_zones.json",
        help="Path to zones JSON file (default: court_zones.json)"
    )
    parser.add_argument(
        "-o", "--output",
        default="clips.json",
        help="Output JSON file path (default: clips.json)"
    )
    parser.add_argument(
        "-m", "--model",
        default="yolov8n-pose.pt",
        help="Path to YOLO pose model (default: yolov8n-pose.pt)"
    )
    
    # Processing options
    parser.add_argument(
        "--fast",
        action="store_true",
        help="Fast processing mode (skip more frames, lower accuracy)"
    )
    parser.add_argument(
        "--width",
        type=int,
        default=640,
        help="Processing width for AI inference (default: 640)"
    )
    parser.add_argument(
        "--skip",
        type=int,
        default=2,
        help="Frames to skip between processing (default: 2)"
    )
    parser.add_argument(
        "--batch",
        type=int,
        default=4,
        help="Inference batch size for GPU throughput (default: 4)"
    )

    # Visualization options
    parser.add_argument(
        "--preview",
        action="store_true",
        help="Show preview window during processing (press 'q' to quit)"
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug output"
    )
    parser.add_argument(
        "-q", "--quiet",
        action="store_true",
        help="Suppress all output except errors"
    )
    
    # Tuning options (advanced)
    # Note: Defaults come from config.py. These only override if explicitly provided.
    parser.add_argument(
        "--pre-buffer",
        type=float,
        default=None,
        help="Seconds before serve to include (default: from config.py)"
    )
    parser.add_argument(
        "--post-buffer",
        type=float,
        default=None,
        help="Seconds after point to include (default: from config.py)"
    )
    parser.add_argument(
        "--min-zones",
        type=int,
        default=2,
        help="Minimum occupied zones to detect serve (default: 2)"
    )
    
    return parser.parse_args()


def create_config(args) -> Config:
    """Create configuration from command line arguments.
    
    Config.py is the source of truth. Command-line arguments only override
    if explicitly provided (not None).
    """
    # Get defaults from Config class
    config_defaults = Config()
    
    config = Config(
        video_path=args.video,
        zones_file=args.zones,
        output_json=args.output,
        model_path=args.model,
        process_width=args.width,
        skip_frames=args.skip if not args.fast else 4,
        inference_batch_size=args.batch,
        # Use config.py defaults unless explicitly overridden via CLI
        pre_serve_buffer=args.pre_buffer if args.pre_buffer is not None else config_defaults.pre_serve_buffer,
        post_point_buffer=args.post_buffer if args.post_buffer is not None else config_defaults.post_point_buffer,
        min_occupied_zones=args.min_zones,
        show_visuals=args.preview,
        debug_mode=args.debug and not args.quiet
    )
    return config


def process_video(config: Config) -> dict:
    """
    Main video processing pipeline.
    
    Args:
        config: Configuration object
        
    Returns:
        Dictionary with processing results for JSON output
    """
    # Initialize components
    detector = PoseDetector(config)
    energy_calc = EnergyCalculator(config)
    zone_mgr = ZoneManager(config)
    visualizer = Visualizer(config) if config.show_visuals else None
    
    # Load model and zones
    detector.load_model()
    zone_mgr.load_zones(config.zones_file)
    
    # Open video
    cap = cv2.VideoCapture(config.video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {config.video_path}")
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    original_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    original_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = total_frames / fps if fps > 0 else 0
    
    # Calculate scale factor
    scale_factor = config.process_width / original_width
    new_height = int(original_height * scale_factor)
    
    # Scale zones and configure energy calculator
    zone_mgr.scale_zones(original_width, config.process_width)
    energy_calc.set_scale_factor(scale_factor)
    
    # Fixed-FPS processing: sample at process_fps so energy is comparable across source FPS.
    # logic_step = video frames between each processed frame (e.g. 120fps @ 30 → every 4th; then skip_frames on top).
    logic_step = max(1, round(fps * (config.skip_frames + 1) / config.process_fps))
    effective_logic_fps = config.process_fps / (config.skip_frames + 1)
    
    # Initialize state machine
    state_machine = StateMachine(config, fps)
    
    if config.debug_mode:
        print(f"\n{'='*60}")
        print(f"⚡ ROUNDNET CONDENSER")
        print(f"{'='*60}")
        print(f"   Video: {config.video_path}")
        print(f"   Resolution: {original_width}x{original_height} → {config.process_width}x{new_height}")
        print(f"   Duration: {duration:.1f}s ({total_frames} frames @ {fps:.1f} FPS)")
        print(f"   Process FPS: {config.process_fps} (every {logic_step} frames → ~{effective_logic_fps:.1f} logic/s)")
        print(f"   Batch size: {config.inference_batch_size}")
        print(f"   Device: {detector.get_device().upper()}")
        print(f"   Zones: {len(zone_mgr.zones)}")
        print(f"{'='*60}\n")

    start_time = time.time()
    frame_idx = 0
    batch_size = config.inference_batch_size
    batch: list = []  # (frame_idx, timestamp, small_frame)

    # Main processing loop
    while True:
        ret, frame = cap.read()

        if ret:
            frame_idx += 1

            # Skip frames for speed (process 1, skip N)
            if frame_idx % logic_step != 0:
                continue

            timestamp = frame_idx / fps
            small_frame = cv2.resize(frame, (config.process_width, new_height))
            batch.append((frame_idx, timestamp, small_frame))

        # Process batch when full, or when at end of video with a partial batch
        if len(batch) >= batch_size or (not ret and batch):
            frames = [item[2] for item in batch]
            detections = detector.detect_batch(frames)

            user_quit = False
            for (fi, ts, sf), detection in zip(batch, detections):
                zone_status = zone_mgr.check_occupancy(detection.ankles)
                raw_energy = energy_calc.calculate(detection.skeletons)
                smooth_energy = energy_calc.update_smooth(raw_energy)

                state_machine.update(
                    timestamp=ts,
                    active_zones=zone_status.active_count,
                    smooth_energy=smooth_energy,
                    num_skeletons=len(detection.skeletons),
                    logic_step=logic_step
                )

                # Visualization (debug overlay)
                if config.show_visuals and visualizer:
                    display = visualizer.draw_full_overlay(
                        sf,
                        zone_mgr.scaled_zones,
                        zone_status.occupancy,
                        detection.raw_keypoints,
                        smooth_energy,
                        state_machine.get_threshold(),
                        state_machine.get_state_name(),
                        ts
                    )
                    cv2.imshow("Roundnet Condenser", display)
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        user_quit = True
                        if config.debug_mode:
                            print("\n⚠️ Processing interrupted by user")
                        break

                # Progress indicator — print every 100 frames so the UI stays responsive
                if fi % 100 == 0:
                    elapsed = time.time() - start_time
                    fps_proc = fi / elapsed if elapsed > 0 else 0
                    percent = (fi / total_frames) * 100
                    print(f"   [{percent:5.1f}%] Frame {fi}/{total_frames} ({fps_proc:.1f} FPS)", flush=True)

            batch.clear()

            if user_quit:
                break

        if not ret:
            break
    
    cap.release()
    if config.show_visuals:
        cv2.destroyAllWindows()
    
    # Get results
    clips = state_machine.get_clips()
    elapsed_total = time.time() - start_time
    
    if config.debug_mode:
        print(f"\n{'='*60}")
        print(f"✅ PROCESSING COMPLETE")
        print(f"   Time: {elapsed_total:.1f}s ({total_frames/elapsed_total:.1f} FPS)")
        print(f"   Clips detected: {len(clips)}")
        print(f"{'='*60}\n")
    
    # Build output structure
    result = {
        "video": str(Path(config.video_path).name),
        "video_path": str(Path(config.video_path).absolute()),
        "fps": round(fps, 2),
        "duration": round(duration, 2),
        "resolution": {
            "original": f"{original_width}x{original_height}",
            "processed": f"{config.process_width}x{new_height}"
        },
        "zones_file": config.zones_file,
        "processed_at": datetime.now().isoformat(),
        "processing_time_seconds": round(elapsed_total, 2),
        "clips": [clip.to_dict() for clip in clips]
    }
    
    return result


def main():
    """Main entry point."""
    args = parse_args()
    
    # Validate input file exists
    if not Path(args.video).exists():
        print(f"❌ Error: Video file not found: {args.video}", file=sys.stderr)
        sys.exit(1)
    
    if not Path(args.zones).exists():
        print(f"❌ Error: Zones file not found: {args.zones}", file=sys.stderr)
        print(f"   Run zone setup first: python -m tools.zone_wizard_poly {args.video}")
        sys.exit(1)
    
    # Create config and run
    config = create_config(args)
    
    try:
        result = process_video(config)
        
        # Save JSON output
        with open(config.output_json, 'w') as f:
            json.dump(result, f, indent=2)
        
        num_clips = len(result['clips'])
        
        if config.debug_mode:
            print(f"💾 Saved {num_clips} clips to {config.output_json}")
            
            if num_clips > 0:
                print("\nClip Summary:")
                print("-" * 70)
                print(f"{'#':<4} {'Start':<10} {'End':<10} {'Duration':<10} {'Tag':<10} {'Energy':<10}")
                print("-" * 70)
                for i, clip in enumerate(result['clips'], 1):
                    print(f"{i:<4} {clip['start']:<10.1f} {clip['end']:<10.1f} "
                          f"{clip['duration']:<10.1f} {clip['tag']:<10} {clip['peak_energy']:<10}")
        
        if not args.quiet:
            if num_clips == 0:
                print("⚠️ No clips detected. Try adjusting sensitivity settings.")
            else:
                print(f"\n✅ Success! Found {num_clips} clips → {config.output_json}")
        
        sys.exit(0)
        
    except KeyboardInterrupt:
        print("\n\n⚠️ Interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n❌ Error: {e}", file=sys.stderr)
        if args.debug:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
