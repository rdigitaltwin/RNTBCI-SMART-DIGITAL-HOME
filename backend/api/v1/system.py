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
        "data", 
        "system.log"
    )
    
    if not os.path.exists(log_file_path):
        raise HTTPException(status_code=404, detail="Log file not found")
        
    return FileResponse(
        path=log_file_path,
        media_type="application/json",
        filename="system_logs.json"
    )

@router.get("/logs/device/{device_name}/download", summary="Download device logs")
async def download_device_logs(device_name: str):
    """Download the JSON-formatted communication log file for a specific device."""
    safe_name = device_name.replace(" ", "_")
    log_file_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 
        "data", 
        f"device_{safe_name}.json"
    )
    
    if not os.path.exists(log_file_path):
        raise HTTPException(status_code=404, detail="Device log file not found")
        
    return FileResponse(
        path=log_file_path,
        media_type="application/json",
        filename=f"device_{safe_name}_logs.json"
    )
