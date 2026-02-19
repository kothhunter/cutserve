"""
Roundnet Condenser Core Module

The brain of the automatic highlight detection system.
Provides pose detection, energy calculation, zone management, and state machine logic.
"""

from .config import Config, DEFAULT_CONFIG
from .detection import PoseDetector, DetectionResult, get_best_device
from .state_machine import StateMachine, GameState, ClipInfo, ClipClassifier
from .utils import ZoneManager, EnergyCalculator, ZoneStatus

__all__ = [
    # Configuration
    'Config',
    'DEFAULT_CONFIG',
    
    # Detection
    'PoseDetector',
    'DetectionResult',
    'get_best_device',
    
    # State Machine
    'StateMachine',
    'GameState',
    'ClipInfo',
    'ClipClassifier',
    
    # Utilities
    'ZoneManager',
    'EnergyCalculator',
    'ZoneStatus',
]

__version__ = '1.0.0'
