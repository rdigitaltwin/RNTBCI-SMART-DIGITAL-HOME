# Heat Pump — Digital Twin Model & API Reference

## Device
- ID: `0x0309`
- Endpoint: `1`

## Cluster Overview

| Cluster | GET | POST |
|---|---|---|
|Thermostat|✓|SetTargetTemperature, SetMode|
|ElectricalPowerMeasurement|✓|—|
|ElectricalEnergyMeasurement|✓|—|
|UserLabel|✓|—|

## Device GET

```http
GET /devices/{device_id}/endpoint/{endpoint}
```

## POST

```http
POST /devices/{device_id}/endpoint/{endpoint}/cluster/{cluster}/command
```

```json
{"command":"SetTargetTemperature","temperature":23.0}
```

```json
{"command":"SetMode","mode":"Heat"}
```

## Attributes
- CurrentTemperature
- TargetTemperature
- Mode
- RunningState
- Power
- Energy
- Label

## Open Items
- Confirm individual attribute APIs.
- Verify POST responses in Postman.
