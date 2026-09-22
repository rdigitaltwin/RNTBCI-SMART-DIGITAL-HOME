"""RNTBCI Smart Home Digital Twin - Authentication Dependencies.

FastAPI dependencies for extracting and validating the current user from JWT tokens.
"""

import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.jwt_handler import (
    ACCESS_TOKEN,
    check_permission,
    decode_token,
    get_user_by_id,
)
from backend.database import get_db
from backend.models import RoleName, User
from backend.redis.client import redis_client

security = HTTPBearer()


async def get_current_user(
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate the current user from the Authorization header.

    Modified for DEMO MODE: Bypasses JWT and automatically returns the first Admin user.
    """
    from sqlalchemy import select
    from backend.models import Role, RoleName
    from sqlalchemy.orm import selectinload
    
    result = await db.execute(
        select(User).join(Role).where(Role.name == RoleName.ADMIN).options(selectinload(User.role))
    )
    user = result.scalars().first()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin user not found or inactive. Please run seed.py",
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
