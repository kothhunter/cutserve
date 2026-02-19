#!/usr/bin/env python3
"""
Zone Wizard - Interactive tool to draw court zones (polygons/trapezoids).

Use this tool to define the 4 player positions on the court. The main
detection engine uses these zones to determine when players are in
"serve ready" positions.

Usage:
    python -m tools.zone_wizard_poly video.mp4
    python -m tools.zone_wizard_poly video.mp4 -o custom_zones.json

Controls:
    - Use SLIDER to scrub to a frame where players are clearly visible
    - LEFT CLICK to add polygon vertices
    - Press 'n' to save current zone and start next one
    - Press 'r' to reset current zone (start over)
    - Press 'u' to undo last point
    - Press 's' to SAVE all zones and quit
    - Press 'q' to quit WITHOUT saving
"""

import argparse
import sys
import cv2
import numpy as np
import json
from pathlib import Path
from typing import List, Tuple

# Zone colors (BGR)
COLOR_SAVED = (0, 255, 0)       # Green for saved zones
COLOR_DRAWING = (0, 255, 255)   # Yellow for zone being drawn
COLOR_POINT = (0, 165, 255)     # Orange for individual points
COLOR_TEXT = (255, 255, 255)    # White for text


class ZoneWizard:
    """
    Interactive OpenCV-based tool for drawing court zone polygons.
    
    Recommended to draw 4 zones (trapezoids) around each player position,
    but supports any number of zones with any number of vertices.
    """
    
    RECOMMENDED_ZONES = 4
    MIN_POINTS_PER_ZONE = 3
    
    def __init__(self, video_path: str, output_file: str = 'court_zones.json'):
        self.video_path = video_path
        self.output_file = output_file
        
        self.zones: List[List[Tuple[int, int]]] = []
        self.current_points: List[Tuple[int, int]] = []
        
        self.cap = None
        self.current_frame = None
        self.total_frames = 0
        self.window_name = "Zone Wizard - Draw Court Zones"
    
    def mouse_callback(self, event, x, y, flags, param):
        """Handle mouse clicks to add polygon vertices."""
        if event == cv2.EVENT_LBUTTONDOWN:
            self.current_points.append((x, y))
    
    def on_trackbar(self, val):
        """Handle trackbar movement to scrub through video."""
        if self.cap is not None:
            self.cap.set(cv2.CAP_PROP_POS_FRAMES, val)
            ret, frame = self.cap.read()
            if ret:
                self.current_frame = frame
    
    def draw_overlay(self) -> np.ndarray:
        """Draw all zones and current drawing on the frame."""
        if self.current_frame is None:
            return np.zeros((480, 640, 3), dtype=np.uint8)
        
        display = self.current_frame.copy()
        
        # Draw saved zones (green, semi-transparent fill)
        for i, zone in enumerate(self.zones):
            pts = np.array(zone, np.int32)
            
            # Semi-transparent fill
            overlay = display.copy()
            cv2.fillPoly(overlay, [pts], COLOR_SAVED)
            cv2.addWeighted(overlay, 0.25, display, 0.75, 0, display)
            
            # Outline
            cv2.polylines(display, [pts], True, COLOR_SAVED, 2)
            
            # Zone label at centroid
            M = cv2.moments(pts)
            if M["m00"] != 0:
                cx = int(M["m10"] / M["m00"])
                cy = int(M["m01"] / M["m00"])
                cv2.putText(display, f"Z{i+1}", (cx - 15, cy + 5),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.8, COLOR_TEXT, 2)
        
        # Draw current zone being drawn (yellow)
        if len(self.current_points) > 0:
            pts = np.array(self.current_points, np.int32)
            
            # Draw lines connecting points
            if len(self.current_points) > 1:
                cv2.polylines(display, [pts], False, COLOR_DRAWING, 2)
            
            # Draw individual points
            for i, pt in enumerate(self.current_points):
                cv2.circle(display, pt, 5, COLOR_POINT, -1)
                cv2.putText(display, str(i+1), (pt[0] + 8, pt[1] - 8),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.4, COLOR_DRAWING, 1)
        
        # Draw instructions panel
        self._draw_instructions(display)
        
        return display
    
    def _draw_instructions(self, display: np.ndarray):
        """Draw instruction panel on the frame."""
        h, w = display.shape[:2]
        
        # Background panel
        panel_height = 140
        cv2.rectangle(display, (10, h - panel_height - 10), (350, h - 10),
                     (0, 0, 0), -1)
        cv2.rectangle(display, (10, h - panel_height - 10), (350, h - 10),
                     (100, 100, 100), 1)
        
        # Status
        zones_drawn = len(self.zones)
        status_color = COLOR_SAVED if zones_drawn >= self.RECOMMENDED_ZONES else COLOR_DRAWING
        
        lines = [
            f"Zones: {zones_drawn}/{self.RECOMMENDED_ZONES} (recommended)",
            f"Current zone: {len(self.current_points)} points",
            "",
            "Click to add points | 'n' save zone",
            "'r' reset | 'u' undo | 's' SAVE | 'q' quit"
        ]
        
        y = h - panel_height + 5
        for i, line in enumerate(lines):
            color = status_color if i == 0 else COLOR_TEXT
            cv2.putText(display, line, (20, y),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
            y += 25
    
    def run(self) -> bool:
        """
        Run the interactive zone wizard.
        
        Returns:
            True if zones were saved, False if cancelled
        """
        # Open video
        self.cap = cv2.VideoCapture(self.video_path)
        if not self.cap.isOpened():
            print(f"❌ Error: Could not open video: {self.video_path}")
            return False
        
        self.total_frames = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # Read first frame
        ret, self.current_frame = self.cap.read()
        if not ret:
            print("❌ Error: Could not read video frame")
            return False
        
        # Setup window
        cv2.namedWindow(self.window_name)
        cv2.setMouseCallback(self.window_name, self.mouse_callback)
        cv2.createTrackbar("Frame", self.window_name, 0, 
                          max(1, self.total_frames - 1), self.on_trackbar)
        
        print("\n" + "=" * 50)
        print("🎯 ZONE WIZARD")
        print("=" * 50)
        print(f"Video: {self.video_path}")
        print(f"Frames: {self.total_frames}")
        print("")
        print("INSTRUCTIONS:")
        print("  1. Use the SLIDER to find a clear frame")
        print(f"  2. Draw {self.RECOMMENDED_ZONES} zones around player positions")
        print("  3. Click to add polygon vertices")
        print("  4. Press 'n' after each zone")
        print("  5. Press 's' when done to save")
        print("=" * 50 + "\n")
        
        # Main loop
        while True:
            display = self.draw_overlay()
            cv2.imshow(self.window_name, display)
            
            key = cv2.waitKey(30) & 0xFF
            
            if key == ord('n'):  # Save current zone
                if len(self.current_points) >= self.MIN_POINTS_PER_ZONE:
                    self.zones.append(self.current_points.copy())
                    print(f"✅ Zone {len(self.zones)} saved ({len(self.current_points)} points)")
                    self.current_points = []
                else:
                    print(f"⚠️  Need at least {self.MIN_POINTS_PER_ZONE} points for a zone")
            
            elif key == ord('r'):  # Reset current zone
                self.current_points = []
                print("🔄 Current zone reset")
            
            elif key == ord('u'):  # Undo last point
                if self.current_points:
                    self.current_points.pop()
                    print(f"↩️  Removed last point ({len(self.current_points)} remaining)")
            
            elif key == ord('s'):  # Save and quit
                if len(self.zones) == 0:
                    print("⚠️  No zones drawn! Draw at least one zone before saving.")
                    continue
                
                # Save to JSON
                with open(self.output_file, 'w') as f:
                    json.dump(self.zones, f, indent=2)
                
                print(f"\n💾 Saved {len(self.zones)} zones to {self.output_file}")
                
                if len(self.zones) < self.RECOMMENDED_ZONES:
                    print(f"⚠️  Note: Only {len(self.zones)} zones drawn. " 
                          f"{self.RECOMMENDED_ZONES} recommended for best results.")
                
                break
            
            elif key == ord('q') or key == 27:  # Quit without saving
                print("\n❌ Cancelled - zones not saved")
                self.cap.release()
                cv2.destroyAllWindows()
                return False
        
        self.cap.release()
        cv2.destroyAllWindows()
        return True


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Interactive tool to draw court zones for Roundnet detection",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Controls:
  Mouse Click    Add polygon vertex
  'n'            Save current zone, start next
  'r'            Reset current zone
  'u'            Undo last point
  's'            SAVE all zones and quit
  'q' / ESC      Quit without saving

Tips:
  - Use the slider to find a frame where all 4 players are visible
  - Draw trapezoid shapes around where players stand during serves
  - Zones should cover the area where ankles are visible
        """
    )
    
    parser.add_argument(
        "video",
        help="Path to video file to use for zone drawing"
    )
    
    parser.add_argument(
        "-o", "--output",
        default="court_zones.json",
        help="Output JSON file for zone coordinates (default: court_zones.json)"
    )
    
    return parser.parse_args()


def main():
    """Main entry point."""
    args = parse_args()
    
    # Validate input
    if not Path(args.video).exists():
        print(f"❌ Error: Video file not found: {args.video}")
        sys.exit(1)
    
    # Run wizard
    wizard = ZoneWizard(args.video, args.output)
    success = wizard.run()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
