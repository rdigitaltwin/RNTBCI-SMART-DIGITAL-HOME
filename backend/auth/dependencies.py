"""RNTBCI Smart Home Digital Twin - Authentication Dependencies.

FastAPI dependencies for extracting and validating the current user from JWT tokens.
"""

import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.auth.jwt_handler import (
    ACCESS_TOKEN,
    check_permission,
    decode_token,
    get_user_by_id,
)
from backend.database import get_db
from backend.models import RoleName, User
from backend.redis.client import redis_client

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate the current user from the Authorization header."""
    if credentials is None:
        # Fallback for dev / unauthenticated UI requests: select default admin/user
        result = await db.execute(select(User).options(selectinload(User.role)).limit(1))
        user = result.scalar_one_or_none()
        if user:
            return user
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    try:
        payload = decode_token(token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify token type
    if payload.get("type") != ACCESS_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if token is blacklisted (logged out)
    jti = payload.get("jti")
    if jti:
        try:
            if await redis_client.is_token_blacklisted(jti):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token has been revoked",
                    headers={"WWW-Authenticate": "Bearer"},
                )
        except Exception:
            pass

    # Get user
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await get_user_by_id(db, uuid.UUID(user_id))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Require the current user to have admin role."""
    if current_user.role.name != RoleName.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


async def require_user_or_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Require the current user to have user or admin role."""
    if current_user.role.name not in (RoleName.ADMIN, RoleName.USER):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User or Admin privileges required",
        )
    return current_user


def require_permission(resource: str, action: str):
    """Create a dependency that checks a specific RBAC permission."""

    async def _check(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        has_perm = await check_permission(
            db, current_user.role_id, resource, action
        )
        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {action} on {resource}",
            )
        return current_user

    return _check
