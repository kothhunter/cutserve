"""
YOLO pose detection module.

Handles model loading, inference, and keypoint extraction.
Automatically selects the best available device (MPS > CUDA > CPU).
"""

import sys
import cv2
import numpy as np
import torch
from typing import List, Tuple, Optional
from dataclasses import dataclass

from ultralytics import YOLO

from .config import Config


def _is_packaged() -> bool:
    """Check if running inside a PyInstaller bundle."""
    return getattr(sys, 'frozen', False)


def get_best_device() -> str:
    """
    Detect the best available compute device.

    Priority:
        1. MPS (Apple Silicon M1/M2/M3) — dev only; disabled in packaged builds
           because Metal can hang without proper app entitlements.
        2. CUDA (NVIDIA GPU)
        3. CPU (fallback)

    Returns:
        Device string for YOLO/PyTorch ('mps', 'cuda', or 'cpu')
    """
    if torch.cuda.is_available():
        return 'cuda'
    if torch.backends.mps.is_available() and not _is_packaged():
        return 'mps'
    return 'cpu'


@dataclass
class DetectionResult:
    """
    Container for pose detection results from a single frame.
    
    Attributes:
        skeletons: Hip center points (cx, cy) for energy calculation
        ankles: All detected ankle positions for zone checking
        raw_keypoints: Full keypoint data for visualization (N x 17 x 3)
    """
    skeletons: List[Tuple[float, float]]
    ankles: List[Tuple[float, float]]
    raw_keypoints: Optional[np.ndarray] = None


class PoseDetector:
    """
    YOLO-based pose detector for tracking player positions.
    
    Extracts:
        - Hip centers (for energy calculation via skeleton displacement)
        - Ankles (for zone occupancy detection)
    
    Automatically uses MPS on Apple Silicon for accelerated inference.
    """
    
    # Keypoint indices for YOLO pose model (COCO format)
    LEFT_HIP = 11
    RIGHT_HIP = 12
    LEFT_ANKLE = 15
    RIGHT_ANKLE = 16
    
    def __init__(self, config: Config):
        """
        Initialize the pose detector.
        
        Args:
            config: Configuration object with model path and thresholds
        """
        self.config = config
        self.model: Optional[YOLO] = None
        self.device: str = 'cpu'
        
    def load_model(self) -> None:
        """
        Load the YOLO pose model and move to best available device.
        
        On Apple Silicon, this uses MPS for GPU acceleration.
        """
        if self.model is None:
            self.device = get_best_device()
            self.model = YOLO(self.config.model_path)
            self.model.to(self.device)
            
            if self.config.debug_mode:
                print(f"✅ Loaded pose model: {self.config.model_path}")
                print(f"   Device: {self.device.upper()}")
    
    def _parse_result(self, results) -> DetectionResult:
        """Extract DetectionResult from a single YOLO Results object."""
        skeletons = []
        ankles = []
        raw_keypoints = None

        if results.keypoints is not None:
            kp_data = results.keypoints.data
            conf_thresh = self.config.keypoint_confidence_threshold

            # Only copy to numpy for visualization; otherwise use CPU tensor (avoids extra copy)
            if self.config.show_visuals:
                raw_keypoints = kp_data.cpu().numpy()
                kp_iter = raw_keypoints
            else:
                raw_keypoints = None
                kp_iter = list(kp_data.cpu())  # Single transfer, no numpy copy

            for kp in kp_iter:
                if len(kp) == 0:
                    continue

                # Extract hip center for energy tracking
                left_hip = kp[self.LEFT_HIP]
                right_hip = kp[self.RIGHT_HIP]
                lh_conf = float(left_hip[2])
                rh_conf = float(right_hip[2])

                if lh_conf > conf_thresh and rh_conf > conf_thresh:
                    cx = (float(left_hip[0]) + float(right_hip[0])) / 2
                    cy = (float(left_hip[1]) + float(right_hip[1])) / 2
                    skeletons.append((cx, cy))

                # Extract ankles for zone detection
                left_ankle = kp[self.LEFT_ANKLE]
                right_ankle = kp[self.RIGHT_ANKLE]

                if float(left_ankle[2]) > conf_thresh:
                    ankles.append((float(left_ankle[0]), float(left_ankle[1])))
                if float(right_ankle[2]) > conf_thresh:
                    ankles.append((float(right_ankle[0]), float(right_ankle[1])))

        return DetectionResult(
            skeletons=skeletons,
            ankles=ankles,
            raw_keypoints=raw_keypoints
        )

    def detect(self, frame: np.ndarray) -> DetectionResult:
        """
        Run pose detection on a single frame.

        Args:
            frame: BGR image (numpy array) - should be already downscaled

        Returns:
            DetectionResult with extracted skeletons and ankles
        """
        results = self.detect_batch([frame])
        return results[0]

    def detect_batch(self, frames: List[np.ndarray]) -> List[DetectionResult]:
        """
        Run pose detection on a batch of frames for improved GPU throughput.

        Args:
            frames: List of BGR images (numpy arrays) - should be already downscaled

        Returns:
            List of DetectionResult, one per input frame
        """
        if not frames:
            return []

        if self.model is None:
            self.load_model()

        # Use FP16 for faster inference on GPU (CUDA/MPS); skip on CPU
        use_half = self.device in ('cuda', 'mps')

        # Run batched inference
        results_list = self.model(
            frames,
            verbose=False,
            device=self.device,
            half=use_half
        )

        # Ultralytics returns list of Results for list input
        return [self._parse_result(r) for r in results_list]
    
    def get_device(self) -> str:
        """Get the device being used for inference."""
        return self.device
