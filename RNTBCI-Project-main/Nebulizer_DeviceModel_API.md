# Nebulizer — Digital Twin Model & API Reference

## Device
- ID: `0x0701`
- Endpoint: `1`

## Cluster Overview

| Cluster | GET | POST |
|---|---|---|
|NebulizerControl|✓|StartSession, PauseSession, StopSession, SetMistLevel|
|MedicationMonitoring|✓|—|
|HealthSessionData|✓|—|
|DeviceSafety|✓|—|

## Device GET

```http
GET /devices/{device_id}/endpoint/{endpoint}
```

## POST

```http
POST /devices/{device_id}/endpoint/{endpoint}/cluster/{cluster}/command
```

```json
{"command":"StartSession"}
```

```json
{"command":"PauseSession"}
```

```json
{"command":"StopSession"}
```

```json
{"command":"SetMistLevel","level":"High"}
```

## Attributes
- PowerState
- CurrentSessionTime
- TotalUsageTime
- MistLevel
- MedicationLevel
- MedicationStatus
- LastSessionDuration
- SessionsToday
- TemperatureStatus
- MaskAttached
- DeviceError

## Open Items
- Verify command acknowledgements.
- Verify DeviceSafety values.
