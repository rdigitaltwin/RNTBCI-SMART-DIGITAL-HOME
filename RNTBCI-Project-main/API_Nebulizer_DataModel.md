# Nebulizer — Digital Twin Model & API Reference

## Device JSON Schema

```json
{
  "deviceType": {
    "id": "0x0701",
    "name": "Nebulizer",
    "revision": 1,
    "classification": { "class": "simple", "scope": "endpoint" },
    "endpoints": [
      {
        "endpointId": 1,
        "deviceType": "Nebulizer",
        "clusters": [
          {
            "clusterId": "0x1000",
            "name": "NebulizerControl",
            "side": "server",
            "mandatory": true,
            "attributes": [
              { "name": "PowerState", "type": "enum" },
              { "name": "CurrentSessionTime", "type": "uint32" },
              { "name": "TotalUsageTime", "type": "uint32" },
              { "name": "MistLevel", "type": "enum" }
            ],
            "commands": [
              { "name": "StartSession" },
              { "name": "PauseSession" },
              { "name": "StopSession" },
              { "name": "SetMistLevel" }
            ]
          },
          {
            "clusterId": "0x1001",
            "name": "MedicationMonitoring",
            "side": "server",
            "mandatory": true,
            "attributes": [
              { "name": "MedicationLevel", "type": "percent" },
              { "name": "MedicationStatus", "type": "enum" }
            ]
          },
          {
            "clusterId": "0x1002",
            "name": "HealthSessionData",
            "side": "server",
            "mandatory": false,
            "attributes": [
              { "name": "LastSessionDuration", "type": "uint32" },
              { "name": "SessionsToday", "type": "uint8" }
            ]
          },
          {
            "clusterId": "0x1003",
            "name": "DeviceSafety",
            "side": "server",
            "mandatory": true,
            "attributes": [
              { "name": "TemperatureStatus", "type": "enum" },
              { "name": "MaskAttached", "type": "bool" },
              { "name": "DeviceError", "type": "enum" }
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
| 0x1000 | NebulizerControl | server | Yes | Yes (via device GET) | Yes (`/command`) |
| 0x1001 | MedicationMonitoring | server | Yes | Yes (via device GET) | — (not documented) |
| 0x1002 | HealthSessionData | server | No | Yes (via device GET) | — (not documented) |
| 0x1003 | DeviceSafety | server | Yes | Yes (via device GET) | — (not documented) |

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
    "id": "0x0701",
    "name": "Nebulizer",
    "revision": 1,
    "classification": { "class": "simple", "scope": "endpoint" },
    "endpoints": [
      {
        "endpointId": 1,
        "deviceType": "Nebulizer",
        "clusters": [
          {
            "clusterId": "0x1000",
            "name": "NebulizerControl",
            "side": "server",
            "mandatory": true,
            "attributes": [
              { "name": "PowerState", "type": "enum" },
              { "name": "CurrentSessionTime", "type": "uint32" },
              { "name": "TotalUsageTime", "type": "uint32" },
              { "name": "MistLevel", "type": "enum" }
            ],
            "commands": [
              { "name": "StartSession" },
              { "name": "PauseSession" },
              { "name": "StopSession" },
              { "name": "SetMistLevel" }
            ]
          },
          {
            "clusterId": "0x1001",
            "name": "MedicationMonitoring",
            "side": "server",
            "mandatory": true,
            "attributes": [
              { "name": "MedicationLevel", "type": "percent" },
              { "name": "MedicationStatus", "type": "enum" }
            ]
          },
          {
            "clusterId": "0x1002",
            "name": "HealthSessionData",
            "side": "server",
            "mandatory": false,
            "attributes": [
              { "name": "LastSessionDuration", "type": "uint32" },
              { "name": "SessionsToday", "type": "uint8" }
            ]
          },
          {
            "clusterId": "0x1003",
            "name": "DeviceSafety",
            "side": "server",
            "mandatory": true,
            "attributes": [
              { "name": "TemperatureStatus", "type": "enum" },
              { "name": "MaskAttached", "type": "bool" },
              { "name": "DeviceError", "type": "enum" }
            ]
          }
        ]
      }
    ]
  }
}
```

> No separate device-level `/configuration` POST is documented for the Nebulizer (unlike the Washer). `MedicationLevel`, `MedicationStatus`, health-session data, and safety attributes have no documented write route — they appear to be read-only, reported via the aggregate device GET.

## Cluster-Level API

### NebulizerControl — Send Command

```
POST HTTP/<ip>/devices/{device_id}/endpoint/{endpoint}/cluster/{cluster}/command
```

#### StartSession

**Request body**
```json
{ "command": "StartSession" }
```

#### PauseSession

**Request body**
```json
{ "command": "PauseSession" }
```

#### StopSession

**Request body**
```json
{ "command": "StopSession" }
```

#### SetMistLevel

**Request body**
```json
{
  "command": "SetMistLevel",
  "level": "High"
}
```

## Open Items to Confirm Before Postman Testing

- **Attribute-level GET/POST** for `NebulizerControl` (`PowerState`, `CurrentSessionTime`, `TotalUsageTime`) — no dedicated routes documented; only exposed via the aggregate device GET.
- **MedicationMonitoring has no dedicated route** — `MedicationLevel` and `MedicationStatus` are clinically important (medication remaining / dispensing status) but can only be read via the full aggregate device GET, with no way to poll or subscribe to them independently.
- **DeviceSafety has no dedicated route or alerting** — `TemperatureStatus`, `MaskAttached`, and `DeviceError` are safety-relevant, but there is no documented event, webhook, or dedicated GET for surfacing a fault (e.g. overheating or a device error) outside of polling the full device GET.
- **HealthSessionData** (`LastSessionDuration`, `SessionsToday`) — optional cluster with no dedicated route; only via the aggregate device GET.
- **MistLevel enum values** — the sample uses `"High"` but the full set of supported `MistLevel` values (e.g. Low/Medium/High) is not documented.
