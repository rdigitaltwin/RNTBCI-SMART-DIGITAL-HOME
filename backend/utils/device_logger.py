"""RNTBCI Smart Home Digital Twin - Per-Device Logger Utility."""

import json
import os
import datetime
from typing import Dict, Any

class DeviceLogger:
    """Manages separate JSON log files for individual devices using a Matter-compliant schema."""
    
    _log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")

    @staticmethod
    def _get_matter_schema(device_name: str, device_id: str) -> dict:
        """Returns the base Matter-style JSON configuration schema for a smart device."""
        return {
            "deviceType": {
                "id": "0x010A",
                "name": device_name,
                "device_id": device_id,
                "revision": 4,
                "classification": {
                    "class": "simple",
                    "scope": "endpoint"
                },
                "clusters": [
                    {
                        "id": "0x0003",
                        "name": "Identify",
                        "side": "server",
                        "conformance": "mandatory",
                        "commands": [
                            {
                                "id": "0x0040",
                                "name": "TriggerEffect",
                                "conformance": "mandatory"
                            }
                        ]
                    },
                    {
                        "id": "0x0004",
                        "name": "Groups",
                        "side": "server",
                        "conformance": "mandatory"
                    },
                    {
                        "id": "0x0006",
                        "name": "On/Off",
                        "side": "server",
                        "conformance": "mandatory",
                        "features": [
                            {
                                "code": "LT",
                                "name": "Lighting",
                                "conformance": "mandatory"
                            }
                        ],
                        "attributes": [
                            {
                                "id": "0x0000",
                                "name": "OnOff",
                                "type": "bool",
                                "conformance": "mandatory"
                            },
                            {
                                "id": "0x4000",
                                "name": "GlobalSceneControl",
                                "type": "bool",
                                "conformance": "mandatory",
                                "requires": ["LT"]
                            },
                            {
                                "id": "0x4001",
                                "name": "OnTime",
                                "type": "uint16",
                                "conformance": "mandatory",
                                "requires": ["LT"]
                            },
                            {
                                "id": "0x4002",
                                "name": "OffWaitTime",
                                "type": "uint16",
                                "conformance": "mandatory",
                                "requires": ["LT"]
                            },
                            {
                                "id": "0x4003",
                                "name": "StartUpOnOff",
                                "type": "enum(StartUpOnOffEnum)",
                                "values": ["Off", "On", "Toggle"],
                                "conformance": "mandatory",
                                "requires": ["LT"]
                            }
                        ],
                        "commands": [
                            {
                                "id": "0x00",
                                "name": "Off",
                                "conformance": "mandatory"
                            },
                            {
                                "id": "0x01",
                                "name": "On",
                                "conformance": "mandatory"
                            },
                            {
                                "id": "0x02",
                                "name": "Toggle",
                                "conformance": "mandatory"
                            },
                            {
                                "id": "0x40",
                                "name": "OffWithEffect",
                                "conformance": "mandatory",
                                "requires": ["LT"],
                                "fields": [
                                    {
                                        "name": "EffectIdentifier",
                                        "type": "enum",
                                        "values": ["DelayedAllOff", "DyingLight"]
                                    },
                                    {
                                        "name": "EffectVariant",
                                        "type": "enum"
                                    }
                                ]
                            },
                            {
                                "id": "0x41",
                                "name": "OnWithRecallGlobalScene",
                                "conformance": "mandatory",
                                "requires": ["LT"]
                            },
                            {
                                "id": "0x42",
                                "name": "OnWithTimedOff",
                                "conformance": "mandatory",
                                "requires": ["LT"],
                                "fields": [
                                    {
                                        "name": "OnOffControl",
                                        "type": "bitmap",
                                        "range": [0, 1]
                                    },
                                    {
                                        "name": "OnTime",
                                        "type": "uint16",
                                        "max": 65534
                                    },
                                    {
                                        "name": "OffWaitTime",
                                        "type": "uint16",
                                        "max": 65534
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        "id": "0x0008",
                        "name": "Level Control",
                        "side": "server",
                        "conformance": "optional",
                        "features": [
                            {
                                "code": "OO",
                                "conformance": "mandatory"
                            },
                            {
                                "code": "LT",
                                "conformance": "mandatory"
                            }
                        ],
                        "attributes": [
                            {
                                "id": "0x0000",
                                "name": "CurrentLevel",
                                "type": "uint8",
                                "constraint": {
                                    "min": 1,
                                    "max": 254
                                }
                            },
                            {
                                "id": "0x0002",
                                "name": "MinLevel",
                                "type": "uint8",
                                "constraint": {
                                    "allowed": 1
                                }
                            },
                            {
                                "id": "0x0003",
                                "name": "MaxLevel",
                                "type": "uint8",
                                "constraint": {
                                    "allowed": 254
                                }
                            }
                        ]
                    }
                ]
            },
            "communication_history": []
        }

    @classmethod
    def log_communication(cls, device_id: str, device_name: str, action: str, payload: Any, source: str = "api"):
        """Log a device communication event by injecting it into the Matter schema."""
        os.makedirs(cls._log_dir, exist_ok=True)
        # Using device_name for the file name, replacing spaces with underscores for safety
        safe_name = device_name.replace(" ", "_")
        log_file = os.path.join(cls._log_dir, f"device_{safe_name}.json")
        
        # Load existing schema or create a new one
        schema = None
        if os.path.exists(log_file):
            try:
                with open(log_file, "r") as f:
                    schema = json.load(f)
            except json.JSONDecodeError:
                pass
                
        if not schema:
            schema = cls._get_matter_schema(device_name, device_id)
            
        # Ensure the history list exists
        if "communication_history" not in schema:
            schema["communication_history"] = []
            
        # Append the new event
        event = {
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "action": action,
            "payload": payload,
            "source": source
        }
        
        schema["communication_history"].append(event)
        
        # Write back to file with pretty printing
        with open(log_file, "w") as f:
            json.dump(schema, f, indent=4)
