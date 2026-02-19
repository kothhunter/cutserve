"""
Visualization utilities for Roundnet Condenser.
Provides functions to draw debug overlays on video frames.
"""

import cv2
import numpy as np
from typing import List, Tuple, Optional

from core.config import Config


class Visualizer:
    """
    Draws debug visualizations on video frames.
    
    Includes zone overlays, skeleton rendering, energy bars, and state info.
    """
    
    # Skeleton connections for YOLO pose (COCO format)
    SKELETON_CONNECTIONS = [
        (0, 1), (0, 2), (1, 3), (2, 4),        # Head
        (5, 6), (5, 7), (7, 9), (6, 8), (8, 10),  # Arms
        (5, 11), (6, 12), (11, 12),            # Torso
        (11, 13), (13, 15), (12, 14), (14, 16)  # Legs
    ]
    
    def __init__(self, config: Config):
        """
        Initialize visualizer with configuration.
        
        Args:
            config: Configuration object with color settings
        """
        self.config = config
    
    def draw_zones(
        self, 
        frame: np.ndarray, 
        zones: List[np.ndarray],
        occupancy: Optional[List[bool]] = None
    ) -> np.ndarray:
        """
        Draw zone polygons on frame.
        
        Args:
            frame: BGR image to draw on
            zones: List of zone polygon arrays
            occupancy: Optional list of booleans indicating zone occupancy
            
        Returns:
            Frame with zones drawn
        """
        display = frame.copy()
        
        for i, zone in enumerate(zones):
            is_active = occupancy[i] if occupancy else False
            color = self.config.color_zone_active if is_active else self.config.color_zone_inactive
            
            # Draw filled polygon with transparency
            overlay = display.copy()
            cv2.fillPoly(overlay, [zone], color)
            cv2.addWeighted(overlay, 0.3, display, 0.7, 0, display)
            
            # Draw outline
            cv2.polylines(display, [zone], True, color, 2)
            
            # Label zone
            M = cv2.moments(zone)
            if M["m00"] != 0:
                cx = int(M["m10"] / M["m00"])
                cy = int(M["m01"] / M["m00"])
                cv2.putText(
                    display, f"Z{i+1}", (cx - 15, cy),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, self.config.color_text, 2
                )
        
        return display
    
    def draw_skeletons(
        self,
        frame: np.ndarray,
        keypoints: np.ndarray,
        confidence_threshold: float = 0.5
    ) -> np.ndarray:
        """
        Draw detected pose skeletons on frame.
        
        Args:
            frame: BGR image to draw on
            keypoints: Raw keypoint data from YOLO (N x 17 x 3)
            confidence_threshold: Minimum confidence to draw keypoint
            
        Returns:
            Frame with skeletons drawn
        """
        display = frame.copy()
        
        if keypoints is None:
            return display
        
        for person_kp in keypoints:
            if len(person_kp) == 0:
                continue
            
            # Draw keypoints
            for kp in person_kp:
                x, y, conf = kp
                if conf > confidence_threshold:
                    cv2.circle(display, (int(x), int(y)), 4, self.config.color_skeleton, -1)
            
            # Draw connections
            for start_idx, end_idx in self.SKELETON_CONNECTIONS:
                start_kp = person_kp[start_idx]
                end_kp = person_kp[end_idx]
                
                if start_kp[2] > confidence_threshold and end_kp[2] > confidence_threshold:
                    start_pt = (int(start_kp[0]), int(start_kp[1]))
                    end_pt = (int(end_kp[0]), int(end_kp[1]))
                    cv2.line(display, start_pt, end_pt, self.config.color_skeleton, 2)
        
        return display
    
    def draw_energy_bar(
        self,
        frame: np.ndarray,
        energy: float,
        threshold: float,
        max_energy: float = 150.0
    ) -> np.ndarray:
        """
        Draw an energy meter bar on the frame.
        
        Args:
            frame: BGR image to draw on
            energy: Current smoothed energy value
            threshold: Current dynamic threshold
            max_energy: Maximum expected energy for scaling
            
        Returns:
            Frame with energy bar drawn
        """
        display = frame.copy()
        h, w = frame.shape[:2]
        
        # Bar dimensions
        bar_width = 200
        bar_height = 20
        bar_x = w - bar_width - 20
        bar_y = 20
        
        # Background
        cv2.rectangle(
            display, 
            (bar_x, bar_y), 
            (bar_x + bar_width, bar_y + bar_height),
            (50, 50, 50), -1
        )
        
        # Energy fill
        fill_width = int((min(energy, max_energy) / max_energy) * bar_width)
        energy_color = (0, 255, 0) if energy > threshold else (0, 100, 255)
        cv2.rectangle(
            display,
            (bar_x, bar_y),
            (bar_x + fill_width, bar_y + bar_height),
            energy_color, -1
        )
        
        # Threshold marker
        thresh_x = bar_x + int((threshold / max_energy) * bar_width)
        cv2.line(display, (thresh_x, bar_y - 5), (thresh_x, bar_y + bar_height + 5), (255, 255, 255), 2)
        
        # Labels
        cv2.putText(
            display, f"Energy: {energy:.0f}", (bar_x, bar_y - 8),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, self.config.color_text, 1
        )
        
        return display
    
    def draw_state_info(
        self,
        frame: np.ndarray,
        state_name: str,
        timestamp: float,
        active_zones: int,
        total_zones: int
    ) -> np.ndarray:
        """
        Draw current state and debug information.
        
        Args:
            frame: BGR image to draw on
            state_name: Current state machine state
            timestamp: Current video timestamp
            active_zones: Number of occupied zones
            total_zones: Total number of zones
            
        Returns:
            Frame with state info drawn
        """
        display = frame.copy()
        
        # State colors
        state_colors = {
            "SEARCHING": (100, 100, 100),  # Gray
            "LOCKED": (0, 255, 255),        # Yellow
            "PROBATION": (0, 165, 255),     # Orange
            "RALLY": (0, 255, 0)            # Green
        }
        color = state_colors.get(state_name, (255, 255, 255))
        
        # Draw state box
        cv2.rectangle(display, (10, 10), (200, 90), (0, 0, 0), -1)
        cv2.rectangle(display, (10, 10), (200, 90), color, 2)
        
        # Draw text
        cv2.putText(
            display, f"State: {state_name}", (20, 35),
            cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2
        )
        cv2.putText(
            display, f"Time: {timestamp:.1f}s", (20, 55),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, self.config.color_text, 1
        )
        cv2.putText(
            display, f"Zones: {active_zones}/{total_zones}", (20, 75),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, self.config.color_text, 1
        )
        
        return display
    
    def draw_full_overlay(
        self,
        frame: np.ndarray,
        zones: List[np.ndarray],
        occupancy: List[bool],
        keypoints: Optional[np.ndarray],
        energy: float,
        threshold: float,
        state_name: str,
        timestamp: float
    ) -> np.ndarray:
        """
        Draw complete debug overlay with all visualizations.
        
        Args:
            frame: BGR image to draw on
            zones: List of zone polygons
            occupancy: Zone occupancy status
            keypoints: Raw keypoint data (can be None)
            energy: Current smoothed energy
            threshold: Current dynamic threshold
            state_name: Current state machine state
            timestamp: Current video timestamp
            
        Returns:
            Frame with full overlay
        """
        display = frame.copy()
        
        # Layer visualizations
        display = self.draw_zones(display, zones, occupancy)
        
        if keypoints is not None:
            display = self.draw_skeletons(display, keypoints)
        
        display = self.draw_energy_bar(display, energy, threshold)
        display = self.draw_state_info(
            display, state_name, timestamp, 
            sum(occupancy), len(zones)
        )
        
        return display
