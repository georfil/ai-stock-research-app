from datetime import datetime, timezone, timedelta
from pwdlib import PasswordHash
from jose import jwt

from app.core.config import get_config

password_hash = PasswordHash.recommended()

def hash_password(raw_password: str) -> str:
    """Hash a plaintext password."""
    return password_hash.hash(raw_password)

def verify_password(raw_password: str, hashed_password: str) -> bool:
    """Check a plaintext password against a hash."""
    return password_hash.verify(raw_password, hashed_password)

def create_access_token(user_id: str, username: str) -> str:
    encode = {"sub": username, "id": user_id}
    expires = datetime.now(timezone.utc) + timedelta(minutes=get_config().jwt_expire_minutes)
    encode.update({'exp': expires})
    return jwt.encode(
        encode,
        key=get_config().jwt_secret_key.get_secret_value(),
        algorithm=get_config().jwt_algorithm,
    )
