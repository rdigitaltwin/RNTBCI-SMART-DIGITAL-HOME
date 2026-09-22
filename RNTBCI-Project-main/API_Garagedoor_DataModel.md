# Garage Door — Digital Twin Model & API Reference

## Device JSON Schema

```json
{
  "deviceType": {
    "id": "0x0601",
    "name": "GarageDoor",
    "revision": 1,
    "classification": { "class": "simple", "scope": "endpoint" },
    "endpoints": [
      {
        "endpointId": 1,
        "deviceType": "GarageDoor",
        "clusters": [
          {
            "clusterId": "0x2000",
            "name": "DoorControl",
            "side": "server",
            "mandatory": true,
            "attributes": [
              { "name": "DoorState", "type": "enum" },
              { "name": "Position", "type": "percent" },
              { "name": "LockState", "type": "enum" }
            ],
            "commands": [
              { "name": "OpenDoor" },
              { "name": "CloseDoor" },
              { "name": "StopDoor" },
              { "name": "SetPosition" },
              { "name": "LockDoor" },
              { "name": "UnlockDoor" }
            ]
          },
          {
            "clusterId": "0x2001",
            "name": "SafetySensors",
            "side": "server",
            "mandatory": true,
            "attributes": [
              { "name": "ObstructionDetected", "type": "bool" },
              { "name": "SafetyBeamStatus", "type": "enum" }
            ]
          },
          {
            "clusterId": "0x2002",
            "name": "UsageAlerts",
            "side": "server",
            "mandatory": false,
            "attributes": [
              { "name": "OpenCount", "type": "uint32" },
              { "name": "LastOperationTime", "type": "timestamp" }
            ]
          },
          {
            "clusterId": "0x2003",
            "name": "Connectivity",
            "side": "server",
            "mandatory": false,
            "attributes": [
              { "name": "OnlineStatus", "type": "enum" },
              { "name": "SignalStrength", "type": "int" }
            ]
          }
        ]
      }
    ]
  }
}
```

## Cluster Overview

| Cluster ID | Cluster Name | Side | Mandatory | GET (device) | POST (command) |
|---|---|---|---|---|---|
| 0x2000 | DoorControl | server | Yes | Yes (via device GET) | Yes (`/command`) |
| 0x2001 | SafetySensors | server | Yes | Yes (via device GET) | — (not documented) |
| 0x2002 | UsageAlerts | server | No | Yes (via device GET) | — (not documented) |
| 0x2003 | Connectivity | server | No | Yes (via device GET) | — (not documented) |

## Device-Level API

### GET — Full device detail

Get configuration and details of the complete device data model.

```
GET HTTP/<ip>/devices/{device_id}/endpoint/{endpoint}
```

**Response**
```json
{
  "deviceType": {
    "id": "0x0601",
    "name": "GarageDoor",
    "revision": 1,
    "classification": { "class": "simple", "scope": "endpoint" },
    "endpoints": [
      {
        "endpointId": 1,
        "deviceType": "GarageDoor",
        "clusters": [
          {
            "clusterId": "0x2000",
            "name": "DoorControl",
            "side": "server",
            "mandatory": true,
            "attributes": [
              { "name": "DoorState", "type": "enum" },
              { "name": "Position", "type": "percent" },
              { "name": "LockState", "type": "enum" }
            ],
            "commands": [
              { "name": "OpenDoor" },
              { "name": "CloseDoor" },
              { "name": "StopDoor" },
              { "name": "SetPosition" },
              { "name": "LockDoor" },
              { "name": "UnlockDoor" }
            ]
          },
          {
            "clusterId": "0x2001",
            "name": "SafetySensors",
            "side": "server",
            "mandatory": true,
            "attributes": [
              { "name": "ObstructionDetected", "type": "bool" },
              { "name": "SafetyBeamStatus", "type": "enum" }
            ]
          },
          {
            "clusterId": "0x2002",
            "name": "UsageAlerts",
            "side": "server",
            "mandatory": false,
            "attributes": [
              { "name": "OpenCount", "type": "uint32" },
              { "name": "LastOperationTime", "type": "timestamp" }
            ]
          },
          {
            "clusterId": "0x2003",
            "name": "Connectivity",
            "side": "server",
            "mandatory": false,
            "attributes": [
              { "name": "OnlineStatus", "type": "enum" },
              { "name": "SignalStrength", "type": "int" }
            ]
          }
        ]
      }
    ]
  }
}
```

> No separate device-level `/configuration` POST is documented for the Garage Door (unlike the Washer). Attribute values (`DoorState`, `Position`, `LockState`, sensor/usage/connectivity attributes) have no documented write route — they appear to be read-only, reported via the aggregate device GET.

## Cluster-Level API

### DoorControl — Send Command

```
POST HTTP/<ip>/devices/{device_id}/endpoint/{endpoint}/cluster/{cluster}/command
```

#### OpenDoor

**Request body**
```json
{ "command": "OpenDoor" }
```

#### CloseDoor

**Request body**
```json
{ "command": "CloseDoor" }
```

#### StopDoor

**Request body**
```json
{ "command": "StopDoor" }
```

#### SetPosition, LockDoor, UnlockDoor

> ⚠️ These three commands are declared in the schema and cluster overview but the doc shows no sample request bodies for them. `SetPosition` likely needs a target percent value (similar in shape to `Position`); `LockDoor`/`UnlockDoor` likely mirror the Door Lock device's commands. Confirm exact payload shape with the team before Postman testing.

## Open Items to Confirm Before Postman Testing

- **SetPosition, LockDoor, UnlockDoor** — commands are declared in the schema but no sample request bodies are documented (only `OpenDoor`, `CloseDoor`, and `StopDoor` have shown bodies).
- **Attribute-level GET/POST** for `DoorControl` (`DoorState`, `Position`, `LockState`) — no dedicated routes documented; only exposed via the aggregate device GET.
- **SafetySensors, UsageAlerts, Connectivity** — all three clusters exist in the schema with their own attributes but have no dedicated GET/POST routes; only exposed via the aggregate device GET.
- **Device-level configuration POST** — the Washer has a `/configuration` endpoint for bulk attribute updates; no equivalent is documented for the Garage Door.
- **No events/alerts route** — despite `UsageAlerts` and `SafetyBeamStatus`/`ObstructionDetected` attributes existing, no subscription/webhook/polling route is documented for obstruction or safety-beam notifications.
