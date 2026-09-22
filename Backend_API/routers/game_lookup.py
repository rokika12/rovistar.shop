"""Public account lookups used to confirm a manual game-service recipient."""
from fastapi import APIRouter, HTTPException, Query
import httpx

router = APIRouter(prefix="/api/game-lookup", tags=["game lookup"])


@router.get("/roblox")
def lookup_roblox_username(username: str = Query(..., min_length=3, max_length=20)):
    """Resolve a Roblox username through Roblox's official public APIs."""
    username = username.strip()
    try:
        with httpx.Client(timeout=httpx.Timeout(8.0, connect=4.0)) as client:
            users_response = client.post(
                "https://users.roblox.com/v1/usernames/users",
                json={"usernames": [username], "excludeBannedUsers": False},
            )
            users_response.raise_for_status()
            users = users_response.json().get("data") or []
            if not users:
                raise HTTPException(status_code=404, detail="Roblox username not found")
            user = users[0]
            thumbnail_response = client.get(
                "https://thumbnails.roblox.com/v1/users/avatar-headshot",
                params={"userIds": user["id"], "size": "150x150", "format": "Png", "isCircular": "false"},
            )
            thumbnail_response.raise_for_status()
            thumbnails = thumbnail_response.json().get("data") or []
    except HTTPException:
        raise
    except httpx.HTTPStatusError:
        raise HTTPException(status_code=502, detail="Roblox lookup is temporarily unavailable")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Roblox lookup is temporarily unavailable")

    avatar_url = thumbnails[0].get("imageUrl", "") if thumbnails else ""
    return {
        "id": user["id"],
        "username": user.get("name", username),
        "display_name": user.get("displayName", user.get("name", username)),
        "avatar_url": avatar_url,
    }
