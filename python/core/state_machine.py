"""
State Machine for Roundnet game detection.

The Logic Engine that tracks game state through 4 phases:
    Search -> Locked -> Probation -> Rally

This implements the proven V12 detection algorithm.
"""

from enum import Enum, auto
from typing import List, Optional, Tuple
from dataclasses import dataclass, field

from .config import Config
from .utils import calculate_dynamic_threshold


class GameState(Enum):
    """
    State machine states for game detection.
    
    Flow:
        SEARCHING (0) -> LOCKED (1) -> PROBATION (2) -> RALLY (3)
                  ^                          |              |
                  |__________________________|______________|
    """
    SEARCHING = auto()    # State 0: Waiting for 2 zones to be occupied
    LOCKED = auto()       # State 1: Measuring baseline energy for calibration
    PROBATION = auto()    # State 2: Point started, validating minimum duration
    RALLY = auto()        # State 3: Recording, watching for point end


@dataclass
class ClipInfo:
    """
    Information about a detected clip.
    
    Attributes:
        start: Clip start time in seconds (includes PRE_SERVE_BUFFER)
        end: Clip end time in seconds (includes POST_POINT_BUFFER)
        tag: Classification ("Rally", "Serve", or "Noise")
        confidence: Confidence level ("High", "Medium", or "Low")
        peak_energy: Maximum smoothed energy during the clip
    """
    start: float
    end: float
    tag: str
    confidence: str
    peak_energy: int
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            'start': round(self.start, 3),
            'end': round(self.end, 3),
            'duration': round(self.end - self.start, 3),
            'tag': self.tag,
            'confidence': self.confidence,
            'peak_energy': self.peak_energy
        }


@dataclass
class StateMachineContext:
    """
    Internal state for the state machine.
    
    This tracks all the counters and measurements needed for
    state transitions and clip detection.
    """
    state: GameState = GameState.SEARCHING
    frames_held: int = 0              # Frames in current position
    low_energy_frames: int = 0        # Consecutive low-energy frames
    serve_time: float = 0.0           # When serve was detected
    clip_peak_energy: float = 0.0     # Max energy during current clip
    baseline_readings: List[float] = field(default_factory=list)
    dynamic_threshold: float = 40.0   # Calibrated energy threshold


class ClipClassifier:
    """
    Classifies clips using the "Traffic Light" tagging system.
    
    Tags based on peak energy:
        - Green (Rally): Peak Energy > 80 → High confidence
        - Yellow (Serve): Peak Energy 55-80 → Medium confidence  
        - Red (Noise): Peak Energy < 55 → Low confidence
    """
    
    def __init__(self, config: Config):
        self.config = config
    
    def classify(self, duration: float, peak_energy: float) -> Tuple[str, str]:
        """
        Classify a clip based on its peak energy.
        
        Args:
            duration: Clip duration in seconds (for potential future use)
            peak_energy: Maximum smoothed energy during clip
            
        Returns:
            Tuple of (tag, confidence) strings
        """
        if peak_energy > self.config.rally_energy_req:
            return "Rally", "High"
        if peak_energy < self.config.walk_energy_cap:
            return "Noise", "Low"
        return "Serve", "Medium"


class StateMachine:
    """
    State machine for detecting game events (serves, rallies, points).
    
    Implements the V12 detection algorithm with:
    - Zone-based serve detection (min 2 zones occupied to arm)
    - Auto-calibrating energy threshold with safety rails
    - Occlusion shield to prevent false cuts
    - Traffic light classification system
    
    States:
        SEARCHING -> Players moving around, looking for serve setup
        LOCKED -> Players in position, baseline energy being measured
        PROBATION -> Serve detected, validating minimum duration
        RALLY -> Active rally, watching for point end
    """
    
    def __init__(self, config: Config, fps: float):
        """
        Initialize state machine.
        
        Args:
            config: Configuration object with thresholds and buffers
            fps: Video frames per second (for frame-to-time conversion)
        """
        self.config = config
        self.fps = fps
        self.ctx = StateMachineContext()
        self.clips: List[ClipInfo] = []
        self.classifier = ClipClassifier(config)
        
        # Pre-calculate frame thresholds from time-based config
        self.frames_start_needed = int(config.min_hold_duration * fps)
        self.frames_override_needed = int(1.0 * fps)  # 1 second for force cut
        self.frames_end_needed = int(config.min_low_energy_duration * fps)
    
    def update(
        self, 
        timestamp: float, 
        active_zones: int, 
        smooth_energy: float,
        num_skeletons: int,
        logic_step: int
    ) -> Optional[ClipInfo]:
        """
        Process a frame and update state machine.
        
        This is the core logic loop that transitions between states
        based on zone occupancy, energy levels, and skeleton visibility.
        
        Args:
            timestamp: Current video timestamp in seconds
            active_zones: Number of zones with players (ankle detected)
            smooth_energy: Current smoothed energy value
            num_skeletons: Number of detected skeletons (for occlusion detection)
            logic_step: Frame step size (for adjusting frame counters)
            
        Returns:
            ClipInfo if a clip was completed, None otherwise
        """
        ctx = self.ctx
        cfg = self.config
        
        # Track peak energy during active clips (Probation + Rally)
        if ctx.state in [GameState.PROBATION, GameState.RALLY]:
            ctx.clip_peak_energy = max(ctx.clip_peak_energy, smooth_energy)
        
        completed_clip = None
        
        # === GLOBAL OVERRIDE: Force cut if players reset during rally ===
        # This detects when players return to serve positions mid-rally
        # (indicates point ended and they're setting up for next serve)
        if ctx.state == GameState.RALLY:
            if active_zones >= cfg.min_occupied_zones:
                ctx.frames_held += logic_step
                if ctx.frames_held >= self.frames_override_needed:
                    if cfg.debug_mode:
                        print(f"🛑 FORCE CUT at {timestamp:.2f}s (players reset)")
                    completed_clip = self._save_clip(timestamp - 1.0)
                    # Jump directly to LOCKED since players are already in position
                    ctx.state = GameState.LOCKED
                    ctx.frames_held = self.frames_start_needed
                    ctx.baseline_readings = []
            else:
                ctx.frames_held = 0
        
        # === STATE: SEARCHING (State 0) ===
        # Waiting for min 2 zones to be occupied (players in position)
        if ctx.state == GameState.SEARCHING:
            if active_zones >= cfg.min_occupied_zones:
                ctx.frames_held += logic_step
                ctx.baseline_readings.append(smooth_energy)
                if ctx.frames_held >= self.frames_start_needed:
                    ctx.state = GameState.LOCKED
            else:
                ctx.frames_held = 0
                ctx.baseline_readings = []
        
        # === STATE: LOCKED (State 1) ===
        # Players in position, measuring baseline energy for threshold calibration
        elif ctx.state == GameState.LOCKED:
            ctx.baseline_readings.append(smooth_energy)
            
            # Serve detected when players leave positions (zones no longer occupied)
            if active_zones < cfg.min_occupied_zones:
                # Calculate dynamic threshold using Safety Rails
                ctx.dynamic_threshold = calculate_dynamic_threshold(
                    baseline_readings=ctx.baseline_readings,
                    base_sensitivity=cfg.base_sensitivity,
                    min_threshold=cfg.min_dynamic_threshold,
                    max_threshold=cfg.max_dynamic_threshold
                )
                
                if cfg.debug_mode:
                    print(f"🚀 SERVE at {timestamp:.2f}s (threshold: {ctx.dynamic_threshold:.1f})")
                
                ctx.serve_time = timestamp
                ctx.state = GameState.PROBATION
                ctx.frames_held = 0
                ctx.clip_peak_energy = 0.0
        
        # === STATE: PROBATION (State 2) ===
        # Serve detected, must last > MIN_POINT_DURATION to be valid
        # Track low energy frames during probation (same logic as RALLY state)
        # Only cut after minimum duration AND sustained low energy
        elif ctx.state == GameState.PROBATION:
            current_duration = timestamp - ctx.serve_time
            
            # Track low energy frames during entire probation period (same logic as RALLY)
            if smooth_energy < ctx.dynamic_threshold:
                ctx.low_energy_frames += logic_step
            else:
                ctx.low_energy_frames = 0  # Reset when energy goes above threshold
            
            # After minimum duration, check if we should cut or promote
            if current_duration >= cfg.min_point_duration:
                if smooth_energy > ctx.dynamic_threshold:
                    # Energy is high, promote to Rally
                    ctx.state = GameState.RALLY
                    ctx.low_energy_frames = 0
                elif ctx.low_energy_frames >= self.frames_end_needed:
                    # Sustained low energy for min_low_energy_duration, cut it
                    if cfg.debug_mode:
                        print(f"   💾 SHORT CLIP at {timestamp:.2f}s (sustained low energy)")
                    completed_clip = self._save_clip(timestamp + cfg.post_point_buffer)
                    ctx.state = GameState.SEARCHING
                    ctx.frames_held = 0
                    ctx.baseline_readings = []
                # Otherwise, continue probation and keep counting low_energy_frames
        
        # === STATE: RALLY (State 3) ===
        # Recording active rally, ends when energy drops below threshold
        elif ctx.state == GameState.RALLY:
            # Occlusion Shield: If < 1 skeleton detected, HOLD state
            # This prevents cutting when players are temporarily occluded
            if num_skeletons < 1:
                ctx.low_energy_frames = 0  # Reset counter, don't cut
            else:
                if smooth_energy < ctx.dynamic_threshold:
                    ctx.low_energy_frames += logic_step
                else:
                    ctx.low_energy_frames = 0
            
            # End rally after sustained low energy
            if ctx.low_energy_frames >= self.frames_end_needed:
                if cfg.debug_mode:
                    print(f"🎬 RALLY ENDED at {timestamp:.2f}s")
                completed_clip = self._save_clip(timestamp + cfg.post_point_buffer)
                ctx.state = GameState.SEARCHING
                ctx.frames_held = 0
                ctx.baseline_readings = []
        
        if completed_clip:
            self.clips.append(completed_clip)
        
        return completed_clip
    
    def _save_clip(self, end_time: float) -> ClipInfo:
        """
        Create a ClipInfo for the current clip.
        
        Applies PRE_SERVE_BUFFER to start time and classifies using
        Traffic Light system.
        
        Args:
            end_time: Raw end timestamp (POST_POINT_BUFFER already added by caller)
            
        Returns:
            ClipInfo with all metadata
        """
        ctx = self.ctx
        cfg = self.config
        
        # Apply pre-serve buffer (critical for capturing setup)
        clip_start = max(0, ctx.serve_time - cfg.pre_serve_buffer)
        clip_end = end_time
        duration = clip_end - clip_start
        
        # Classify using Traffic Light system
        tag, confidence = self.classifier.classify(duration, ctx.clip_peak_energy)
        
        return ClipInfo(
            start=clip_start,
            end=clip_end,
            tag=tag,
            confidence=confidence,
            peak_energy=int(ctx.clip_peak_energy)
        )
    
    def reset(self) -> None:
        """Reset state machine for new video."""
        self.ctx = StateMachineContext()
        self.clips = []
    
    def get_clips(self) -> List[ClipInfo]:
        """Get all detected clips."""
        return self.clips
    
    def get_state_name(self) -> str:
        """Get current state as string for debugging/visualization."""
        return self.ctx.state.name
    
    def get_threshold(self) -> float:
        """Get current dynamic threshold for visualization."""
        return self.ctx.dynamic_threshold
