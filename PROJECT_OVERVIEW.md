# Roundnet Condenser - Project Overview

## What is Roundnet Condenser?

**Roundnet Condenser** is an intelligent desktop application that automatically detects, analyzes, and condenses roundnet (spikeball) game footage into professional highlight reels. Using advanced computer vision and machine learning, the application eliminates hours of manual video editing by automatically identifying rallies, tracking player movements, calculating statistics, and generating polished highlight videos with score overlays and player analytics.

## Target Audience

- **Tournament organizers** who need to quickly produce highlight reels from multi-hour events
- **Players and teams** who want automatic game analysis and statistics
- **Content creators** producing roundnet content for social media or streaming platforms
- **Coaches** analyzing player performance and match dynamics

## Core Value Proposition

Transform hours of raw roundnet footage into:
- Professionally edited highlight reels in minutes (not hours)
- Detailed player statistics (RPR ratings, aces, service breaks, efficiency)
- Score-overlaid videos with team branding
- Frame-accurate clips ready for social media or broadcasting

## Key Features

### 1. Automatic Rally Detection
- Uses YOLOv8 pose detection to track all players in real-time
- Sophisticated state machine identifies serve timing and rally endings
- Dynamic threshold calibration adapts to different lighting and playing conditions
- Classifies clips by intensity (Rally/Serve/Noise) using energy analysis

### 2. Interactive Zone Setup
- Visual zone drawing tool defines the court area
- 4-zone system (one per player position) enables serve detection
- Supports both traditional and polygon-based zone definitions
- Handles camera angles and perspective distortions

### 3. Intelligent Clip Editor
- Filmstrip interface for quick clip review
- Frame-accurate nudge controls (keyboard shortcuts)
- Trash/restore functionality for false positives
- "Play All" mode for seamless preview of final video
- Real-time statistics assignment per clip

### 4. Match Flow Engine
- Full roundnet rotation logic (traditional + equal serving styles)
- Automatic score tracking and server rotation
- Team and player configuration wizard
- Support for custom scoring formats (e.g., win-by-2)

### 5. Professional Export Studio
- WYSIWYG overlay editor with live preview
- Multiple preset overlay templates (stacked, top corners, top middle)
- Custom team logo placement
- Automatic statistics screen generation
- Resolution control (1080p/720p)
- Hardware-accelerated video encoding

### 6. Advanced Analytics
- **RPR (Roundnet Player Rating)** calculation
  - Serving efficiency (aces, service percentage)
  - Hitting accuracy
  - Error rate and efficiency
  - Defensive performance
- Per-player breakdowns
- Team performance metrics
- Exportable statistics screens

## How It Works

### Workflow Overview

```
1. Import Video → 2. Define Court Zones → 3. Auto-Process → 4. Configure Match → 5. Edit Clips → 6. Export Highlights
```

### Detailed Process

#### Step 1: Project Creation
- Import MP4 video file
- Application creates project workspace
- Extracts video metadata (duration, resolution, frame rate)

#### Step 2: Zone Definition (Zone Wizard)
- Draw 4 polygons on video frame to mark player positions
- Zones used for serve detection and player positioning
- Saved as JSON coordinates for processing

#### Step 3: Automatic Processing
- Python backend spawns video analysis pipeline
- YOLOv8 processes every 3rd frame (configurable)
- Detects human poses (keypoints for all players)
- Calculates "movement energy" per zone
- State machine identifies rally starts/ends
- Outputs clip list with timestamps, tags, and confidence scores
- Real-time progress updates in UI

#### Step 4: Match Configuration (Match Setup Wizard)
- Define team names and colors
- Assign players to teams (2v2 format)
- Choose serving style (traditional or equal)
- Set first server and receiver
- Configure target score (default: 21)

#### Step 5: Clip Editing
- Review all detected clips in filmstrip view
- Trash false positives (e.g., warmup footage)
- Fine-tune clip boundaries with nudge controls
- Assign stat types to clips (ace, service break, double fault, etc.)
- Tag involved players for each clip
- Preview final video in "Play All" mode

#### Step 6: Export (Broadcast Studio)
- Select overlay template or upload custom graphic
- Configure score positioning (x/y coordinates, font size, color)
- Upload team logos (optional)
- Enable/disable statistics screen (auto-generated from match data)
- Set stat screen duration and resolution
- Render final video with FFmpeg
- Output: `final_highlights.mp4` ready for publishing

## Technical Highlights

### Computer Vision Engine
- **Model:** YOLOv8n-pose (nano variant, optimized for speed)
- **Hardware Acceleration:** Automatic MPS (Apple Silicon) and CUDA support
- **Batch Processing:** 4 frames at once for GPU efficiency
- **Precision:** FP16 half-precision for 2x faster inference
- **Frame Skipping:** Processes every 3rd frame to reduce computation
- **Dynamic Calibration:** Auto-adjusts energy thresholds based on baseline noise

### Rally Detection Algorithm (V12)
A 4-state finite state machine with occlusion protection:

1. **SEARCHING** - Waiting for players to take positions (≥2 zones occupied)
2. **LOCKED** - Players stationary, measuring baseline energy for serve
3. **PROBATION** - Serve detected, validating minimum rally duration (2.5s)
4. **RALLY** - Active rally, watching for low energy indicating point end

**Key Innovations:**
- Occlusion shield prevents false endings when players temporarily blocked
- Energy smoothing (exponential moving average) reduces jitter
- Minimum duration filter eliminates false positives from quick movements
- Pre-serve and post-point buffers capture full rally context

### Video Export Pipeline
FFmpeg filter_complex chain:
1. Trim clips at exact timestamps
2. Scale to target resolution (maintain aspect ratio)
3. Overlay graphics (PNG with alpha channel)
4. Composite team logos at configured positions
5. Render dynamic score text with custom fonts/colors
6. Concatenate all clips with interleaved audio
7. Append statistics screen as looped video segment
8. Encode with h264_videotoolbox (macOS hardware) or libx264 (fallback)

### Architecture Pattern
**Electron Multi-Process with Python Backend**
- **Renderer Process (React):** User interface and interaction
- **Main Process (Node.js):** File system, IPC routing, window management
- **Python Subprocess:** Video processing and ML inference
- **Secure Bridge (Preload):** Type-safe IPC API via contextBridge
- **Custom Protocol:** `local-file://` for secure video streaming

## Technology Stack

### Frontend
- **React 18.3.1** - UI framework with hooks
- **TypeScript 5.6.3** - Type safety and developer experience
- **TailwindCSS 3.4.16** - Utility-first styling
- **Vite 6.0.3** - Lightning-fast build tool
- **React Router 6.28.0** - Client-side routing

### Desktop Framework
- **Electron 33.2.0** - Cross-platform desktop app
- **Electron Builder 25.1.8** - Native packaging (DMG/EXE/AppImage)

### Backend/Processing
- **Python 3.x** - Video processing runtime
- **YOLOv8 (Ultralytics)** - Pose detection model
- **PyTorch** - ML framework (with MPS/CUDA support)
- **OpenCV (cv2)** - Video I/O and frame manipulation
- **FFmpeg** - Professional video encoding and composition

### Development Tools
- **ESLint** - Code quality enforcement
- **PostCSS** - CSS processing and autoprefixing
- **ESBuild** - Preload script bundler

## Project Statistics

- **Total Lines of Code:** ~7,000 custom lines
  - TypeScript/TSX: ~4,582 lines
  - Python: ~2,404 lines
- **File Count:** 40+ source files
- **Dependencies:** 15 NPM packages, 4 Python libraries
- **Model Size:** 6.5MB (yolov8n-pose.pt)
- **Supported Platforms:** macOS, Windows, Linux

## Use Cases

### Tournament Broadcasting
- Import multi-hour tournament footage
- Automatically extract all match highlights
- Add tournament branding and team logos
- Export separate highlight reels per match or combined compilation

### Team Analysis
- Review match statistics for strategic planning
- Identify serving patterns and weaknesses
- Track player efficiency over multiple games
- Export analytics for coaching sessions

### Content Creation
- Quickly produce social media clips from full matches
- Add professional overlays and branding
- Generate shareable statistics graphics
- Maintain consistent video quality and formatting

### Personal Improvement
- Track individual player performance over time
- Analyze specific stat types (aces, service breaks, etc.)
- Review highlight reels to identify improvement areas
- Compare performance across different matches

## System Requirements

### Minimum Requirements
- **OS:** macOS 10.15+, Windows 10+, or Linux (Ubuntu 20.04+)
- **RAM:** 8GB
- **Storage:** 2GB free space (plus space for video files)
- **Python:** 3.8+ installed on system
- **FFmpeg:** Installed and accessible in PATH

### Recommended Specifications
- **OS:** macOS 12+ with Apple Silicon, Windows 11, or Ubuntu 22.04+
- **RAM:** 16GB or more
- **GPU:** NVIDIA GPU with CUDA support or Apple Silicon (M1/M2/M3)
- **Storage:** SSD with 10GB+ free space
- **CPU:** Multi-core processor (8+ cores recommended)

### Software Dependencies
- **Node.js:** Bundled with Electron (no separate install needed)
- **Python Libraries:** ultralytics, torch, opencv-python, numpy
- **FFmpeg:** Must be installed separately (brew/apt/chocolatey)

## Installation

### End Users (Production Build)
1. Download installer for your platform (DMG/EXE/AppImage)
2. Install FFmpeg (`brew install ffmpeg` on macOS)
3. Install Python dependencies: `pip install ultralytics opencv-python`
4. Launch application
5. Grant video file access permissions if prompted

### Developers (Build from Source)
```bash
# Clone repository
git clone <repository-url>
cd roundnet-desktop

# Install dependencies
npm install
pip install ultralytics opencv-python torch numpy

# Run in development mode
npm run dev

# Build for production
npm run build
```

## Performance Characteristics

### Processing Speed
- **Video Analysis:** ~30-60 seconds per minute of footage (with GPU)
- **CPU-only:** 2-4x slower than GPU processing
- **Frame Rate:** Processes 10 FPS (every 3rd frame of 30 FPS source)
- **Batch Size:** 4 frames processed simultaneously on GPU

### Export Speed
- **Hardware Encoder:** Real-time or faster (1 minute footage = <1 minute render)
- **Software Encoder:** 0.5-1x real-time (depends on CPU)
- **Resolution Impact:** 1080p ~2x slower than 720p

### Memory Usage
- **Application:** ~200-500MB RAM (Electron + React)
- **Python Process:** ~1-2GB during inference (model + video buffers)
- **Peak Usage:** ~2.5GB total during processing + export

## Known Limitations

### Current Version Constraints
- **Input Format:** MP4 containers only (for best compatibility)
- **Match Format:** 2v2 only (no singles or 3v3 support)
- **Batch Processing:** One project at a time (no queue system)
- **Undo/Redo:** Not implemented in clip editor
- **Python Bundling:** Python must be installed separately (not bundled with app)

### Edge Cases Handled
- Occlusion (players temporarily blocked from view)
- Lighting changes (dynamic threshold calibration)
- False positives (traffic light tagging + manual review)
- Camera shake (energy smoothing algorithms)
- Multiple rallies in single clip (manual split not yet supported)

## Future Enhancements

### Planned Features
1. **Clip Thumbnails** - Extract actual video frames for filmstrip
2. **Waveform Display** - Audio visualization for precise timing
3. **Batch Processing** - Queue multiple videos for overnight processing
4. **Undo/Redo** - Full edit history with keyboard shortcuts
5. **Export Presets** - Save overlay configurations for reuse
6. **Custom Transitions** - Crossfades between clips
7. **Python Bundling** - Embed Python runtime in app (no separate install)
8. **Cloud Sync** - Optional cloud backup for projects

### Potential Additions
- Auto-thumbnail generation for projects and clips
- Widescreen (16:9) and vertical (9:16) export formats
- Real-time processing preview during analysis
- Custom stat formulas and rating systems
- Multi-camera angle support
- Live event processing (stream ingestion)

## Contributing

This project welcomes contributions! Key areas for improvement:
- **Testing:** Add unit tests (Jest) and E2E tests (Playwright)
- **Accessibility:** WCAG compliance for UI components
- **Performance:** Optimize clip editor for 100+ clips
- **Documentation:** API documentation and developer guides
- **Localization:** Multi-language support

## License

[Insert license information here]

## Support & Resources

- **Issues:** Report bugs and request features on GitHub
- **Documentation:** See `ARCHITECTURE.md` and `CODEBASE_GUIDE.md` for technical details
- **Implementation Notes:** See `IMPLEMENTATION_SUMMARY.md` for comprehensive feature walkthrough

## Credits

- **YOLOv8:** Ultralytics (https://github.com/ultralytics/ultralytics)
- **Electron:** OpenJS Foundation
- **React:** Meta Open Source
- **FFmpeg:** FFmpeg team

---

**Last Updated:** 2026-02-16
**Version:** 1.0.0
**Status:** Production-ready with active development
