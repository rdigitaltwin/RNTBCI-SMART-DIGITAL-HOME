# RNTBCI Smart Home API Reference

This document contains the exact API endpoints and cURL commands for controlling the simulated devices (EV Charger, Solar Panel Array, and EV Vehicle). 

The base URL in production is `https://rntbci-project-production.up.railway.app`. Replace `{device_id}` with the actual UUID of your device.

---

## 1. EV Charger (Energy EVSE)
**Device ID:** `b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e`
**Cluster ID:** `0x009B` (or `EvseData`)

### Enable Charging
```bash
curl -X POST "https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x009B/enable" \
     -H "Content-Type: application/json"
```

### Disable Charging
```bash
curl -X POST "https://rntbci-project-production.up.railway.app/api/v1/devices/b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e/endpoint/1/cluster/0x009B/disable" \
     -H "Content-Type: application/json"
```

---

## 2. Solar Panel Array (Solar PV)
**Device ID:** `1ec2d468-1d91-4a34-9d55-5049b6e41ea0`
**Cluster ID:** `0x0091` (Electrical Measurement)

### Set Active Power (Generation in Watts)
*Note: Provide the value in milli-watts or Watts depending on your backend multiplier (typically raw Watt value).*
```bash
curl -X POST "https://rntbci-project-production.up.railway.app/api/v1/devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/endpoint/1/cluster/0x0091/setactivepower" \
     -H "Content-Type: application/json" \
     -d '{"ActivePower": 5000}'
```

### Set Voltage (V)
```bash
curl -X POST "https://rntbci-project-production.up.railway.app/api/v1/devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/endpoint/1/cluster/0x0091/setvoltage" \
     -H "Content-Type: application/json" \
     -d '{"Voltage": 240}'
```

### Set Active Current (A)
```bash
curl -X POST "https://rntbci-project-production.up.railway.app/api/v1/devices/1ec2d468-1d91-4a34-9d55-5049b6e41ea0/endpoint/1/cluster/0x0091/setactivecurrent" \
     -H "Content-Type: application/json" \
     -d '{"ActiveCurrent": 20}'
```

---

## 3. EV Vehicle
**Cluster Name:** `EvVehicleData`

### Set HV Battery Voltage (V)
```bash
curl -X POST "https://rntbci-project-production.up.railway.app/api/v1/devices/{device_id}/endpoint/1/cluster/EvVehicleData/hvbatvoltage" \
     -H "Content-Type: application/json" \
     -d '{"value": 400}'
```

### Set HV State of Charge (SoC %)
```bash
curl -X POST "https://rntbci-project-production.up.railway.app/api/v1/devices/{device_id}/endpoint/1/cluster/EvVehicleData/hvsoc" \
     -H "Content-Type: application/json" \
     -d '{"value": 85}'
```

### Set Aux Battery Voltage (V)
```bash
curl -X POST "https://rntbci-project-production.up.railway.app/api/v1/devices/{device_id}/endpoint/1/cluster/EvVehicleData/auxbatvoltage" \
     -H "Content-Type: application/json" \
     -d '{"value": 12.4}'
```

### Set Average Speed (km/h)
```bash
curl -X POST "https://rntbci-project-production.up.railway.app/api/v1/devices/{device_id}/endpoint/1/cluster/EvVehicleData/avgspeed" \
     -H "Content-Type: application/json" \
     -d '{"value": 60}'
```

---

## 4. General Device State Toggle (On/Off)
Applies to Solar PV and EV Vehicle as well.

### Turn Device ON/OFF
```bash
curl -X PATCH "https://rntbci-project-production.up.railway.app/api/v1/devices/{device_id}/state" \
     -H "Content-Type: application/json" \
     -d '{"status": "ON"}'
```
*(Use `"OFF"` to turn off).*
