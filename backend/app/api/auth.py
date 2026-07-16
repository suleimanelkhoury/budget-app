"""Authentication router — register and login endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.exceptions import ConflictError
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import Token, UserCreate, UserLogin, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=Token,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
def register(
    user_in: UserCreate,
    db: Session = Depends(get_db),
) -> Token:
    """Create a new user account and return a JWT token."""
    # Check if email is already registered
    existing = db.scalar(select(User).where(User.email == user_in.email))
    if existing is not None:
        raise ConflictError(
            detail_en="A user with this email already exists.",
            detail_de="Ein Benutzer mit dieser E-Mail-Adresse existiert bereits.",
        )

    # Create the user with a hashed password
    user = User(
        email=user_in.email,
        password_hash=hash_password(user_in.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Return a token so the client is immediately authenticated
    access_token = create_access_token(subject=user.id)
    return Token(
        access_token=access_token,
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/login",
    response_model=Token,
    summary="Login and receive a JWT token",
)
def login(
    user_in: UserLogin,
    db: Session = Depends(get_db),
) -> Token:
    """Authenticate a user with email + password and return a JWT token."""
    user = db.scalar(select(User).where(User.email == user_in.email))
    if user is None or not verify_password(user_in.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "en": "Incorrect email or password.",
                "de": "Falsche E-Mail oder Passwort.",
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(subject=user.id)
    return Token(
        access_token=access_token,
        user=UserResponse.model_validate(user),
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get the currently authenticated user",
)
def get_me(current_user: User = Depends(get_current_user)) -> User:
    """Return the profile of the logged-in user."""
    return current_user
