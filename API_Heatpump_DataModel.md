# Heat Pump — Digital Twin Model & API Reference

## Device JSON Schema

```json
{
  "deviceType": {
    "id": "0x0309",
    "name": "HeatPump",
    "device_name": "Living Room AC",
    "device_id": "01c77ecf-f367-4c45-b5d9-6b0bfb33d703",
    "revision": 1,
    "classification": { "class": "simple", "scope": "endpoint" },
    "endpoints": [
      {
        "endpointId": 1,
        "deviceType": "HeatPump",
        "clusters": [
          {
            "clusterId": "0x0201",
            "name": "Thermostat",
            "side": "server",
            "mandatory": true,
            "attributes": [
              { "name": "CurrentTemperature", "type": "float", "unit": "°C" },
              { "name": "TargetTemperature", "type": "float", "unit": "°C" },
              { "name": "Mode", "type": "enum" },
              { "name": "RunningState", "type": "enum" }
            ],
            "commands": [
              { "name": "SetTargetTemperature" },
              { "name": "SetMode" }
            ]
          },
          {
            "clusterId": "0x0090",
            "name": "ElectricalPowerMeasurement",
            "side": "server",
            "mandatory": true,
            "attributes": [
              { "name": "Power", "type": "float", "unit": "W" }
            ]
          },
          {
            "clusterId": "0x0091",
            "name": "ElectricalEnergyMeasurement",
            "side": "server",
            "mandatory": true,
            "attributes": [
              { "name": "Energy", "type": "float", "unit": "kWh" }
            ]
          },
          {
            "clusterId": "0x0041",
            "name": "UserLabel",
            "side": "server",
            "mandatory": true,
            "attributes": [
              { "name": "Label", "type": "string" }
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
| 0x0201 | Thermostat | server | Yes | Yes (via device GET) | Yes (`/command`) |
| 0x0090 | ElectricalPowerMeasurement | server | Yes | Yes (via device GET) | — (not documented) |
| 0x0091 | ElectricalEnergyMeasurement | server | Yes | Yes (via device GET) | — (not documented) |
| 0x0041 | UserLabel | server | Yes | Yes (via device GET) | — (not documented) |

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
    "id": "0x0309",
    "name": "HeatPump",
    "revision": 1,
    "classification": { "class": "simple", "scope": "endpoint" },
    "endpoints": [
      {
        "endpointId": 1,
        "deviceType": "HeatPump",
        "clusters": [
          {
            "clusterId": "0x0201",
            "name": "Thermostat",
            "side": "server",
            "mandatory": true,
            "attributes": [
              { "name": "CurrentTemperature", "type": "float", "unit": "°C" },
              { "name": "TargetTemperature", "type": "float", "unit": "°C" },
              { "name": "Mode", "type": "enum" },
              { "name": "RunningState", "type": "enum" }
            ],
            "commands": [
              { "name": "SetTargetTemperature" },
              { "name": "SetMode" }
            ]
          },
          {
            "clusterId": "0x0090",
            "name": "ElectricalPowerMeasurement",
            "side": "server",
            "mandatory": true,
            "attributes": [
              { "name": "Power", "type": "float", "unit": "W" }
            ]
          },
          {
            "clusterId": "0x0091",
            "name": "ElectricalEnergyMeasurement",
            "side": "server",
            "mandatory": true,
            "attributes": [
              { "name": "Energy", "type": "float", "unit": "kWh" }
            ]
          },
          {
            "clusterId": "0x0041",
            "name": "UserLabel",
            "side": "server",
            "mandatory": true,
            "attributes": [
              { "name": "Label", "type": "string" }
            ]
          }
        ]
      }
    ]
  }
}
```

> No separate device-level `/configuration` POST is documented for the Heat Pump (unlike the Washer). `Power`, `Energy`, and `Label` have no documented write route — `Power`/`Energy` are presumably read-only measurements; `Label` may need a settable route (unconfirmed).

## Cluster-Level API

### Thermostat — Send Command

```
POST HTTP/<ip>/devices/{device_id}/endpoint/{endpoint}/cluster/{cluster}/command
```

#### SetTargetTemperature

**Request body**
```json
{
  "command": "SetTargetTemperature",
  "temperature": 23.0
}
```

#### SetMode

**Request body**
```json
{
  "command": "SetMode",
  "mode": "Heat"
}
```

## Open Items to Confirm Before Postman Testing

- **Stray CaptureSnapshot example** — the source doc includes a `CaptureSnapshot` request/response pair (with a `snapshotUrl` under `/media/Heat pump001/...`) immediately after the Heat Pump commands. `CaptureSnapshot` is not declared anywhere in the Heat Pump schema and appears to be copy-pasted from the Camera device's template — confirm with the team whether it applies here at all before including it in Postman tests.
- **Attribute-level GET/POST** for `Thermostat` (`CurrentTemperature`, `Mode`, `RunningState`), `ElectricalPowerMeasurement` (`Power`), `ElectricalEnergyMeasurement` (`Energy`), and `UserLabel` (`Label`) — no dedicated routes documented for any of them; only exposed via the aggregate device GET.
- **UserLabel write route** — no route is documented for setting a custom `Label` on the device, despite the attribute existing.
- **Device-level configuration POST** — the Washer has a `/configuration` endpoint for bulk attribute updates; no equivalent is documented for the Heat Pump.
- **Mode enum values** — the sample uses `"Heat"` but the full set of supported `Mode` values (e.g. Cool, Auto, Off) is not documented.
