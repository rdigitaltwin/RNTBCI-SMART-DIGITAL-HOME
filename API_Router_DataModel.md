# Router — Digital Twin Model & API Reference

## Device JSON Schema

```json
{
  "deviceType": {
    "id": "0x0090",
    "name": "WiFiNetworkManager",
    "revision": 2,
    "classification": { "class": "simple", "scope": "endpoint" },
    "endpoints": [
      {
        "endpointId": 1,
        "deviceType": "WiFiNetworkManager",
        "clusters": [
          {
            "clusterId": "0x0451",
            "name": "WiFiNetworkManagement",
            "side": "server",
            "mandatory": true,
            "attributes": [
              { "attributeId": "0x0000", "name": "SSID", "type": "string" },
              {
                "attributeId": "0x0001",
                "name": "ConnectionStatus",
                "type": "enum",
                "values": ["Disconnected", "Connecting", "Connected", "Error"]
              },
              { "attributeId": "0x0002", "name": "SignalStrength", "type": "int", "unit": "dBm" }
            ],
            "commands": [
              { "commandId": "0x00", "name": "ConnectNetwork" },
              { "commandId": "0x01", "name": "DisconnectNetwork" },
              { "commandId": "0x03", "name": "ScanNetworks" }
            ],
            "events": [
              { "name": "Connected" },
              { "name": "Disconnected" },
              { "name": "ConnectionFailed" },
              { "name": "SignalWeak" }
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
| 0x0451 | WiFiNetworkManagement | server | Yes | Yes (via device GET) | Yes (`/connect`) |

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
    "id": "0x0090",
    "name": "WiFiNetworkManager",
    "revision": 2,
    "classification": { "class": "simple", "scope": "endpoint" },
    "endpoints": [
      {
        "endpointId": 1,
        "deviceType": "WiFiNetworkManager",
        "clusters": [
          {
            "clusterId": "0x0451",
            "name": "WiFiNetworkManagement",
            "side": "server",
            "mandatory": true,
            "attributes": [
              { "attributeId": "0x0000", "name": "SSID", "type": "string" },
              {
                "attributeId": "0x0001",
                "name": "ConnectionStatus",
                "type": "enum",
                "values": ["Disconnected", "Connecting", "Connected", "Error"]
              },
              { "attributeId": "0x0002", "name": "SignalStrength", "type": "int", "unit": "dBm" }
            ],
            "commands": [
              { "commandId": "0x00", "name": "ConnectNetwork" },
              { "commandId": "0x01", "name": "DisconnectNetwork" },
              { "commandId": "0x03", "name": "ScanNetworks" }
            ],
            "events": [
              { "name": "Connected" },
              { "name": "Disconnected" },
              { "name": "ConnectionFailed" },
              { "name": "SignalWeak" }
            ]
          }
        ]
      }
    ]
  }
}
```

> No separate device-level `/configuration` POST is documented for the Router (unlike the Washer). `SSID` and `SignalStrength` have no documented write route — they appear to be read-only, reported via the aggregate device GET.

## Cluster-Level API

### WiFiNetworkManagement — Connect Network

```
POST HTTP/<ip>/devices/{device_id}/endpoint/{endpoint}/cluster/{cluster}/connect
```

**Request body**
```json
{
  "command": "ConnectNetwork",
  "ssid": "Home_WiFi",
  "password": "router1234"
}
```

### WiFiNetworkManagement — Disconnect Network

```
POST HTTP/<ip>/devices/{device_id}/endpoint/{endpoint}/cluster/{cluster}/connect
```
> ⚠️ Doc reuses the same `/connect` path for Disconnect — only one POST URL is shown before both the `ConnectNetwork` and `DisconnectNetwork` bodies. Confirm/replace with a dedicated `/disconnect` route before Postman testing (same reuse pattern seen in the Washer's `/on` route and the Door Lock's `/lock` route).

**Request body**
```json
{ "command": "DisconnectNetwork" }
```

### WiFiNetworkManagement — Scan Networks

> ⚠️ `ScanNetworks` (`commandId: 0x03`) is declared in the schema but the doc shows no sample request body or dedicated route for it. Confirm whether it's issued via the same `/connect` command route or needs its own endpoint (e.g. `/scan`).

## Open Items to Confirm Before Postman Testing

- **Disconnect endpoint** currently reuses the `/connect` URL — needs a real `/disconnect` path (or confirm the same route intentionally branches on the `command` field in the body).
- **ScanNetworks** — command is declared in the schema but no request body or route is documented.
- **Command ID gap** — `commandId` values jump from `0x01` (`DisconnectNetwork`) straight to `0x03` (`ScanNetworks`); `0x02` is unaccounted for. Confirm whether a command is missing from the documentation.
- **Attribute-level GET/POST** for `SSID`, `ConnectionStatus`, and `SignalStrength` — no dedicated routes documented; only exposed via the aggregate device GET.
- **Plaintext password in request body** — `ConnectNetwork` passes `password` as a plain string in the JSON body; confirm whether this is sent over TLS only and whether the API expects any additional credential handling (e.g. hashing, secure storage) before Postman testing.
- **Events** (`Connected`, `Disconnected`, `ConnectionFailed`, `SignalWeak`) — no subscription/webhook/polling route documented for retrieving these.
