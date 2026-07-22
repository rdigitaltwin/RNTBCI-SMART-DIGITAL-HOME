#!/usr/bin/env python3
"""Migrate device JSON files to the new per-device-type Matter schemas.

Preserves existing communication_history while replacing the deviceType
schema with the spec-compliant structure.

Usage:  python3.13 migrate_matter_schemas.py
"""

import json
import os

LOGS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend", "data")

# ── Device-type keyword mapping ──────────────────────────────────────────
DEVICE_TYPE_KEYWORDS = {
    "Light":      "light",
    "Camera":     "camera",
    "Dishwasher": "dishwasher",
    "Washing":    "dishwasher",
    "Lock":       "doorlock",
    "Garage":     "garagedoor",
    "AC":         "heatpump",
    "Heater":     "heatpump",
    "Nebulizer":  "nebulizer",
    "Router":     "router",
    "WiFi":       "router",
    "Switch":     "switch",
}


def resolve_type(name: str) -> str:
    for kw, dtype in DEVICE_TYPE_KEYWORDS.items():
        if kw.lower() in name.lower():
            return dtype
    return "light"


# ── Schema builders ─────────────────────────────────────────────────────

def schema_light(dn, did):
    return {
        "deviceType": {
            "id": "0x0100", "name": "OnOffLight", "device_name": dn, "device_id": did,
            "revision": 3, "classification": {"class": "simple", "scope": "endpoint"},
            "endpoints": [{"endpointId": 1, "deviceType": "OnOffLight", "clusters": [
                {"clusterId": "0x0003", "name": "Identify", "side": "server", "mandatory": True,
                 "commands": [{"commandId": "0x0040", "name": "TriggerEffect", "direction": "invoke",
                               "mandatory": True, "request": {"effectIdentifier": "uint8", "effectVariant": "uint8"}}]},
                {"clusterId": "0x0004", "name": "Groups", "side": "server", "mandatory": True},
                {"clusterId": "0x0006", "name": "OnOff", "side": "server", "mandatory": True,
                 "features": [{"code": "LT", "name": "Lighting", "mandatory": True}],
                 "attributes": [{"attributeId": "0x0000", "name": "OnOff", "type": "boolean", "access": "readWrite", "default": False}],
                 "commands": [{"commandId": "0x0000", "name": "Off"}, {"commandId": "0x0001", "name": "On"}, {"commandId": "0x0002", "name": "Toggle"}]},
                {"clusterId": "0x0008", "name": "LevelControl", "side": "server", "mandatory": False,
                 "features": [{"code": "OO", "name": "OnOff", "mandatory": True}, {"code": "LT", "name": "Lighting", "mandatory": True}],
                 "attributes": [
                     {"attributeId": "0x0000", "name": "CurrentLevel", "type": "uint8", "range": [1, 254], "access": "readWrite"},
                     {"attributeId": "0x0002", "name": "MinLevel", "type": "uint8", "value": 1, "access": "readOnly"},
                     {"attributeId": "0x0003", "name": "MaxLevel", "type": "uint8", "value": 254, "access": "readOnly"}],
                 "commands": [{"commandId": "0x0000", "name": "MoveToLevel", "request": {"level": "uint8", "transitionTime": "uint16"}}]},
                {"clusterId": "0x0062", "name": "ScenesManagement", "side": "server", "mandatory": True,
                 "commands": [{"commandId": "0x0040", "name": "CopyScene", "request": {"mode": "uint8", "groupId": "uint16", "sceneId": "uint8"}}]},
                {"clusterId": "0x0406", "name": "OccupancySensing", "side": "client", "mandatory": False,
                 "attributes": [{"attributeId": "0x0000", "name": "Occupancy", "type": "bitmap", "description": "Indicates occupied/unoccupied state"}]}
            ]}]
        }, "communication_history": []
    }

def schema_camera(dn, did):
    return {
        "deviceType": {
            "id": "0x0142", "name": "Camera", "device_name": dn, "device_id": did,
            "revision": 1, "classification": {"class": "simple", "scope": "endpoint"},
            "endpoints": [{"endpointId": 1, "deviceType": "Camera", "clusters": [
                {"clusterId": "0x0551", "name": "CameraAVStreamManagement", "side": "server", "mandatory": True,
                 "attributes": [{"name": "CurrentFrameRate", "type": "uint16"}, {"name": "MaxNetworkBandwidth", "type": "uint32"},
                                {"name": "RecordingPrivacyMode", "type": "bool"}, {"name": "MicrophoneMuted", "type": "bool"},
                                {"name": "SpeakerVolume", "type": "uint8"}],
                 "commands": [{"name": "StartVideoStream"}, {"name": "StopVideoStream"}, {"name": "StartAudioStream"},
                              {"name": "StopAudioStream"}, {"name": "CaptureSnapshot"}],
                 "events": [{"name": "MotionDetected"}, {"name": "StreamStarted"}, {"name": "StreamStopped"}]},
                {"clusterId": "0x0801", "name": "TLSCertificateManagement", "side": "server", "mandatory": True,
                 "attributes": [{"name": "MaxRootCertificates", "type": "uint8"}, {"name": "MaxClientCertificates", "type": "uint8"}]}
            ]}]
        }, "communication_history": []
    }

def schema_dishwasher(dn, did):
    return {
        "deviceType": {
            "id": "0x0075", "name": "Dishwasher", "device_name": dn, "device_id": did,
            "revision": 2, "classification": {"class": "simple", "scope": "endpoint"},
            "endpoints": [{"endpointId": 1, "deviceType": "Dishwasher", "clusters": [
                {"clusterId": "0x0006", "name": "OnOff", "side": "server", "mandatory": False,
                 "attributes": [{"name": "PowerState", "type": "bool"}]},
                {"clusterId": "0x0056", "name": "TemperatureControl", "side": "server", "mandatory": False,
                 "attributes": [{"name": "TemperatureSetpoint", "type": "temperature"}, {"name": "SelectedTemperatureLevel", "type": "uint8"}],
                 "commands": [{"name": "SetTemperature"}]},
                {"clusterId": "0x0059", "name": "DishwasherMode", "side": "server", "mandatory": False,
                 "attributes": [{"name": "CurrentMode", "type": "string"}]},
                {"clusterId": "0x005D", "name": "DishwasherAlarm", "side": "server", "mandatory": False,
                 "attributes": [{"name": "AlarmStatus", "type": "bitmap"}]},
                {"clusterId": "0x0060", "name": "OperationalState", "side": "server", "mandatory": True,
                 "attributes": [{"name": "CurrentState", "type": "string"}],
                 "events": [{"name": "OperationCompletion"}]}
            ]}]
        }, "communication_history": []
    }

def schema_doorlock(dn, did):
    return {
        "deviceType": {
            "id": "0x000A", "name": "DoorLock", "device_name": dn, "device_id": did,
            "revision": 1, "classification": {"class": "simple", "scope": "endpoint"},
            "endpoints": [{"endpointId": 1, "deviceType": "DoorLock", "clusters": [
                {"clusterId": "0x0101", "name": "DoorLock", "side": "server", "mandatory": True,
                 "features": [{"code": "PIN", "name": "PINCredential"}, {"code": "RID", "name": "RFIDCredential"}],
                 "attributes": [{"attributeId": "0x0000", "name": "LockState", "type": "LockStateEnum"},
                                {"attributeId": "0x0001", "name": "LockType", "type": "LockTypeEnum"},
                                {"attributeId": "0x0002", "name": "ActuatorEnabled", "type": "bool"}],
                 "commands": [{"commandId": "0x0000", "name": "LockDoor"}, {"commandId": "0x0001", "name": "UnlockDoor"}]}
            ]}]
        }, "communication_history": []
    }

def schema_garagedoor(dn, did):
    return {
        "deviceType": {
            "id": "0x0601", "name": "GarageDoor", "device_name": dn, "device_id": did,
            "revision": 1, "classification": {"class": "simple", "scope": "endpoint"},
            "endpoints": [{"endpointId": 1, "deviceType": "GarageDoor", "clusters": [
                {"clusterId": "0x2000", "name": "DoorControl", "side": "server", "mandatory": True,
                 "attributes": [{"name": "DoorState", "type": "enum"}, {"name": "Position", "type": "percent"}, {"name": "LockState", "type": "enum"}],
                 "commands": [{"name": "OpenDoor"}, {"name": "CloseDoor"}, {"name": "StopDoor"}, {"name": "SetPosition"}, {"name": "LockDoor"}, {"name": "UnlockDoor"}]},
                {"clusterId": "0x2001", "name": "SafetySensors", "side": "server", "mandatory": True,
                 "attributes": [{"name": "ObstructionDetected", "type": "bool"}, {"name": "SafetyBeamStatus", "type": "enum"}]},
                {"clusterId": "0x2002", "name": "UsageAlerts", "side": "server", "mandatory": False,
                 "attributes": [{"name": "OpenCount", "type": "uint32"}, {"name": "LastOperationTime", "type": "timestamp"}]},
                {"clusterId": "0x2003", "name": "Connectivity", "side": "server", "mandatory": False,
                 "attributes": [{"name": "OnlineStatus", "type": "enum"}, {"name": "SignalStrength", "type": "int"}]}
            ]}]
        }, "communication_history": []
    }

def schema_heatpump(dn, did):
    return {
        "deviceType": {
            "id": "0x0309", "name": "HeatPump", "device_name": dn, "device_id": did,
            "revision": 1, "classification": {"class": "simple", "scope": "endpoint"},
            "endpoints": [{"endpointId": 1, "deviceType": "HeatPump", "clusters": [
                {"clusterId": "0x0201", "name": "Thermostat", "side": "server", "mandatory": True,
                 "attributes": [{"name": "CurrentTemperature", "type": "float", "unit": "\u00b0C"},
                                {"name": "TargetTemperature", "type": "float", "unit": "\u00b0C"},
                                {"name": "Mode", "type": "enum"}, {"name": "RunningState", "type": "enum"}],
                 "commands": [{"name": "SetTargetTemperature"}, {"name": "SetMode"}]},
                {"clusterId": "0x0090", "name": "ElectricalPowerMeasurement", "side": "server", "mandatory": True,
                 "attributes": [{"name": "Power", "type": "float", "unit": "W"}]},
                {"clusterId": "0x0091", "name": "ElectricalEnergyMeasurement", "side": "server", "mandatory": True,
                 "attributes": [{"name": "Energy", "type": "float", "unit": "kWh"}]},
                {"clusterId": "0x0041", "name": "UserLabel", "side": "server", "mandatory": True,
                 "attributes": [{"name": "Label", "type": "string"}]}
            ]}]
        }, "communication_history": []
    }

def schema_nebulizer(dn, did):
    return {
        "deviceType": {
            "id": "0x0701", "name": "Nebulizer", "device_name": dn, "device_id": did,
            "revision": 1, "classification": {"class": "simple", "scope": "endpoint"},
            "endpoints": [{"endpointId": 1, "deviceType": "Nebulizer", "clusters": [
                {"clusterId": "0x1000", "name": "NebulizerControl", "side": "server", "mandatory": True,
                 "attributes": [{"name": "PowerState", "type": "enum"}, {"name": "CurrentSessionTime", "type": "uint32"},
                                {"name": "TotalUsageTime", "type": "uint32"}, {"name": "MistLevel", "type": "enum"}],
                 "commands": [{"name": "StartSession"}, {"name": "PauseSession"}, {"name": "StopSession"}, {"name": "SetMistLevel"}]},
                {"clusterId": "0x1001", "name": "MedicationMonitoring", "side": "server", "mandatory": True,
                 "attributes": [{"name": "MedicationLevel", "type": "percent"}, {"name": "MedicationStatus", "type": "enum"}]},
                {"clusterId": "0x1002", "name": "HealthSessionData", "side": "server", "mandatory": False,
                 "attributes": [{"name": "LastSessionDuration", "type": "uint32"}, {"name": "SessionsToday", "type": "uint8"}]},
                {"clusterId": "0x1003", "name": "DeviceSafety", "side": "server", "mandatory": True,
                 "attributes": [{"name": "TemperatureStatus", "type": "enum"}, {"name": "MaskAttached", "type": "bool"}, {"name": "DeviceError", "type": "enum"}]}
            ]}]
        }, "communication_history": []
    }

def schema_router(dn, did):
    return {
        "deviceType": {
            "id": "0x0090", "name": "WiFiNetworkManager", "device_name": dn, "device_id": did,
            "revision": 2, "classification": {"class": "simple", "scope": "endpoint"},
            "endpoints": [{"endpointId": 1, "deviceType": "WiFiNetworkManager", "clusters": [
                {"clusterId": "0x0451", "name": "WiFiNetworkManagement", "side": "server", "mandatory": True,
                 "attributes": [{"attributeId": "0x0000", "name": "SSID", "type": "string"},
                                {"attributeId": "0x0001", "name": "ConnectionStatus", "type": "enum", "values": ["Disconnected", "Connecting", "Connected", "Error"]},
                                {"attributeId": "0x0002", "name": "SignalStrength", "type": "int", "unit": "dBm"}],
                 "commands": [{"commandId": "0x00", "name": "ConnectNetwork"}, {"commandId": "0x01", "name": "DisconnectNetwork"}, {"commandId": "0x03", "name": "ScanNetworks"}],
                 "events": [{"name": "Connected"}, {"name": "Disconnected"}, {"name": "ConnectionFailed"}, {"name": "SignalWeak"}]}
            ]}]
        }, "communication_history": []
    }

def schema_switch(dn, did):
    return {
        "deviceType": {
            "id": "0x0103", "name": "OnOffLightSwitch", "device_name": dn, "device_id": did,
            "revision": 3, "classification": {"class": "simple", "scope": "endpoint"},
            "endpoints": [{"endpointId": 1, "deviceType": "OnOffLightSwitch", "clusters": [
                {"clusterId": "0x0003", "name": "Identify", "side": "server", "mandatory": True,
                 "commands": [{"commandId": "0x0040", "name": "TriggerEffect", "direction": "invoke", "mandatory": True,
                               "request": {"effectIdentifier": "uint8", "effectVariant": "uint8"}}]},
                {"clusterId": "0x0004", "name": "Groups", "side": "server", "mandatory": True},
                {"clusterId": "0x0006", "name": "OnOff", "side": "client", "mandatory": True,
                 "commands": [{"commandId": "0x0000", "name": "Off"}, {"commandId": "0x0001", "name": "On"}, {"commandId": "0x0002", "name": "Toggle"}]}
            ]}]
        }, "communication_history": []
    }


BUILDERS = {
    "light": schema_light, "camera": schema_camera, "dishwasher": schema_dishwasher,
    "doorlock": schema_doorlock, "garagedoor": schema_garagedoor, "heatpump": schema_heatpump,
    "nebulizer": schema_nebulizer, "router": schema_router, "switch": schema_switch,
}


def migrate(filepath):
    fn = os.path.basename(filepath)
    with open(filepath, "r") as f:
        old = json.load(f)

    dt = old.get("deviceType", {})
    name = dt.get("name", fn.replace("device_", "").replace(".json", "").replace("_", " "))
    did = dt.get("device_id", "unknown")
    hist = old.get("communication_history", [])

    dtype = resolve_type(name)
    builder = BUILDERS.get(dtype, BUILDERS["light"])
    new = builder(name, did)
    new["communication_history"] = hist

    with open(filepath, "w") as f:
        json.dump(new, f, indent=4)
    print(f"  \u2705 {fn} -> {dtype} ({len(hist)} history entries)")


def main():
    print("=== Migrating device JSON files to Matter spec schemas ===\n")
    count = 0
    for fn in sorted(os.listdir(LOGS_DIR)):
        if fn.startswith("device_") and fn.endswith(".json"):
            migrate(os.path.join(LOGS_DIR, fn))
            count += 1
    print(f"\n=== Done: {count} files migrated ===")


if __name__ == "__main__":
    main()
