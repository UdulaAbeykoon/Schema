from fastapi import APIRouter
from pydantic import BaseModel
import uuid
import time
from typing import Dict, Any, List

router = APIRouter()

# Simple in-memory storage for MVP
# In production, use Redis or a database
design_store: Dict[str, Dict[str, Any]] = {}

class FigmaLayers(BaseModel):
    layers: Any  # Accepts the JSON tree structure from html-to-figma
    transferId: str | None = None

@router.post("/api/figma/upload")
async def upload_for_figma(data: FigmaLayers):
    # Determine ID
    transfer_id = str(uuid.uuid4())[:6]  # Simple 6-char ID
    
    # Store with timestamp
    design_store[transfer_id] = {
        "layers": data.layers,
        "timestamp": time.time()
    }
    
    # Clean up old entries (simple garbage collection on push)
    # 1 hour TTL = 3600 seconds
    current_time = time.time()
    to_remove = [k for k, v in design_store.items() if current_time - v["timestamp"] > 3600]
    for k in to_remove:
        del design_store[k]
        
    return {"transferId": transfer_id}

@router.get("/api/figma/retrieve/{transfer_id}")
async def retrieve_for_figma(transfer_id: str):
    if transfer_id in design_store:
        return design_store[transfer_id]["layers"]
    return {"error": "Design not found or expired"}
