import asyncio
import uuid
import httpx
from datetime import datetime

async def test_create_ev_vehicle():
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # 1. Login to get token
        login_res = await client.post(
            "/api/v1/auth/token",
            data={"username": "admin@example.com", "password": "password123"}
        )
        if login_res.status_code != 200:
            print("Login failed:", login_res.text)
            return
            
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Get a room ID
        rooms_res = await client.get("/api/v1/rooms", headers=headers)
        if rooms_res.status_code != 200 or not rooms_res.json():
            print("Failed to get rooms:", rooms_res.text)
            return
            
        room_id = rooms_res.json()[0]["id"]
        print(f"Using room_id: {room_id}")
        
        # 3. Create EV Vehicle
        payload = {
            "name": "My Test EV",
            "type": "ev_vehicle",
            "room_id": room_id,
            "status": "online",
            "power_state": "on",
            "connectivity": "connected"
        }
        create_res = await client.post("/api/v1/devices", json=payload, headers=headers)
        print(f"Create response status: {create_res.status_code}")
        print(f"Create response body: {create_res.text}")

if __name__ == "__main__":
    asyncio.run(test_create_ev_vehicle())
