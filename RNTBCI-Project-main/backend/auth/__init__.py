"""Auth package."""

from backend.auth.dependencies import (
    get_current_user,
    require_admin,
    require_permission,
    require_user_or_admin,
)
from backend.auth.jwt_handler import (
    authenticate_user,
    create_token_pair,
    decode_token,
    hash_password,
    validate_password_strength,
    verify_password,
)

__all__ = [
    "get_current_user",
    "require_admin",
    "require_permission",
    "require_user_or_admin",
    "authenticate_user",
    "create_token_pair",
    "decode_token",
    "hash_password",
    "validate_password_strength",
    "verify_password",
]
