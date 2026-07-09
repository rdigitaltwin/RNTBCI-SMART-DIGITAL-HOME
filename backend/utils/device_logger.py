"""RNTBCI Smart Home Digital Twin - Per-Device Logger Utility."""

import json
import os
import datetime
from typing import Any


class DeviceLogger:
    """Manages separate JSON log files for individual devices using Matter-compliant schemas."""
    
    _log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")

    # ── Device-type to schema mapping ────────────────────────────────────
    # Maps recognisable substrings in a device name to the correct schema
    # builder.  Order matters: first match wins.
    _DEVICE_TYPE_KEYWORDS = {
        "Light":       "light",
        "Camera":      "camera",
        "Dishwasher":  "dishwasher",
        "Washing":     "dishwasher",
        "Lock":        "doorlock",
        "Garage":      "garagedoor",
        "AC":          "heatpump",
        "Heater":      "heatpump",
        "Nebulizer":   "nebulizer",
        "Router":      "router",
        "WiFi":        "router",
        "Switch":      "switch",
    }

    @classmethod
    def _resolve_device_type(cls, device_name: str) -> str:
        """Resolve a human-readable device name to a Matter device-type key."""
        for keyword, dtype in cls._DEVICE_TYPE_KEYWORDS.items():
            if keyword.lower() in device_name.lower():
                return dtype
        return "light"   # fallback

    # ── Schema builders (one per Matter device type) ─────────────────────

    @staticmethod
    def _schema_light(device_name: str, device_id: str) -> dict:
        """OnOffLight – Matter 0x0100."""
        return {
            "deviceType": {
                "id": "0x0100",
                "name": "OnOffLight",
                "device_name": device_name,
                "device_id": device_id,
                "revision": 3,
                "classification": {"class": "simple", "scope": "endpoint"},
                "endpoints": [{
                    "endpointId": 1,
                    "deviceType": "OnOffLight",
                    "clusters": [
                        {
                            "clusterId": "0x0003",
                            "name": "Identify",
                            "side": "server",
                            "mandatory": True,
                            "commands": [{
                                "commandId": "0x0040",
                                "name": "TriggerEffect",
                                "direction": "invoke",
                                "mandatory": True,
                                "request": {
                                    "effectIdentifier": "uint8",
                                    "effectVariant": "uint8"
                                }
                            }]
                        },
                        {
                            "clusterId": "0x0004",
                            "name": "Groups",
                            "side": "server",
                            "mandatory": True
                        },
                        {
                            "clusterId": "0x0006",
                            "name": "OnOff",
                            "side": "server",
                            "mandatory": True,
                            "features": [{"code": "LT", "name": "Lighting", "mandatory": True}],
                            "attributes": [{
                                "attributeId": "0x0000",
                                "name": "OnOff",
                                "type": "boolean",
                                "access": "readWrite",
                                "default": False
                            }],
                            "commands": [
                                {"commandId": "0x0000", "name": "Off"},
                                {"commandId": "0x0001", "name": "On"},
                                {"commandId": "0x0002", "name": "Toggle"}
                            ]
                        },
                        {
                            "clusterId": "0x0008",
                            "name": "LevelControl",
                            "side": "server",
                            "mandatory": False,
                            "features": [
                                {"code": "OO", "name": "OnOff", "mandatory": True},
                                {"code": "LT", "name": "Lighting", "mandatory": True}
                            ],
                            "attributes": [
                                {"attributeId": "0x0000", "name": "CurrentLevel", "type": "uint8", "range": [1, 254], "access": "readWrite"},
                                {"attributeId": "0x0002", "name": "MinLevel", "type": "uint8", "value": 1, "access": "readOnly"},
                                {"attributeId": "0x0003", "name": "MaxLevel", "type": "uint8", "value": 254, "access": "readOnly"}
                            ],
                            "commands": [{
                                "commandId": "0x0000",
                                "name": "MoveToLevel",
                                "request": {"level": "uint8", "transitionTime": "uint16"}
                            }]
                        },
                        {
                            "clusterId": "0x0062",
                            "name": "ScenesManagement",
                            "side": "server",
                            "mandatory": True,
                            "commands": [{
                                "commandId": "0x0040",
                                "name": "CopyScene",
                                "request": {"mode": "uint8", "groupId": "uint16", "sceneId": "uint8"}
                            }]
                        },
                        {
                            "clusterId": "0x0406",
                            "name": "OccupancySensing",
                            "side": "client",
                            "mandatory": False,
                            "attributes": [{
                                "attributeId": "0x0000",
                                "name": "Occupancy",
                                "type": "bitmap",
                                "description": "Indicates occupied/unoccupied state"
                            }]
                        }
                    ]
                }]
            },
            "communication_history": []
        }

    @staticmethod
    def _schema_camera(device_name: str, device_id: str) -> dict:
        """Camera – Matter 0x0142."""
        return {
            "deviceType": {
                "id": "0x0142",
                "name": "Camera",
                "device_name": device_name,
                "device_id": device_id,
                "revision": 1,
                "classification": {"class": "simple", "scope": "endpoint"},
                "endpoints": [{
                    "endpointId": 1,
                    "deviceType": "Camera",
                    "clusters": [
                        {
                            "clusterId": "0x0551",
                            "name": "CameraAVStreamManagement",
                            "side": "server",
                            "mandatory": True,
                            "attributes": [
                                {"name": "CurrentFrameRate", "type": "uint16"},
                                {"name": "MaxNetworkBandwidth", "type": "uint32"},
                                {"name": "RecordingPrivacyMode", "type": "bool"},
                                {"name": "MicrophoneMuted", "type": "bool"},
                                {"name": "SpeakerVolume", "type": "uint8"}
                            ],
                            "commands": [
                                {"name": "StartVideoStream"},
                                {"name": "StopVideoStream"},
                                {"name": "StartAudioStream"},
                                {"name": "StopAudioStream"},
                                {"name": "CaptureSnapshot"}
                            ],
                            "events": [
                                {"name": "MotionDetected"},
                                {"name": "StreamStarted"},
                                {"name": "StreamStopped"}
                            ]
                        },
                        {
                            "clusterId": "0x0801",
                            "name": "TLSCertificateManagement",
                            "side": "server",
                            "mandatory": True,
                            "attributes": [
                                {"name": "MaxRootCertificates", "type": "uint8"},
                                {"name": "MaxClientCertificates", "type": "uint8"}
                            ]
                        }
                    ]
                }]
            },
            "communication_history": []
        }

    @staticmethod
    def _schema_dishwasher(device_name: str, device_id: str) -> dict:
        """Dishwasher – Matter 0x0075."""
        return {
            "deviceType": {
                "id": "0x0075",
                "name": "Dishwasher",
                "device_name": device_name,
                "device_id": device_id,
                "revision": 2,
                "classification": {"class": "simple", "scope": "endpoint"},
                "endpoints": [{
                    "endpointId": 1,
                    "deviceType": "Dishwasher",
                    "clusters": [
                        {
                            "clusterId": "0x0006",
                            "name": "OnOff",
                            "side": "server",
                            "mandatory": False,
                            "attributes": [{"name": "PowerState", "type": "bool"}]
                        },
                        {
                            "clusterId": "0x0056",
                            "name": "TemperatureControl",
                            "side": "server",
                            "mandatory": False,
                            "attributes": [
                                {"name": "TemperatureSetpoint", "type": "temperature"},
                                {"name": "SelectedTemperatureLevel", "type": "uint8"}
                            ],
                            "commands": [{"name": "SetTemperature"}]
                        },
                        {
                            "clusterId": "0x0059",
                            "name": "DishwasherMode",
                            "side": "server",
                            "mandatory": False,
                            "attributes": [{"name": "CurrentMode", "type": "string"}]
                        },
                        {
                            "clusterId": "0x005D",
                            "name": "DishwasherAlarm",
                            "side": "server",
                            "mandatory": False,
                            "attributes": [{"name": "AlarmStatus", "type": "bitmap"}]
                        },
                        {
                            "clusterId": "0x0060",
                            "name": "OperationalState",
                            "side": "server",
                            "mandatory": True,
                            "attributes": [{"name": "CurrentState", "type": "string"}],
                            "events": [{"name": "OperationCompletion"}]
                        }
                    ]
                }]
            },
            "communication_history": []
        }

    @staticmethod
    def _schema_doorlock(device_name: str, device_id: str) -> dict:
        """DoorLock – Matter 0x000A."""
        return {
            "deviceType": {
                "id": "0x000A",
                "name": "DoorLock",
                "device_name": device_name,
                "device_id": device_id,
                "revision": 1,
                "classification": {"class": "simple", "scope": "endpoint"},
                "endpoints": [{
                    "endpointId": 1,
                    "deviceType": "DoorLock",
                    "clusters": [{
                        "clusterId": "0x0101",
                        "name": "DoorLock",
                        "side": "server",
                        "mandatory": True,
                        "features": [
                            {"code": "PIN", "name": "PINCredential"},
                            {"code": "RID", "name": "RFIDCredential"}
                        ],
                        "attributes": [
                            {"attributeId": "0x0000", "name": "LockState", "type": "LockStateEnum"},
                            {"attributeId": "0x0001", "name": "LockType", "type": "LockTypeEnum"},
                            {"attributeId": "0x0002", "name": "ActuatorEnabled", "type": "bool"}
                        ],
                        "commands": [
                            {"commandId": "0x0000", "name": "LockDoor"},
                            {"commandId": "0x0001", "name": "UnlockDoor"}
                        ]
                    }]
                }]
            },
            "communication_history": []
        }

    @staticmethod
    def _schema_garagedoor(device_name: str, device_id: str) -> dict:
        """GarageDoor – Matter 0x0601."""
        return {
            "deviceType": {
                "id": "0x0601",
                "name": "GarageDoor",
                "device_name": device_name,
                "device_id": device_id,
                "revision": 1,
                "classification": {"class": "simple", "scope": "endpoint"},
                "endpoints": [{
                    "endpointId": 1,
                    "deviceType": "GarageDoor",
                    "clusters": [
                        {
                            "clusterId": "0x2000",
                            "name": "DoorControl",
                            "side": "server",
                            "mandatory": True,
                            "attributes": [
                                {"name": "DoorState", "type": "enum"},
                                {"name": "Position", "type": "percent"},
                                {"name": "LockState", "type": "enum"}
                            ],
                            "commands": [
                                {"name": "OpenDoor"},
                                {"name": "CloseDoor"},
                                {"name": "StopDoor"},
                                {"name": "SetPosition"},
                                {"name": "LockDoor"},
                                {"name": "UnlockDoor"}
                            ]
                        },
                        {
                            "clusterId": "0x2001",
                            "name": "SafetySensors",
                            "side": "server",
                            "mandatory": True,
                            "attributes": [
                                {"name": "ObstructionDetected", "type": "bool"},
                                {"name": "SafetyBeamStatus", "type": "enum"}
                            ]
                        },
                        {
                            "clusterId": "0x2002",
                            "name": "UsageAlerts",
                            "side": "server",
                            "mandatory": False,
                            "attributes": [
                                {"name": "OpenCount", "type": "uint32"},
                                {"name": "LastOperationTime", "type": "timestamp"}
                            ]
                        },
                        {
                            "clusterId": "0x2003",
                            "name": "Connectivity",
                            "side": "server",
                            "mandatory": False,
                            "attributes": [
                                {"name": "OnlineStatus", "type": "enum"},
                                {"name": "SignalStrength", "type": "int"}
                            ]
                        }
                    ]
                }]
            },
            "communication_history": []
        }

    @staticmethod
    def _schema_heatpump(device_name: str, device_id: str) -> dict:
        """HeatPump – Matter 0x0309.  Used for AC and water heater devices."""
        return {
            "deviceType": {
                "id": "0x0309",
                "name": "HeatPump",
                "device_name": device_name,
                "device_id": device_id,
                "revision": 1,
                "classification": {"class": "simple", "scope": "endpoint"},
                "endpoints": [{
                    "endpointId": 1,
                    "deviceType": "HeatPump",
                    "clusters": [
                        {
                            "clusterId": "0x0201",
                            "name": "Thermostat",
                            "side": "server",
                            "mandatory": True,
                            "attributes": [
                                {"name": "CurrentTemperature", "type": "float", "unit": "\u00b0C"},
                                {"name": "TargetTemperature", "type": "float", "unit": "\u00b0C"},
                                {"name": "Mode", "type": "enum"},
                                {"name": "RunningState", "type": "enum"}
                            ],
                            "commands": [
                                {"name": "SetTargetTemperature"},
                                {"name": "SetMode"}
                            ]
                        },
                        {
                            "clusterId": "0x0090",
                            "name": "ElectricalPowerMeasurement",
                            "side": "server",
                            "mandatory": True,
                            "attributes": [
                                {"name": "Power", "type": "float", "unit": "W"}
                            ]
                        },
                        {
                            "clusterId": "0x0091",
                            "name": "ElectricalEnergyMeasurement",
                            "side": "server",
                            "mandatory": True,
                            "attributes": [
                                {"name": "Energy", "type": "float", "unit": "kWh"}
                            ]
                        },
                        {
                            "clusterId": "0x0041",
                            "name": "UserLabel",
                            "side": "server",
                            "mandatory": True,
                            "attributes": [
                                {"name": "Label", "type": "string"}
                            ]
                        }
                    ]
                }]
            },
            "communication_history": []
        }

    @staticmethod
    def _schema_nebulizer(device_name: str, device_id: str) -> dict:
        """Nebulizer – Matter 0x0701."""
        return {
            "deviceType": {
                "id": "0x0701",
                "name": "Nebulizer",
                "device_name": device_name,
                "device_id": device_id,
                "revision": 1,
                "classification": {"class": "simple", "scope": "endpoint"},
                "endpoints": [{
                    "endpointId": 1,
                    "deviceType": "Nebulizer",
                    "clusters": [
                        {
                            "clusterId": "0x1000",
                            "name": "NebulizerControl",
                            "side": "server",
                            "mandatory": True,
                            "attributes": [
                                {"name": "PowerState", "type": "enum"},
                                {"name": "CurrentSessionTime", "type": "uint32"},
                                {"name": "TotalUsageTime", "type": "uint32"},
                                {"name": "MistLevel", "type": "enum"}
                            ],
                            "commands": [
                                {"name": "StartSession"},
                                {"name": "PauseSession"},
                                {"name": "StopSession"},
                                {"name": "SetMistLevel"}
                            ]
                        },
                        {
                            "clusterId": "0x1001",
                            "name": "MedicationMonitoring",
                            "side": "server",
                            "mandatory": True,
                            "attributes": [
                                {"name": "MedicationLevel", "type": "percent"},
                                {"name": "MedicationStatus", "type": "enum"}
                            ]
                        },
                        {
                            "clusterId": "0x1002",
                            "name": "HealthSessionData",
                            "side": "server",
                            "mandatory": False,
                            "attributes": [
                                {"name": "LastSessionDuration", "type": "uint32"},
                                {"name": "SessionsToday", "type": "uint8"}
                            ]
                        },
                        {
                            "clusterId": "0x1003",
                            "name": "DeviceSafety",
                            "side": "server",
                            "mandatory": True,
                            "attributes": [
                                {"name": "TemperatureStatus", "type": "enum"},
                                {"name": "MaskAttached", "type": "bool"},
                                {"name": "DeviceError", "type": "enum"}
                            ]
                        }
                    ]
                }]
            },
            "communication_history": []
        }

    @staticmethod
    def _schema_router(device_name: str, device_id: str) -> dict:
        """WiFiNetworkManager – Matter 0x0090."""
        return {
            "deviceType": {
                "id": "0x0090",
                "name": "WiFiNetworkManager",
                "device_name": device_name,
                "device_id": device_id,
                "revision": 2,
                "classification": {"class": "simple", "scope": "endpoint"},
                "endpoints": [{
                    "endpointId": 1,
                    "deviceType": "WiFiNetworkManager",
                    "clusters": [{
                        "clusterId": "0x0451",
                        "name": "WiFiNetworkManagement",
                        "side": "server",
                        "mandatory": True,
                        "attributes": [
                            {"attributeId": "0x0000", "name": "SSID", "type": "string"},
                            {"attributeId": "0x0001", "name": "ConnectionStatus", "type": "enum",
                             "values": ["Disconnected", "Connecting", "Connected", "Error"]},
                            {"attributeId": "0x0002", "name": "SignalStrength", "type": "int", "unit": "dBm"}
                        ],
                        "commands": [
                            {"commandId": "0x00", "name": "ConnectNetwork"},
                            {"commandId": "0x01", "name": "DisconnectNetwork"},
                            {"commandId": "0x03", "name": "ScanNetworks"}
                        ],
                        "events": [
                            {"name": "Connected"},
                            {"name": "Disconnected"},
                            {"name": "ConnectionFailed"},
                            {"name": "SignalWeak"}
                        ]
                    }]
                }]
            },
            "communication_history": []
        }

    @staticmethod
    def _schema_switch(device_name: str, device_id: str) -> dict:
        """OnOffLightSwitch – Matter 0x0103."""
        return {
            "deviceType": {
                "id": "0x0103",
                "name": "OnOffLightSwitch",
                "device_name": device_name,
                "device_id": device_id,
                "revision": 3,
                "classification": {"class": "simple", "scope": "endpoint"},
                "endpoints": [{
                    "endpointId": 1,
                    "deviceType": "OnOffLightSwitch",
                    "clusters": [
                        {
                            "clusterId": "0x0003",
                            "name": "Identify",
                            "side": "server",
                            "mandatory": True,
                            "commands": [{
                                "commandId": "0x0040",
                                "name": "TriggerEffect",
                                "direction": "invoke",
                                "mandatory": True,
                                "request": {
                                    "effectIdentifier": "uint8",
                                    "effectVariant": "uint8"
                                }
                            }]
                        },
                        {
                            "clusterId": "0x0004",
                            "name": "Groups",
                            "side": "server",
                            "mandatory": True
                        },
                        {
                            "clusterId": "0x0006",
                            "name": "OnOff",
                            "side": "client",
                            "mandatory": True,
                            "commands": [
                                {"commandId": "0x0000", "name": "Off"},
                                {"commandId": "0x0001", "name": "On"},
                                {"commandId": "0x0002", "name": "Toggle"}
                            ]
                        }
                    ]
                }]
            },
            "communication_history": []
        }

    # ── Dispatcher ───────────────────────────────────────────────────────

    _SCHEMA_BUILDERS = {
        "light":      _schema_light.__func__,
        "camera":     _schema_camera.__func__,
        "dishwasher": _schema_dishwasher.__func__,
        "doorlock":   _schema_doorlock.__func__,
        "garagedoor": _schema_garagedoor.__func__,
        "heatpump":   _schema_heatpump.__func__,
        "nebulizer":  _schema_nebulizer.__func__,
        "router":     _schema_router.__func__,
        "switch":     _schema_switch.__func__,
    }

    @classmethod
    def _get_matter_schema(cls, device_name: str, device_id: str) -> dict:
        """Returns the correct Matter-style JSON schema for a device based on its name."""
        dtype = cls._resolve_device_type(device_name)
        builder = cls._SCHEMA_BUILDERS.get(dtype, cls._SCHEMA_BUILDERS["light"])
        return builder(device_name, device_id)

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
