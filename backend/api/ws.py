from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.websockets import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/admin")
async def admin_ws(websocket: WebSocket):
    await manager.connect("admins", websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect("admins", websocket)


@router.websocket("/ws/users/{user_id}")
async def user_ws(user_id: str, websocket: WebSocket):
    channel = f"user:{user_id}"
    await manager.connect(channel, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(channel, websocket)
