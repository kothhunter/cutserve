"""
Utility functions for Roundnet Condenser.
Contains energy calculation, zone management, and helper functions.
"""

import json
import cv2
import numpy as np
from typing import List, Tuple, Optional
from dataclasses import dataclass

from .config import Config


@dataclass
class ZoneStatus:
    """Container for zone occupancy results."""
    active_count: int
    occupancy: List[bool]


class ZoneManager:
    """
    Manages court zone polygons and occupancy detection.
    
    Zones are drawn by the user using zone_wizard_poly.py and saved as JSON.
    During processing, ankles are checked against scaled zone polygons.
    """
    
    def __init__(self, config: Config):
        self.config = config
        self.zones: List[np.ndarray] = []
        self.scaled_zones: List[np.ndarray] = []
        self.scale_factor: float = 1.0
    
    def load_zones(self, filename: str) -> None:
        """
        Load zone polygons from JSON file.
        
        Args:
            filename: Path to JSON file containing zone polygon coordinates
        """
        with open(filename, 'r') as f:
            data = json.load(f)
        self.zones = [np.array(zone, dtype=np.int32) for zone in data]
        if self.config.debug_mode:
            print(f"✅ Loaded {len(self.zones)} zones from {filename}")
    
    def scale_zones(self, original_width: int, target_width: int) -> None:
        """
        Scale zones to match a resized frame.
        
        Args:
            original_width: Width of original video frame
            target_width: Width of processed frame (after downscaling)
        """
        self.scale_factor = target_width / original_width
        self.scaled_zones = [
            (zone * self.scale_factor).astype(np.int32) 
            for zone in self.zones
        ]
    
    def check_occupancy(self, ankles: List[Tuple[float, float]]) -> ZoneStatus:
        """
        Check which zones are occupied by player ankles.
        
        Args:
            ankles: List of (x, y) ankle positions from pose detection
            
        Returns:
            ZoneStatus with count of occupied zones and per-zone occupancy list
        """
        zones_to_check = self.scaled_zones if self.scaled_zones else self.zones
        occupied = [False] * len(zones_to_check)
        
        for ankle in ankles:
            for i, zone in enumerate(zones_to_check):
                if self._point_in_zone(ankle, zone):
                    occupied[i] = True
        
        return ZoneStatus(
            active_count=sum(occupied),
            occupancy=occupied
        )
    
    @staticmethod
    def _point_in_zone(point: Tuple[float, float], zone_contour: np.ndarray) -> bool:
        """
        Check if a point is inside a zone polygon using OpenCV.
        
        Args:
            point: (x, y) coordinate to test
            zone_contour: Polygon vertices as numpy array
            
        Returns:
            True if point is inside or on the polygon boundary
        """
        return cv2.pointPolygonTest(zone_contour, (point[0], point[1]), False) >= 0


class EnergyCalculator:
    """
    Calculates movement energy by tracking skeleton displacement between frames.
    
    Energy is computed as total pixel displacement of hip centers between consecutive
    frames, using greedy matching to pair skeletons. Values are normalized back to
    original resolution when processing downscaled frames.
    """
    
    def __init__(self, config: Config):
        self.config = config
        self.prev_skeletons: List[Tuple[float, float]] = []
        self.smooth_energy: float = 0.0
        self.scale_factor: float = 1.0
    
    def set_scale_factor(self, scale_factor: float) -> None:
        """
        Set scale factor for normalizing energy to original resolution.
        
        Args:
            scale_factor: Ratio of processed_width / original_width
        """
        self.scale_factor = scale_factor
    
    def calculate(self, current_skeletons: List[Tuple[float, float]]) -> float:
        """
        Calculate raw movement energy between current and previous frame.
        
        Uses greedy matching to pair skeletons between frames, then sums
        the total displacement of matched pairs.
        
        Args:
            current_skeletons: List of (cx, cy) hip center positions
            
        Returns:
            Raw energy value (total pixel displacement, normalized to original resolution)
        """
        if not self.prev_skeletons or not current_skeletons:
            self.prev_skeletons = current_skeletons
            return 0.0
        
        total_movement = 0.0
        used_indices = set()
        max_dist = self.config.max_skeleton_match_distance
        
        for curr in current_skeletons:
            min_dist = float('inf')
            best_match = None
            
            for i, prev in enumerate(self.prev_skeletons):
                if i in used_indices:
                    continue
                dist = np.linalg.norm(np.array(curr) - np.array(prev))
                if dist < max_dist and dist < min_dist:
                    min_dist = dist
                    best_match = i
            
            if best_match is not None:
                total_movement += min_dist
                used_indices.add(best_match)
        
        self.prev_skeletons = current_skeletons
        
        # Normalize to original resolution if processing at reduced size
        if self.scale_factor != 1.0:
            total_movement *= (1 / self.scale_factor)
        
        return total_movement
    
    def update_smooth(self, raw_energy: float) -> float:
        """
        Apply exponential smoothing to energy values.
        
        Smoothing reduces noise and provides more stable energy readings
        for state machine decisions.
        
        Args:
            raw_energy: Raw energy from current frame
            
        Returns:
            Smoothed energy value
        """
        alpha = self.config.energy_smoothing_factor
        self.smooth_energy = (raw_energy * alpha) + (self.smooth_energy * (1 - alpha))
        return self.smooth_energy
    
    def reset(self) -> None:
        """Reset calculator state for new video or clip."""
        self.prev_skeletons = []
        self.smooth_energy = 0.0


def clamp(value: float, min_val: float, max_val: float) -> float:
    """
    Clamp a value between min and max bounds.
    
    Args:
        value: Value to clamp
        min_val: Minimum allowed value
        max_val: Maximum allowed value
        
    Returns:
        Clamped value
    """
    return max(min_val, min(value, max_val))


def calculate_dynamic_threshold(
    baseline_readings: List[float],
    base_sensitivity: float,
    min_threshold: float,
    max_threshold: float
) -> float:
    """
    Calculate dynamic energy threshold from baseline readings.
    
    This implements the "Safety Rails" auto-calibration:
    - Floor: Threshold never drops below min_threshold (fixes "Super Still" issue)
    - Ceiling: Threshold never exceeds max_threshold (fixes "Jittery Setup" issue)
    
    Formula: Threshold = Clamp(Noise_Floor + base_sensitivity, min_threshold, max_threshold)
    
    Args:
        baseline_readings: Energy readings collected during LOCKED state
        base_sensitivity: Amount to add above noise floor
        min_threshold: Minimum allowed threshold (floor)
        max_threshold: Maximum allowed threshold (ceiling)
        
    Returns:
        Calibrated dynamic threshold
    """
    if baseline_readings:
        noise_floor = sum(baseline_readings) / len(baseline_readings)
    else:
        noise_floor = 10.0  # Fallback for empty readings
    
    raw_threshold = noise_floor + base_sensitivity
    return clamp(raw_threshold, min_threshold, max_threshold)
