# Door Lock — Digital Twin Model & API Reference

## Device JSON Schema

```json
{
  "deviceType": {
    "id": "0x000A",
    "name": "DoorLock",
    "revision": 1,
    "classification": { "class": "simple", "scope": "endpoint" },
    "endpoints": [
      {
        "endpointId": 1,
        "deviceType": "DoorLock",
        "clusters": [
          {
            "clusterId": "0x0101",
            "name": "DoorLock",
            "side": "server",
            "mandatory": true,
            "features": [
              { "code": "PIN", "name": "PINCredential" },
              { "code": "RID", "name": "RFIDCredential" }
            ],
            "attributes": [
              { "attributeId": "0x0000", "name": "LockState", "type": "LockStateEnum" },
              { "attributeId": "0x0001", "name": "LockType", "type": "LockTypeEnum" },
              { "attributeId": "0x0002", "name": "ActuatorEnabled", "type": "bool" }
            ],
            "commands": [
              { "commandId": "0x0000", "name": "LockDoor" },
              { "commandId": "0x0001", "name": "UnlockDoor" }
            ]
          }
        ]
      }
    ]
  }
}
```

## Cluster Overview

| Cluster ID | Cluster Name | Side | Mandatory | Features | GET (device) | POST (command) |
|---|---|---|---|---|---|---|
| 0x0101 | DoorLock | server | Yes | PIN (PINCredential), RID (RFIDCredential) | Yes (via device GET) | Yes (`/lock`) |

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
    "id": "0x000A",
    "name": "DoorLock",
    "revision": 1,
    "classification": { "class": "simple", "scope": "endpoint" },
    "endpoints": [
      {
        "endpointId": 1,
        "deviceType": "DoorLock",
        "clusters": [
          {
            "clusterId": "0x0101",
            "name": "DoorLock",
            "side": "server",
            "mandatory": true,
            "features": [
              { "code": "PIN", "name": "PINCredential" },
              { "code": "RID", "name": "RFIDCredential" }
            ],
            "attributes": [
              { "attributeId": "0x0000", "name": "LockState", "type": "LockStateEnum" },
              { "attributeId": "0x0001", "name": "LockType", "type": "LockTypeEnum" },
              { "attributeId": "0x0002", "name": "ActuatorEnabled", "type": "bool" }
            ],
            "commands": [
              { "commandId": "0x0000", "name": "LockDoor" },
              { "commandId": "0x0001", "name": "UnlockDoor" }
            ]
          }
        ]
      }
    ]
  }
}
```

> No separate device-level `/configuration` POST is documented for the Door Lock (unlike the Washer). Attribute values (`LockState`, `LockType`, `ActuatorEnabled`) have no documented write route — they appear to be read-only, reported via the aggregate device GET.

## Cluster-Level API

### DoorLock — Lock Door

```
POST HTTP/<ip>/devices/{device_id}/endpoint/{endpoint}/cluster/{cluster}/lock
```

**Request body**
```json
{ "command": "LockDoor" }
```

### DoorLock — Unlock Door

```
POST HTTP/<ip>/devices/{device_id}/endpoint/{endpoint}/cluster/{cluster}/lock
```
> ⚠️ Doc reuses the same `/lock` path for both Lock and Unlock — confirm/replace with a dedicated `/unlock` route before Postman testing (same pattern as the Washer's OnOff `/on` endpoint being reused for Off).

**Request body**
```json
{
  "command": "UnlockDoor",
  "pinCode": "1234"
}
```

| Field | Description |
|---|---|
| command | Command name (`LockDoor` or `UnlockDoor`) |
| pinCode | PIN credential used to authorize the unlock (only shown on `UnlockDoor`) |

## Open Items to Confirm Before Postman Testing

- **Unlock endpoint** currently reuses the `/lock` URL — needs a real `/unlock` path (or confirm the same route intentionally branches on the `command` field in the body).
- **Attribute-level GET/POST** for `LockState`, `LockType`, and `ActuatorEnabled` — no dedicated cluster-level routes documented; only exposed via the aggregate device GET, and no write route is shown for any of them.
- **PIN/RFID credential management** — the cluster declares `PINCredential` and `RFIDCredential` features, but no API is documented for enrolling, listing, or revoking PIN codes or RFID credentials (only a `pinCode` passed inline on `UnlockDoor`).
- **LockDoor** — no request parameters are shown; confirm whether a `pinCode` or other authorization is required to lock as well as unlock.
- **Events/notifications** — no lock-state-change event (e.g. a `DoorLockAlarm` or `LockOperation` event) is documented, so there's no confirmed way to be notified of lock/unlock activity outside of polling the device GET.
