"""Authentication dependencies for FastAPI routes."""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.services.token_blocklist import is_token_revoked

# Token URL is the login endpoint; used by Swagger UI's "Authorize" button
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Credentials exception reused across auth checks
credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Decode the JWT token and return the corresponding User.

    Rejects revoked tokens (jti blocklist — see app/services/token_blocklist.py).
    Raises HTTP 401 if the token is invalid, revoked, or the user doesn't exist.
    """
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    jti = payload.get("jti")
    if jti is None:
        # Tokens issued before revocation support was added carry no jti.
        # Reject them so "logout" can't be bypassed with a legacy token.
        raise credentials_exception

    if is_token_revoked(db, jti):
        raise credentials_exception

    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception

    try:
        user_id = int(user_id_str)
    except ValueError:
        raise credentials_exception from None

    user = db.get(User, user_id)
    if user is None:
        raise credentials_exception

    return user
