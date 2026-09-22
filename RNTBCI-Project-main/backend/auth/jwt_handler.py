"""RNTBCI Smart Home Digital Twin - Authentication Service.

Handles JWT token creation/validation, password hashing, and RBAC checks.
"""

from __future__ import annotations
import logging
import uuid
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.config import get_settings
from backend.models import Permission, Role, RoleName, User

logger = logging.getLogger(__name__)
settings = get_settings()
ph = PasswordHasher()

# Token types
ACCESS_TOKEN = "access"
REFRESH_TOKEN = "refresh"

# Rejected algorithms for security
REJECTED_ALGORITHMS = ["none", "None", "NONE"]


def hash_password(password: str) -> str:
    """Hash a password using Argon2."""
    return ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its Argon2 hash."""
    try:
        return ph.verify(hashed_password, plain_password)
    except VerifyMismatchError:
        return False


def validate_password_strength(password: str) -> tuple[bool, str]:
    """Validate password meets minimum strength requirements.

    Requirements:
    - Minimum 8 characters
    - No maximum length restriction (up to 128 chars for practical limits)
    - All characters allowed
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if len(password) > 128:
        return False, "Password must not exceed 128 characters"
    return True, ""


def create_token(
    user_id: str,
    role: str,
    token_type: str = ACCESS_TOKEN,
) -> str:
    """Create a JWT token.

    Args:
        user_id: The user's UUID as string.
        role: The user's role name.
        token_type: Either 'access' or 'refresh'.

    Returns:
        Encoded JWT string.
    """
    now = datetime.now(timezone.utc)

    if token_type == ACCESS_TOKEN:
        expire = now + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    else:
        expire = now + timedelta(days=settings.jwt_refresh_token_expire_days)

    payload = {
        "sub": user_id,
        "role": role,
        "type": token_type,
        "iat": now,
        "exp": expire,
        "jti": str(uuid.uuid4()),
    }

    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token.

    Hardcodes the expected algorithm for verification (never derived from token).
    Rejects 'none' algorithm.

    Returns:
        Decoded payload dict.

    Raises:
        JWTError: If token is invalid, expired, or uses rejected algorithm.
    """
    try:
        # Hardcode algorithm - never derive from unverified token
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            options={
                "require_exp": True,
                "require_iat": True,
                "require_sub": True,
            },
        )

        # Additional safety: reject 'none' algorithm tokens
        header = jwt.get_unverified_header(token)
        if header.get("alg") in REJECTED_ALGORITHMS:
            raise JWTError("Algorithm 'none' is not allowed")

        return payload
    except JWTError:
        raise


def create_token_pair(user_id: str, role: str) -> dict:
    """Create both access and refresh tokens.

    Returns:
        Dict with 'access_token', 'refresh_token', and 'token_type'.
    """
    return {
        "access_token": create_token(user_id, role, ACCESS_TOKEN),
        "refresh_token": create_token(user_id, role, REFRESH_TOKEN),
        "token_type": "bearer",
    }


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Look up a user by email address."""
    result = await db.execute(
        select(User)
        .options(selectinload(User.role))
        .where(User.email == email)
    )
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    """Look up a user by ID."""
    result = await db.execute(
        select(User)
        .options(selectinload(User.role))
        .where(User.id == user_id)
    )
    return result.scalar_one_or_none()


async def get_role_by_name(db: AsyncSession, role_name: RoleName) -> Role | None:
    """Look up a role by name."""
    result = await db.execute(
        select(Role).where(Role.name == role_name)
    )
    return result.scalar_one_or_none()


async def check_permission(
    db: AsyncSession,
    role_id: uuid.UUID,
    resource: str,
    action: str,
) -> bool:
    """Check if a role has permission for a resource+action."""
    result = await db.execute(
        select(Permission).where(
            Permission.role_id == role_id,
            Permission.resource == resource,
            Permission.action == action,
        )
    )
    return result.scalar_one_or_none() is not None


async def authenticate_user(
    db: AsyncSession,
    email: str,
    password: str,
) -> User | None:
    """Authenticate a user by email and password.

    Returns the User if valid, None otherwise.
    Does NOT log credentials on failure.
    """
    user = await get_user_by_email(db, email)
    if not user:
        logger.info("Authentication failed: user not found")
        return None

    if not user.is_active:
        logger.info("Authentication failed: user account inactive")
        return None

    if not verify_password(password, user.password_hash):
        logger.info("Authentication failed: invalid credentials")
        return None

    # Update last login
    user.last_login = datetime.now(timezone.utc)
    await db.commit()

    return user
