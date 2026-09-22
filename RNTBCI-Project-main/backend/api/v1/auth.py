"""RNTBCI Smart Home Digital Twin - Authentication API Routes."""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status, Response
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user
from backend.auth.jwt_handler import (
    REFRESH_TOKEN,
    authenticate_user,
    create_token_pair,
    decode_token,
    hash_password,
    validate_password_strength,
)
from backend.database import get_db
from backend.models import AuditLog, Role, RoleName, User
from backend.redis.client import redis_client
from backend.schemas import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
    UserUpdateRequest,
)

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def register(
    request: Request,
    data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Register a new user account."""
    # Validate password strength
    valid, msg = validate_password_strength(data.password)
    if not valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    # Check if email already exists
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Check if username already exists
    existing = await db.execute(select(User).where(User.username == data.username))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken",
        )

    # Get default role (User)
    role_result = await db.execute(select(Role).where(Role.name == RoleName.USER))
    role = role_result.scalar_one_or_none()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Default role not configured",
        )

    # Create user
    user = User(
        email=data.email,
        username=data.username,
        password_hash=hash_password(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        role_id=role.id,
    )
    db.add(user)
    await db.flush()

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="register",
        resource="users",
        details={"email": data.email, "username": data.username},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)
    await db.commit()

    logger.info("User registered successfully: %s", data.username)

    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        role=role.name.value if isinstance(role.name, RoleName) else role.name,
        is_active=user.is_active,
        last_login=user.last_login,
        created_at=user.created_at,
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Authenticate and receive JWT tokens."""
    user = await authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    role_name = user.role.name.value if isinstance(user.role.name, RoleName) else user.role.name
    tokens = create_token_pair(str(user.id), role_name)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        action="login",
        resource="auth",
        details={"method": "password"},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)
    await db.commit()

    return TokenResponse(**tokens)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("20/minute")
async def refresh_token(
    request: Request,
    data: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Refresh an access token using a refresh token."""
    from jose import JWTError

    try:
        payload = decode_token(data.refresh_token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    if payload.get("type") != REFRESH_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    # Check if blacklisted
    jti = payload.get("jti")
    if jti and await redis_client.is_token_blacklisted(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
        )

    user_id = payload.get("sub")
    user = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = user.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    # Blacklist the old refresh token
    if jti:
        exp = payload.get("exp", 0)
        now = int(datetime.now(timezone.utc).timestamp())
        remaining = max(exp - now, 0)
        await redis_client.blacklist_token(jti, remaining)

    role_name = payload.get("role", "user")
    tokens = create_token_pair(str(user.id), role_name)

    return TokenResponse(**tokens)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Logout and invalidate the current token."""
    # Extract token from header to blacklist
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            payload = decode_token(token)
            jti = payload.get("jti")
            if jti:
                exp = payload.get("exp", 0)
                now = int(datetime.now(timezone.utc).timestamp())
                remaining = max(exp - now, 0)
                await redis_client.blacklist_token(jti, remaining)
        except Exception:
            pass  # Token already invalid, ignore

    logger.info("User logged out: %s", current_user.username)


@router.get("/me", response_model=UserResponse)
async def get_profile(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Get current user profile."""
    role_name = current_user.role.name.value if isinstance(current_user.role.name, RoleName) else current_user.role.name
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        role=role_name,
        is_active=current_user.is_active,
        last_login=current_user.last_login,
        created_at=current_user.created_at,
    )


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    data: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Update current user profile."""
    if data.first_name is not None:
        current_user.first_name = data.first_name
    if data.last_name is not None:
        current_user.last_name = data.last_name
    if data.username is not None:
        # Check uniqueness
        existing = await db.execute(
            select(User).where(User.username == data.username, User.id != current_user.id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already taken",
            )
        current_user.username = data.username

    await db.commit()

    role_name = current_user.role.name.value if isinstance(current_user.role.name, RoleName) else current_user.role.name
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        role=role_name,
        is_active=current_user.is_active,
        last_login=current_user.last_login,
        created_at=current_user.created_at,
    )
