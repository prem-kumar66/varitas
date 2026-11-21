"""
Veritas Authentication & Security
==================================
Handles JWT generation and verification using HMAC-SHA256 (HS256).
Loads JWT_SECRET from backend/.env.
Provides FastAPI dependencies for requiring authenticated teacher and admin tokens.
"""
import base64
import hashlib
import hmac
import json
import os
import time
from typing import Optional, Dict, Any
from fastapi import Header, HTTPException, Query, Depends
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "veritas_academic_secret_jwt_2026")


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def create_access_token(data: Dict[str, Any], expires_delta: int = 86400 * 7) -> str:
    """Generate a signed JWT token with HS256."""
    header = {"alg": "HS256", "typ": "JWT"}
    payload = dict(data)
    now = int(time.time())
    payload.setdefault("iat", now)
    payload.setdefault("exp", now + expires_delta)

    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")

    secret_key = os.getenv("JWT_SECRET", JWT_SECRET).encode("utf-8")
    sig = hmac.new(secret_key, signing_input, hashlib.sha256).digest()
    sig_b64 = _b64url_encode(sig)

    return f"{header_b64}.{payload_b64}.{sig_b64}"


def verify_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify a signed JWT token with HS256."""
    if not token or not isinstance(token, str):
        return None

    parts = token.split(".")
    if len(parts) != 3:
        return None

    header_b64, payload_b64, sig_b64 = parts

    try:
        signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
        secret_key = os.getenv("JWT_SECRET", JWT_SECRET).encode("utf-8")
        expected_sig = hmac.new(secret_key, signing_input, hashlib.sha256).digest()
        actual_sig = _b64url_decode(sig_b64)

        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        payload_bytes = _b64url_decode(payload_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))

        if "exp" in payload and int(time.time()) > int(payload["exp"]):
            return None

        return payload
    except Exception:
        return None


def get_current_teacher_token(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    auth_header: Optional[str] = Header(None, alias="authorization"),
    x_auth_token: Optional[str] = Header(None, alias="x-auth-token"),
    token_query: Optional[str] = Query(None, alias="token"),
) -> Dict[str, Any]:
    """
    FastAPI dependency requiring a valid teacher or admin token.
    Accepts Bearer token in Authorization header, x-auth-token header, or query parameter.
    """
    raw = authorization or auth_header or x_auth_token
    token = None
    if raw:
        parts = raw.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]
        elif len(parts) == 1:
            token = parts[0]
    elif token_query:
        token = token_query

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Authentication token required for this route.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


def get_current_admin_token(
    token_data: Dict[str, Any] = Depends(get_current_teacher_token)
) -> Dict[str, Any]:
    """
    FastAPI dependency requiring admin privileges.
    """
    is_admin = (
        token_data.get("is_admin") is True
        or token_data.get("role") in ["Dean / Super Admin", "admin", "Admin"]
        or token_data.get("email", "").lower() == "admin@anurag.edu.in"
        or token_data.get("department") == "all"
    )
    if not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Administrative privileges required.",
        )
    return token_data
