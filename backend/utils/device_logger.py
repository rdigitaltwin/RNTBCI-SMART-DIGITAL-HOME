"""RNTBCI Smart Home Digital Twin - Per-Device Logger Utility."""

import logging
import os
from typing import Dict, Any
from pythonjsonlogger import jsonlogger

class DeviceLogger:
    """Manages separate JSON log files for individual devices."""
    
    _loggers: Dict[str, logging.Logger] = {}
    _log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")

    @classmethod
    def _get_logger(cls, device_id: str) -> logging.Logger:
        if device_id in cls._loggers:
            return cls._loggers[device_id]

        os.makedirs(cls._log_dir, exist_ok=True)
        log_file = os.path.join(cls._log_dir, f"device_{device_id}.json")
        
        logger = logging.getLogger(f"device.{device_id}")
        logger.setLevel(logging.INFO)
        
        # Avoid duplicate handlers if logger was already created by logging internals
        if not logger.handlers:
            file_handler = logging.FileHandler(log_file)
            formatter = jsonlogger.JsonFormatter('%(asctime)s %(levelname)s %(name)s %(message)s')
            file_handler.setFormatter(formatter)
            logger.addHandler(file_handler)
            
            # Prevent propagating to the root logger to avoid duplicate logs in system.log
            logger.propagate = False
            
        cls._loggers[device_id] = logger
        return logger

    @classmethod
    def log_communication(cls, device_id: str, action: str, payload: Any, source: str = "api"):
        """Log a device communication event."""
        logger = cls._get_logger(device_id)
        logger.info(
            f"Device {device_id} communication",
            extra={
                "device_id": device_id,
                "action": action,
                "payload": payload,
                "source": source
            }
        )
