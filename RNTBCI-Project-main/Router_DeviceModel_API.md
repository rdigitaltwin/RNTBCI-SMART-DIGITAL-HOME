# Router (WiFi Network Manager) — Digital Twin Model & API Reference

## Device JSON Schema
- Device ID: `0x0090`
- Device Name: `WiFiNetworkManager`
- Revision: `2`
- Endpoint: `1`

## Cluster Overview

| Cluster ID | Cluster | Side | Mandatory | GET | POST |
|---|---|---|---|---|---|
|0x0451|WiFiNetworkManagement|Server|Yes|Device GET|Connect / Disconnect / Scan|

## Attributes

| ID | Name | Type |
|---|---|---|
|0x0000|SSID|string|
|0x0001|ConnectionStatus|enum|
|0x0002|SignalStrength|int (dBm)|

## Commands

| ID | Command |
|---|---|
|0x00|ConnectNetwork|
|0x01|DisconnectNetwork|
|0x03|ScanNetworks|

## Events
- Connected
- Disconnected
- ConnectionFailed
- SignalWeak

## Device-Level GET API

```http
GET /devices/{device_id}/endpoint/{endpoint}
```

Returns the complete Router Digital Twin configuration.

## Cluster POST APIs

### Connect

```http
POST /devices/{device_id}/endpoint/{endpoint}/cluster/{cluster}/connect
```

```json
{
  "command":"ConnectNetwork",
  "ssid":"Home_WiFi",
  "password":"router1234"
}
```

### Disconnect

```http
POST /devices/{device_id}/endpoint/{endpoint}/cluster/{cluster}/connect
```

```json
{
  "command":"DisconnectNetwork"
}
```

### Scan

```http
POST /devices/{device_id}/endpoint/{endpoint}/cluster/{cluster}/connect
```

```json
{
  "command":"ScanNetworks"
}
```

## Open Items

- Verify Connect/Disconnect responses.
- Verify Scan response payload.
- Verify attribute-only GET endpoints if implemented.
