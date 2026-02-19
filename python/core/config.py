"""
Configuration constants for Roundnet Condenser.

All "magic numbers" are centralized here for easy tuning.
These values have been proven through V12 testing.
"""

from dataclasses import dataclass, field
from typing import Tuple


@dataclass
class Config:
    """
    Main configuration class with all tunable parameters.
    
    These values represent the "V12 proven" settings that work well
    for standard Roundnet/Spikeball gameplay footage.
    """
    
    # === FILE PATHS (Set at runtime) ===
    video_path: str = ''
    zones_file: str = 'court_zones.json'
    output_json: str = 'clips.json'  # Changed from CSV to JSON
    model_path: str = 'yolov8n-pose.pt'
    
    # === SPEED SETTINGS ===
    # process_fps: Normalize to this FPS so energy values are comparable across videos.
    #   High-FPS sources (e.g. 120fps) are subsampled to this rate before processing.
    #   Rebuild/export can still use the original high-FPS video for clips.
    # Frame Skipping: Among those frames, process 1 and skip N (skip_frames) for speed.
    process_fps: float = 30.0         # Target FPS for processing (energy comparable across sources)
    process_width: int = 640          # Downscale width for AI inference
    skip_frames: int = 2              # Skip N frames between processed frames (at process_fps)
    inference_batch_size: int = 4     # Frames per batch for GPU inference (improves throughput)
    
    # === TIMING BUFFERS (seconds) ===
    # PRE_SERVE_BUFFER: Critical for capturing player setup before serve
    # POST_POINT_BUFFER: Additional time after point ends (usually 0)
    pre_serve_buffer: float = 4.0     # Seconds BEFORE detected serve
    post_point_buffer: float = -1    # Seconds AFTER point ends
    
    # === DETECTION LOGIC ===
    # Zone-based serve detection parameters
    min_occupied_zones: int = 2       # Min zones with ankles to arm system
    min_hold_duration: float = 2.5    # Seconds in LOCKED state before serve armed
    min_point_duration: float = 2.5   # Min seconds for valid point (PROBATION)
    min_low_energy_duration: float = 2.5  # Seconds of low energy to end RALLY
    
    # === ENERGY THRESHOLDS (Safety Rails) ===
    # Auto-calibration formula: Threshold = Clamp(Noise_Floor + base_sensitivity, min, max)
    # Floor (min): Fixes "Super Still" issue where very still players = low threshold
    # Ceiling (max): Fixes "Jittery Setup" issue where fidgeting = high threshold
    base_sensitivity: float = 15.0        # Added to noise floor
    min_dynamic_threshold: float = 60.0   # Floor (never below this)
    max_dynamic_threshold: float = 60.0   # Ceiling (never above this)
    
    # === CLIP TAGGING (Traffic Light System) ===
    # Green (Rally): Peak Energy > rally_energy_req → High confidence
    # Yellow (Serve): Peak Energy between thresholds → Medium confidence
    # Red (Noise): Peak Energy < walk_energy_cap → Low confidence
    rally_energy_req: float = 80.0    # Above this = "Rally" (Green)
    walk_energy_cap: float = 55.0     # Below this = "Noise" (Red)
    
    # === ENERGY SMOOTHING ===
    # Exponential smoothing: smooth = (raw * alpha) + (prev_smooth * (1-alpha))
    energy_smoothing_factor: float = 0.3
    
    # === POSE DETECTION ===
    keypoint_confidence_threshold: float = 0.5  # Min confidence for keypoint
    max_skeleton_match_distance: float = 100.0  # Max pixels to match skeletons
    
    # === VISUALIZATION ===
    show_visuals: bool = False        # Display preview window
    debug_mode: bool = True           # Print debug messages
    
    # === COLORS (BGR format for OpenCV) ===
    color_zone_active: Tuple[int, int, int] = field(default_factory=lambda: (0, 255, 0))      # Green
    color_zone_inactive: Tuple[int, int, int] = field(default_factory=lambda: (128, 128, 128))  # Gray
    color_skeleton: Tuple[int, int, int] = field(default_factory=lambda: (0, 255, 255))       # Yellow
    color_energy_bar: Tuple[int, int, int] = field(default_factory=lambda: (255, 100, 100))   # Blue-ish
    color_text: Tuple[int, int, int] = field(default_factory=lambda: (255, 255, 255))         # White
    
    def __post_init__(self):
        """Validate configuration after initialization."""
        if self.process_fps <= 0:
            raise ValueError("process_fps must be > 0")
        if self.skip_frames < 0:
            raise ValueError("skip_frames must be >= 0")
        if self.inference_batch_size < 1:
            raise ValueError("inference_batch_size must be >= 1")
        if self.process_width < 100:
            raise ValueError("process_width must be >= 100")
        if not 0 < self.energy_smoothing_factor <= 1:
            raise ValueError("energy_smoothing_factor must be between 0 and 1")
        if self.min_dynamic_threshold > self.max_dynamic_threshold:
            raise ValueError("min_dynamic_threshold must be <= max_dynamic_threshold")


# Default configuration instance for quick access
DEFAULT_CONFIG = Config()
