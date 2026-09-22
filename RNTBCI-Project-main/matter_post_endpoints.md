# Matter API POST Endpoints Reference

This document contains the exact `POST` URLs required to turn every registered device on or off via the backend Matter-compliant API. 

**Important Notes for Postman:**
1. Ensure the HTTP method is set to **POST**.
2. No JSON body is required for these specific URLs, but the backend will accept and log it if you send `{ "id": "0x00", "name": "Off" }`.
3. Executing these endpoints will instantly update the Postgres database and trigger a WebSocket event to update the frontend UI in real-time.

---

### 💡 Smart Lights
**Bathroom Light**
```http
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Bathroom_Light/endpoint/1/cluster/OnOff/on
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Bathroom_Light/endpoint/1/cluster/OnOff/off
```
**Bedroom Light**
```http
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Bedroom_Light/endpoint/1/cluster/OnOff/on
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Bedroom_Light/endpoint/1/cluster/OnOff/off
```
**Garage Light**
```http
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Garage_Light/endpoint/1/cluster/OnOff/on
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Garage_Light/endpoint/1/cluster/OnOff/off
```
**Hallway Light**
```http
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Hallway_Light/endpoint/1/cluster/OnOff/on
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Hallway_Light/endpoint/1/cluster/OnOff/off
```
**Kitchen Light**
```http
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Kitchen_Light/endpoint/1/cluster/OnOff/on
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Kitchen_Light/endpoint/1/cluster/OnOff/off
```
**Living Room Main Light**
```http
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Living_Room_Main_Light/endpoint/1/cluster/OnOff/on
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Living_Room_Main_Light/endpoint/1/cluster/OnOff/off
```
**Utility Light**
```http
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Utility_Light/endpoint/1/cluster/OnOff/on
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Utility_Light/endpoint/1/cluster/OnOff/off
```

### ❄️ HVAC / Climate
**Bedroom AC**
```http
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Bedroom_AC/endpoint/1/cluster/OnOff/on
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Bedroom_AC/endpoint/1/cluster/OnOff/off
```
**Living Room AC**
```http
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Living_Room_AC/endpoint/1/cluster/OnOff/on
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Living_Room_AC/endpoint/1/cluster/OnOff/off
```
**Water Heater**
```http
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Water_Heater/endpoint/1/cluster/OnOff/on
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Water_Heater/endpoint/1/cluster/OnOff/off
```

### 🔒 Security & Access
**Door Lock**
```http
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Door_Lock/endpoint/1/cluster/OnOff/on
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Door_Lock/endpoint/1/cluster/OnOff/off
```
**Front Door Lock**
```http
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Front_Door_Lock/endpoint/1/cluster/OnOff/on
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Front_Door_Lock/endpoint/1/cluster/OnOff/off
```
**Garage Door**
```http
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Garage_Door/endpoint/1/cluster/OnOff/on
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Garage_Door/endpoint/1/cluster/OnOff/off
```
**Security Camera**
```http
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Security_Camera/endpoint/1/cluster/OnOff/on
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Security_Camera/endpoint/1/cluster/OnOff/off
```

### 🍽️ Appliances & Kitchen
**Dishwasher**
```http
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Dishwasher/endpoint/1/cluster/OnOff/on
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Dishwasher/endpoint/1/cluster/OnOff/off
```
**Refrigerator**
```http
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Refrigerator/endpoint/1/cluster/OnOff/on
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Refrigerator/endpoint/1/cluster/OnOff/off
```
**Washing Machine**
```http
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Washing_Machine/endpoint/1/cluster/OnOff/on
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Washing_Machine/endpoint/1/cluster/OnOff/off
```

### 🔌 Plugs, Switches & Network
**Living Room Switch**
```http
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Living_Room_Switch/endpoint/1/cluster/OnOff/on
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Living_Room_Switch/endpoint/1/cluster/OnOff/off
```
**Smart Plug - Dryer**
```http
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Smart_Plug_-_Dryer/endpoint/1/cluster/OnOff/on
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Smart_Plug_-_Dryer/endpoint/1/cluster/OnOff/off
```
**WiFi Router**
```http
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/WiFi_Router/endpoint/1/cluster/OnOff/on
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/WiFi_Router/endpoint/1/cluster/OnOff/off
```

### 📺 Entertainment & Health
**Smart TV 65"**
```http
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Smart_TV_65/endpoint/1/cluster/OnOff/on
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Smart_TV_65/endpoint/1/cluster/OnOff/off
```
**Nebulizer**
```http
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Nebulizer/endpoint/1/cluster/OnOff/on
POST https://rntbci-project-production.up.railway.app/api/v1/devices/public/matter/Nebulizer/endpoint/1/cluster/OnOff/off
```
