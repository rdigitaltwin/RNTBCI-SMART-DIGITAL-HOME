# Smart Home Device API - Complete Reference

This document contains **every single link** from the API reference, updated to use the **correct Device IDs** currently registered in your system.

**Base URL:** `https://rntbci-project-production.up.railway.app/api/v1`

*Note: All endpoints require the `Authorization: Bearer <your_access_token>` header.*

---

## 1. Camera (Security Camera)
**Device ID (UUID):** `ef1dcda2-0119-4db9-85fd-e24ac85e1096`

- **Get device detail:** `GET /devices/ef1dcda2-0119-4db9-85fd-e24ac85e1096/endpoint/1`
- **Start video stream:**
  `POST /devices/ef1dcda2-0119-4db9-85fd-e24ac85e1096/endpoint/1/cluster/0x0551/command`
  `Body: { "command": "StartVideoStream", "resolution": "1920x1080", "frameRate": 30 }`
- **Stop video stream:**
  `POST /devices/ef1dcda2-0119-4db9-85fd-e24ac85e1096/endpoint/1/cluster/0x0551/command`
  `Body: { "command": "StopVideoStream" }`
- **Start audio stream:**
  `POST /devices/ef1dcda2-0119-4db9-85fd-e24ac85e1096/endpoint/1/cluster/0x0551/command`
  `Body: { "command": "StartAudioStream" }`
- **Stop audio stream:**
  `POST /devices/ef1dcda2-0119-4db9-85fd-e24ac85e1096/endpoint/1/cluster/0x0551/command`
  `Body: { "command": "StopAudioStream" }`
- **Capture snapshot:**
  `POST /devices/ef1dcda2-0119-4db9-85fd-e24ac85e1096/endpoint/1/cluster/0x0551/command`
  `Body: { "command": "CaptureSnapshot", "resolution": "1920x1080" }`

---

## 2. Dishwasher
**Device ID (File):** `Dishwasher`
**Device ID (UUID):** `f75d41ea-91a3-460c-8020-9a5e15bd5354`

- **Get device detail:** `GET /devices/Dishwasher/endpoint/1`
- **Turn on:**
  `POST /devices/f75d41ea-91a3-460c-8020-9a5e15bd5354/endpoint/1/cluster/0x0006/command`
  `Body: { "command": "On" }`
- **Turn off:**
  `POST /devices/f75d41ea-91a3-460c-8020-9a5e15bd5354/endpoint/1/cluster/0x0006/command`
  `Body: { "command": "Off" }`
- **Set temperature:**
  `POST /devices/f75d41ea-91a3-460c-8020-9a5e15bd5354/endpoint/1/cluster/0x0056/command`
  `Body: { "command": "SetTemperature", "targetTemperatureLevel": 3 }`

---

## 3. Door Lock
**Device ID (File):** `Door_Lock`
**Device ID (UUID):** `30eb3d26-9c82-46b3-8170-187d74985c09`

- **Get device detail:** `GET /devices/Door_Lock/endpoint/1`
- **Lock:**
  `POST /devices/30eb3d26-9c82-46b3-8170-187d74985c09/endpoint/1/cluster/0x0101/lock`
  `Body: { "command": "LockDoor" }`
- **Unlock:**
  `POST /devices/30eb3d26-9c82-46b3-8170-187d74985c09/endpoint/1/cluster/0x0101/lock`
  `Body: { "command": "UnlockDoor", "pinCode": "1234" }`

---

## 4. Garage Door (Using Front Door Lock as substitute)
**Device ID (File):** `Front_Door_Lock`
**Device ID (UUID):** `5514a0c1-cad7-408a-9928-1852e4c6eb35`

- **Get device detail:** `GET /devices/Front_Door_Lock/endpoint/1`
- **Open:**
  `POST /devices/5514a0c1-cad7-408a-9928-1852e4c6eb35/endpoint/1/cluster/0x2000/command`
  `Body: { "command": "OpenDoor" }`
- **Close:**
  `POST /devices/5514a0c1-cad7-408a-9928-1852e4c6eb35/endpoint/1/cluster/0x2000/command`
  `Body: { "command": "CloseDoor" }`
- **Stop:**
  `POST /devices/5514a0c1-cad7-408a-9928-1852e4c6eb35/endpoint/1/cluster/0x2000/command`
  `Body: { "command": "StopDoor" }`

---

## 5. Heat Pump (Using Bedroom AC as substitute)
**Device ID (File):** `Bedroom_AC`
**Device ID (UUID):** `83cd6514-1ece-4f0c-b6a5-5044967e45e2`

- **Get device detail:** `GET /devices/Bedroom_AC/endpoint/1`
- **Set target temperature:**
  `POST /devices/83cd6514-1ece-4f0c-b6a5-5044967e45e2/endpoint/1/cluster/0x0201/command`
  `Body: { "command": "SetTargetTemperature", "temperature": 23.0 }`
- **Set mode:**
  `POST /devices/83cd6514-1ece-4f0c-b6a5-5044967e45e2/endpoint/1/cluster/0x0201/command`
  `Body: { "command": "SetMode", "mode": "Heat" }`

---

## 6. Nebulizer
**Device ID (File):** `Nebulizer`

- **Get device detail:** `GET /devices/Nebulizer/endpoint/1`
- **Start session:**
  `POST /devices/Nebulizer/endpoint/1/cluster/0x1000/command`
  `Body: { "command": "StartSession" }`
- **Pause session:**
  `POST /devices/Nebulizer/endpoint/1/cluster/0x1000/command`
  `Body: { "command": "PauseSession" }`
- **Stop session:**
  `POST /devices/Nebulizer/endpoint/1/cluster/0x1000/command`
  `Body: { "command": "StopSession" }`
- **Set mist level:**
  `POST /devices/Nebulizer/endpoint/1/cluster/0x1000/command`
  `Body: { "command": "SetMistLevel", "level": "High" }`

---

## 7. Switch (Living Room Switch)
**Device ID (File):** `Living_Room_Switch`
**Device ID (UUID):** `c39bf632-f112-4b64-a294-1f93cbf65584`

- **Get device detail:** `GET /devices/Living_Room_Switch/endpoint/1`
- **Turn off:**
  `POST /devices/c39bf632-f112-4b64-a294-1f93cbf65584/endpoint/1/cluster/0x0006/off`
  `Body: { "id": "0x00", "name": "Off" }`
- **Turn on:**
  `POST /devices/c39bf632-f112-4b64-a294-1f93cbf65584/endpoint/1/cluster/0x0006/on`
  `Body: { "id": "0x01", "name": "On" }`
- **Toggle:**
  `POST /devices/c39bf632-f112-4b64-a294-1f93cbf65584/endpoint/1/cluster/0x0006/toggle`
  `Body: { "id": "0x02", "name": "Toggle" }`

---

## 8. Washing Machine
**Device ID (UUID):** `bf431833-e422-49ea-8235-da09454d02b4`

- **Get device detail:** `GET /devices/bf431833-e422-49ea-8235-da09454d02b4/endpoint/1`
- **Update configuration:**
  `POST /devices/bf431833-e422-49ea-8235-da09454d02b4/endpoint/1/configuration`
  `Body: { "mode": "Cotton", "temperature": 40, "spinSpeed": 1200, "rinses": "Extra" }`
- **Turn on:**
  `POST /devices/bf431833-e422-49ea-8235-da09454d02b4/endpoint/1/cluster/0x0006/on`
  `Body: { "id": "0x01", "name": "On" }`
- **Turn off:**
  `POST /devices/bf431833-e422-49ea-8235-da09454d02b4/endpoint/1/cluster/0x0006/off`
  `Body: { "id": "0x00", "name": "Off" }`
- **Get power status:**
  `GET /devices/bf431833-e422-49ea-8235-da09454d02b4/endpoint/1/cluster/OnOff/status`
- **Get washer modes:**
  `GET /devices/bf431833-e422-49ea-8235-da09454d02b4/endpoint/1/cluster/0x0051/laundrywashermode/mode`
- **Set spin speed:**
  `POST /devices/bf431833-e422-49ea-8235-da09454d02b4/endpoint/1/cluster/LaundryWasherControls/setspin`
  `Body: { "spinSpeedCurrent": 3 }`
- **Get rinse config:**
  `GET /devices/bf431833-e422-49ea-8235-da09454d02b4/endpoint/1/cluster/LaundryWasherControls/rinse`
- **Set number of rinses:**
  `POST /devices/bf431833-e422-49ea-8235-da09454d02b4/endpoint/1/cluster/LaundryWasherControls/setrinse`
  `Body: { "numberOfRinses": "Extra" }`
- **Get temperature config:**
  `GET /devices/bf431833-e422-49ea-8235-da09454d02b4/endpoint/1/cluster/TemperatureControl`

---

## 9. Water Heater
**Device ID (UUID):** `5dd8cce9-6033-46ff-8be1-25c1b5078dc7`

- **Get device detail:** `GET /devices/5dd8cce9-6033-46ff-8be1-25c1b5078dc7/endpoint/1`
- **Set mode:**
  `POST /devices/5dd8cce9-6033-46ff-8be1-25c1b5078dc7/endpoint/1/cluster/0x009E/command`
  `Body: { "command": "SetMode", "mode": "Eco" }`
- **Boost:**
  `POST /devices/5dd8cce9-6033-46ff-8be1-25c1b5078dc7/endpoint/1/cluster/0x0094/command`
  `Body: { "command": "Boost", "durationSec": 3600, "targetTemp": 60 }`
- **Cancel boost:**
  `POST /devices/5dd8cce9-6033-46ff-8be1-25c1b5078dc7/endpoint/1/cluster/0x0094/command`
  `Body: { "command": "CancelBoost" }`

---

## 10. EV Charger (EVSE)
**Device ID (UUID):** `b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e`

- **Get device details:** `GET /devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1`
- **Get state of charge:** `GET /devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/EnergyEVSE/stateofcharge`
- **Get active power:** `GET /devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/ElectricalPowerMeasurement/activepower`
- **Get voltage:** `GET /devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/ElectricalPowerMeasurement/voltage`
- **Get active current:** `GET /devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/ElectricalPowerMeasurement/activecurrent`
- **Get current session energy:** `GET /devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/EnergyEVSE/currentsessionenergy`
- **Get charging targets:** `GET /devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/EnergyEVSE/gettargets`
- **Enable charging:**
  `POST /devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x009B/enable`
  `Body: { "commandId": "0x01", "command": "EnableCharging" }`
- **Disable charging:**
  `POST /devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x009B/disable`
  `Body: { "commandId": "0x02", "command": "Disable" }`
- **Set charging targets:**
  `POST /devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x009B/settarget`
  `Body: { "commandId": "0x05", "command": "SetTargets", "chargingTargetSchedules": [ { "dayOfWeekForSequence": 127, "chargingTargets": [ { "targetTimeMinutesPastMidnight": 420, "targetSoC": 80, "addedEnergy": 0 } ] } ] }`
- **Clear charging targets:**
  `POST /devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/EnergyEVSE/cleartargets`
  `Body: { "commandId": "0x07", "command": "ClearTargets" }`
- **Trigger identify effect:**
  `POST /devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/Identify/triggereffect`
  `Body: { "name": "TriggerEffect" }`
- **Set active power:**
  `POST /devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/ElectricalPowerMeasurement/setactivepower`
  `Body: { "ActivePower": 7400000 }`
- **Set voltage:**
  `POST /devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/ElectricalPowerMeasurement/setvoltage`
  `Body: { "Voltage": 230000 }`
- **Set active current:**
  `POST /devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/ElectricalPowerMeasurement/setactivecurrent`
  `Body: { "ActiveCurrent": 32000 }`

---

## 11. Solar PV
**Device ID (UUID):** `1ec2d468-1d91-4a34-9d55-5049b6e41ea0`

- **Set active power:**
  `POST /devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/endpoint/1/cluster/0x0091/setactivepower`
  `Body: { "ActivePower": 5000 }`
- **Set voltage:**
  `POST /devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/endpoint/1/cluster/0x0091/setvoltage`
  `Body: { "Voltage": 240 }`
- **Set active current:**
  `POST /devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/endpoint/1/cluster/0x0091/setactivecurrent`
  `Body: { "ActiveCurrent": 20 }`
- **Trigger effect:**
  `POST /devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/solar/endpoint/1/cluster/0x0003/triggereffect`
  `Body: { "name": "TriggerEffect" }`
- **Set user label:**
  `POST /devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/solar/endpoint/1/cluster/0x0041/labellist`
  `Body: { "label": "Roof Panel", "value": "Arr 1" }`
- **Get active power:**
  `GET /devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/solar/endpoint/1/cluster/0x0091/activepower`
- **Get cumulative energy exported:**
  `GET /devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/solar/endpoint/1/cluster/0x0091/cumulativeenergyexported`
- **Get user label:**
  `GET /devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/solar/endpoint/1/cluster/0x0041/labellist`

---

## 12. EV Vehicle
**Device ID (UUID):** `fb338bef-0060-4626-93a6-ef7df4ac3bcb`

- **Get HV battery voltage:**
  `GET /devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/endpoint/1/cluster/EvVehicleData/hvbatvoltage`
- **Update HV battery voltage:**
  `POST /devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/endpoint/1/cluster/EvVehicleData/hvbatvoltage`
  `Body: { "value": 398 }`
- **Get state of charge:**
  `GET /devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/endpoint/1/cluster/EvVehicleData/hvsoc`
- **Update state of charge:**
  `POST /devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/endpoint/1/cluster/EvVehicleData/hvsoc`
  `Body: { "value": 80 }`
- **Get aux battery voltage:**
  `GET /devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/endpoint/1/cluster/EvVehicleData/auxbatvoltage`
- **Update aux battery voltage:**
  `POST /devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/endpoint/1/cluster/EvVehicleData/auxbatvoltage`
  `Body: { "value": 12.8 }`
- **Get average speed:**
  `GET /devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/endpoint/1/cluster/EvVehicleData/avgspeed`
- **Update average speed:**
  `POST /devices/fb338bef-0060-4626-93a6-ef7df4ac3bcb/endpoint/1/cluster/EvVehicleData/avgspeed`
  `Body: { "value": 55 }`

---

## 13. General Device ON/OFF (State Toggle)
This works for any device by swapping the UUID. Example using the Solar PV ID:

- **Turn on:**
  `PATCH /devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/state`
  `Body: { "status": "ON" }`
- **Turn off:**
  `PATCH /devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/state`
  `Body: { "status": "OFF" }`
