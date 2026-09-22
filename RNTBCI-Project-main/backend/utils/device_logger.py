"""RNTBCI Smart Home Digital Twin - Per-Device Logger Utility."""

import json
import os
import datetime
from typing import Any


class DeviceLogger:
    """Manages separate JSON log files for individual devices using Matter-compliant schemas."""
    
    _log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")

    # ── Device-type to schema mapping ────────────────────────────────────
    # Maps recognisable substrings in a device name to the correct schema
    # builder.  Order matters: first match wins.
    _DEVICE_TYPE_KEYWORDS = {
        "Charger":     "evse",
        "EVSE":        "evse",
        "Light":       "light",
        "Camera":      "camera",
        "Dishwasher":  "dishwasher",
        "Washing":     "dishwasher",
        "Lock":        "doorlock",
        "Heater":      "heatpump",
        "Switch":      "switch",
        "Solar":       "solar",
        "PV":          "solar",
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

    @staticmethod
    def _schema_evse(device_name: str, device_id: str) -> dict:
        """EnergyEVSE – Matter 0x050C."""
        return {
            "deviceType": {
                "id": "0x050C",
                "name": "EnergyEVSE",
                "device_name": device_name,
                "device_id": device_id,
                "revision": 2,
                "classification": {"class": "simple", "scope": "endpoint"},
                "endpoints": [{
                    "endpointId": 1,
                    "deviceType": "EnergyEVSE",
                    "clusters": [
                        {
                            "clusterId": "0x0003",
                            "name": "Identify",
                            "side": "server",
                            "mandatory": False,
                            "commands": [{
                                "commandId": "0x0040",
                                "name": "TriggerEffect",
                                "direction": "invoke",
                                "fields": [
                                    {"name": "EffectIdentifier", "type": "enum8"},
                                    {"name": "EffectVariant", "type": "enum8"}
                                ]
                            }]
                        },
                        {
                            "clusterId": "0x0099",
                            "name": "EnergyEVSE",
                            "side": "server",
                            "mandatory": True,
                            "attributes": [
                                {"name": "State", "type": "enum", "value": "NotPluggedIn"},
                                {"name": "SupplyState", "type": "enum", "value": "Disabled"},
                                {"name": "FaultState", "type": "enum", "value": "NoError"},
                                {"name": "ChargingEnabledUntil", "type": "epoch-s", "value": None},
                                {"name": "MinimumChargeCurrent", "type": "int64", "unit": "mA", "value": 6000},
                                {"name": "MaximumChargeCurrent", "type": "int64", "unit": "mA", "value": 80000},
                                {"name": "UserMaximumChargeCurrent", "type": "int64", "unit": "mA", "value": 80000},
                                {"name": "SessionDuration", "type": "elapsed-s", "unit": "s", "value": 0},
                                {"name": "SessionEnergyCharged", "type": "energy-mWh", "unit": "mWh", "value": 0},
                                {"name": "StateOfCharge", "type": "percent", "unit": "%", "value": None},
                                {"name": "NextChargeStartTime", "type": "epoch-s", "unit": "s", "value": None},
                                {"name": "NextChargeTargetTime", "type": "epoch-s", "unit": "s", "value": None},
                                {"name": "NextChargeRequiredEnergy", "type": "energy-mWh", "unit": "mWh", "value": None},
                                {"name": "NextChargeTargetSoC", "type": "percent", "unit": "%", "value": None}
                            ],
                            "commands": [
                                {"commandId": "0x01", "name": "Disable", "direction": "invoke", "fields": []},
                                {
                                    "commandId": "0x02",
                                    "name": "EnableCharging",
                                    "direction": "invoke",
                                    "fields": [
                                        {"name": "ChargingEnabledUntil", "type": "epoch-s"},
                                        {"name": "MinimumChargeCurrent", "type": "int64"},
                                        {"name": "MaximumChargeCurrent", "type": "int64"}
                                    ]
                                },
                                {
                                    "commandId": "0x03",
                                    "name": "EnableDischarging",
                                    "direction": "invoke",
                                    "fields": [
                                        {"name": "DischargingEnabledUntil", "type": "epoch-s"},
                                        {"name": "MaximumDischargeCurrent", "type": "int64"}
                                    ]
                                },
                                {"commandId": "0x04", "name": "StartDiagnostics", "direction": "invoke", "fields": []},
                                {
                                    "commandId": "0x05",
                                    "name": "SetTargets",
                                    "direction": "invoke",
                                    "fields": [{"name": "ChargingTargetSchedules", "type": "list"}]
                                },
                                {"commandId": "0x06", "name": "GetTargets", "direction": "invoke", "fields": []},
                                {"commandId": "0x07", "name": "ClearTargets", "direction": "invoke", "fields": []}
                            ],
                            "events": [
                                {"name": "EVConnected", "priority": "info"},
                                {"name": "EVNotDetected", "priority": "info"},
                                {"name": "EnergyTransferStarted", "priority": "info"},
                                {"name": "EnergyTransferStopped", "priority": "info"},
                                {"name": "Fault", "priority": "critical"},
                                {"name": "RFID", "priority": "info"}
                            ],
                            "features": [
                                {"bit": 0, "name": "ChargingPreferences"},
                                {"bit": 1, "name": "SoCReporting"},
                                {"bit": 2, "name": "PlugAndCharge"},
                                {"bit": 3, "name": "RFID"},
                                {"bit": 4, "name": "V2X"}
                            ]
                        },
                        {
                            "clusterId": "0x009D",
                            "name": "EnergyEVSEMode",
                            "side": "server",
                            "mandatory": True,
                            "attributes": [
                                {
                                    "name": "SupportedModes",
                                    "type": "list",
                                    "value": [
                                        {"label": "Manual", "mode": 0},
                                        {"label": "TimeOfUse", "mode": 1},
                                        {"label": "SolarCharging", "mode": 2}
                                    ]
                                },
                                {"name": "CurrentMode", "type": "uint8", "value": 0}
                            ],
                            "commands": [{
                                "commandId": "0x00",
                                "name": "ChangeToMode",
                                "direction": "invoke",
                                "fields": [{"name": "NewMode", "type": "uint8"}]
                            }]
                        },
                        {
                            "clusterId": "0x0090",
                            "name": "ElectricalPowerMeasurement",
                            "side": "server",
                            "mandatory": True,
                            "attributes": [
                                {"name": "PowerMode", "type": "enum", "value": "AC"},
                                {"name": "Voltage", "type": "int64", "unit": "mV", "value": 230000},
                                {"name": "ActiveCurrent", "type": "int64", "unit": "mA", "value": 0},
                                {"name": "ActivePower", "type": "int64", "unit": "mW", "value": 0},
                                {"name": "Frequency", "type": "int64", "unit": "mHz", "value": 50000},
                                {"name": "PowerFactor", "type": "int64", "value": 100}
                            ]
                        },
                        {
                            "clusterId": "0x0091",
                            "name": "ElectricalEnergyMeasurement",
                            "side": "server",
                            "mandatory": True,
                            "attributes": [
                                {"name": "CumulativeEnergyImported", "type": "energy-mWh", "unit": "mWh", "value": 0},
                                {"name": "CumulativeEnergyExported", "type": "energy-mWh", "unit": "mWh", "value": 0},
                                {"name": "PeriodicEnergyImported", "type": "energy-mWh", "unit": "mWh", "value": 0},
                                {"name": "PeriodicEnergyExported", "type": "energy-mWh", "unit": "mWh", "value": 0}
                            ]
                        }
                    ]
                }]
            },
            "communication_history": []
        }

    # ── Dispatcher ───────────────────────────────────────────────────────

    @staticmethod
    def _schema_solar(device_name: str, device_id: str) -> dict:
        """SolarPV – Matter 0x0017 (Electrical Measurement / Energy)."""
        return {
            "deviceType": {
                "id": "0x0017",
                "name": "SolarPV",
                "device_name": device_name,
                "device_id": device_id,
                "revision": 1,
                "classification": {"class": "simple", "scope": "endpoint"},
                "endpoints": [{
                    "endpointId": 1,
                    "deviceType": "SolarPV",
                    "clusters": [
                        {
                            "clusterId": "0x0003",
                            "name": "Identify",
                            "side": "server",
                            "mandatory": True,
                            "commands": [{"commandId": "0x0040", "name": "TriggerEffect"}]
                        },
                        {
                            "clusterId": "0x0000",
                            "name": "UserLabel",
                            "side": "server",
                            "attributes": [{"name": "LabelList", "value": [{"label": "Name", "value": "SolarArray01"}]}]
                        },
                        {
                            "clusterId": "0x0b04",
                            "name": "ElectricalMeasurement",
                            "side": "server",
                            "attributes": [
                                {"name": "Voltage", "value": 230000},
                                {"name": "ActiveCurrent", "value": 20400},
                                {"name": "ActivePower", "value": 4690000},
                                {"name": "Frequency", "value": 50000},
                                {"name": "PowerFactor", "value": 98}
                            ]
                        },
                        {
                            "clusterId": "0x0090",
                            "name": "ElectricalEnergyMeasurement",
                            "side": "server",
                            "attributes": [
                                {"name": "CumulativeEnergyExported", "value": 15200000}
                            ]
                        }
                    ]
                }]
            }
        }

    _SCHEMA_BUILDER_MAP: dict[str, str] = {
        "evse":       "_schema_evse",
        "light":      "_schema_light",
        "camera":     "_schema_camera",
        "dishwasher": "_schema_dishwasher",
        "doorlock":   "_schema_doorlock",
        "heatpump":   "_schema_heatpump",
        "switch":     "_schema_switch",
        "solar":      "_schema_solar",
    }

    @classmethod
    def _get_matter_schema(cls, device_name: str, device_id: str) -> dict:
        """Returns the correct Matter-style JSON schema for a device based on its name."""
        dtype = cls._resolve_device_type(device_name)
        method_name = cls._SCHEMA_BUILDER_MAP.get(dtype, "_schema_light")
        builder = getattr(cls, method_name)
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
                    
                # Auto-migrate old schemas that might be stuck on Railway's persistent volume
                if schema and "endpoints" not in schema.get("deviceType", {}):
                    # Keep the history, but upgrade the schema format
                    history = schema.get("communication_history", [])
                    schema = cls._get_matter_schema(device_name, device_id)
                    schema["communication_history"] = history
            except json.JSONDecodeError:
                pass
                
        if not schema:
            schema = cls._get_matter_schema(device_name, device_id)
            
        # Ensure the history list exists
        if "communication_history" not in schema:
            schema["communication_history"] = []
            
        # Append the new event
        # Use IST (Indian Standard Time, UTC+5:30)
        IST = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
        event = {
            "timestamp": datetime.datetime.now(IST).isoformat(),
            "action": action,
            "payload": payload,
            "source": source
        }
        
        schema["communication_history"].append(event)
        
        # Write back to file with pretty printing
        with open(log_file, "w") as f:
            json.dump(schema, f, indent=4)
