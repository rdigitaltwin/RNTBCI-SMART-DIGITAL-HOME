# Camera — Digital Twin Model & API Reference

## Device JSON Schema

```json
{
  "deviceType": {
    "id": "0x0142",
    "name": "Camera",
    "revision": 1,
    "classification": { "class": "simple", "scope": "endpoint" },
    "endpoints": [
      {
        "endpointId": 1,
        "deviceType": "Camera",
        "clusters": [
          {
            "clusterId": "0x0551",
            "name": "CameraAVStreamManagement",
            "side": "server",
            "mandatory": true,
            "attributes": [
              { "name": "CurrentFrameRate", "type": "uint16" },
              { "name": "MaxNetworkBandwidth", "type": "uint32" },
              { "name": "RecordingPrivacyMode", "type": "bool" },
              { "name": "MicrophoneMuted", "type": "bool" },
              { "name": "SpeakerVolume", "type": "uint8" }
            ],
            "commands": [
              { "name": "StartVideoStream" },
              { "name": "StopVideoStream" },
              { "name": "StartAudioStream" },
              { "name": "StopAudioStream" },
              { "name": "CaptureSnapshot" }
            ],
            "events": [
              { "name": "MotionDetected" },
              { "name": "StreamStarted" },
              { "name": "StreamStopped" }
            ]
          },
          {
            "clusterId": "0x0801",
            "name": "TLSCertificateManagement",
            "side": "server",
            "mandatory": true,
            "attributes": [
              { "name": "MaxRootCertificates", "type": "uint8" },
              { "name": "MaxClientCertificates", "type": "uint8" }
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
| 0x0551 | CameraAVStreamManagement | server | Yes | Yes (via device GET) | Yes (`/command`) |
| 0x0801 | TLSCertificateManagement | server | Yes | Yes (via device GET) | — (not documented) |

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
    "id": "0x0142",
    "name": "Camera",
    "revision": 1,
    "classification": { "class": "simple", "scope": "endpoint" },
    "endpoints": [
      {
        "endpointId": 1,
        "deviceType": "Camera",
        "clusters": [
          {
            "clusterId": "0x0551",
            "name": "CameraAVStreamManagement",
            "side": "server",
            "mandatory": true,
            "attributes": [
              { "name": "CurrentFrameRate", "type": "uint16" },
              { "name": "MaxNetworkBandwidth", "type": "uint32" },
              { "name": "RecordingPrivacyMode", "type": "bool" },
              { "name": "MicrophoneMuted", "type": "bool" },
              { "name": "SpeakerVolume", "type": "uint8" }
            ],
            "commands": [
              { "name": "StartVideoStream" },
              { "name": "StopVideoStream" },
              { "name": "StartAudioStream" },
              { "name": "StopAudioStream" },
              { "name": "CaptureSnapshot" }
            ],
            "events": [
              { "name": "MotionDetected" },
              { "name": "StreamStarted" },
              { "name": "StreamStopped" }
            ]
          },
          {
            "clusterId": "0x0801",
            "name": "TLSCertificateManagement",
            "side": "server",
            "mandatory": true,
            "attributes": [
              { "name": "MaxRootCertificates", "type": "uint8" },
              { "name": "MaxClientCertificates", "type": "uint8" }
            ]
          }
        ]
      }
    ]
  }
}
```

> No separate device-level `/configuration` POST is documented for the Camera. Attribute changes (e.g. `RecordingPrivacyMode`, `SpeakerVolume`) have no documented write route — see **Open Items** below.

## Cluster-Level API

### CameraAVStreamManagement — Send Command

```
POST HTTP/<ip>/devices/{device_id}/endpoint/{endpoint}/cluster/{cluster}/command
```

#### StartVideoStream

**Request body**
```json
{
  "command": "StartVideoStream",
  "resolution": "1920x1080",
  "frameRate": 30
}
```

#### StopVideoStream

**Request body**
```json
{ "command": "StopVideoStream" }
```

#### StartAudioStream

**Request body**
```json
{ "command": "StartAudioStream" }
```

#### StopAudioStream

> ⚠️ Doc lists `StopAudioStream` as a supported command but does not show a sample request body. By symmetry with `StopVideoStream`, it is expected to take no parameters — confirm with team before Postman testing.

**Request body (assumed)**
```json
{ "command": "StopAudioStream" }
```

#### CaptureSnapshot

**Request body**
```json
{
  "command": "CaptureSnapshot",
  "resolution": "1920x1080"
}
```

**Response**
```json
{
  "snapshotUrl": "/media/camera001/snapshot.jpg",
  "timestamp": "2026-07-03T10:15:00Z"
}
```

| Field | Meaning |
|---|---|
| snapshotUrl | Path to the captured still image |
| timestamp | ISO-8601 capture time |

### TLSCertificateManagement

> No cluster-level GET/POST routes are documented for this cluster. Its attributes (`MaxRootCertificates`, `MaxClientCertificates`) are only exposed via the aggregate device GET.

## Open Items to Confirm Before Postman Testing

- **Attribute-level GET/POST** for `CameraAVStreamManagement` (e.g. toggling `RecordingPrivacyMode`, muting `MicrophoneMuted`, setting `SpeakerVolume`, reading `CurrentFrameRate`/`MaxNetworkBandwidth`) — no dedicated routes documented; only visible via the aggregate device GET.
- **StopAudioStream** — command is listed but no sample request body is shown in the doc; body above is assumed by symmetry with `StopVideoStream`.
- **TLSCertificateManagement** — cluster exists in the schema with two attributes but has no dedicated GET/POST route; only exposed via the aggregate device GET.
- **Device-level configuration POST** — the Washer has a `/configuration` endpoint for bulk attribute updates; no equivalent is documented for the Camera.
- **Events** (`MotionDetected`, `StreamStarted`, `StreamStopped`) — no subscription/webhook/polling route documented for retrieving these.
