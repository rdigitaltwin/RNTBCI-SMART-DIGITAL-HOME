"""RNTBCI Smart Home Digital Twin - System APIs."""

import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter(prefix="/system", tags=["System"])

@router.get("/logs/download", summary="Download system logs")
async def download_system_logs():
    """Download the JSON-formatted system log file."""
    log_file_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 
        "logs", 
        "system.log"
    )
    
    if not os.path.exists(log_file_path):
        raise HTTPException(status_code=404, detail="Log file not found")
        
    return FileResponse(
        path=log_file_path,
        media_type="application/json",
        filename="system_logs.json"
    )

@router.get("/logs/device/{device_id}/download", summary="Download device logs")
async def download_device_logs(device_id: str):
    """Download the JSON-formatted communication log file for a specific device."""
    log_file_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 
        "logs", 
        f"device_{device_id}.json"
    )
    
    if not os.path.exists(log_file_path):
        raise HTTPException(status_code=404, detail="Device log file not found")
        
    return FileResponse(
        path=log_file_path,
        media_type="application/json",
        filename=f"device_{device_id}_logs.json"
    )
