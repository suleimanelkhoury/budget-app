"""Custom exception classes for the Budget App.

These are raised by application code and caught by the global exception
handlers registered in app/main.py, which convert them into consistent
JSON error responses with German/English messages.
"""

from fastapi import HTTPException, status


class AppException(HTTPException):
    """Base exception for all app-specific errors.

    Attributes:
        detail_en: English error message.
        detail_de: German error message.
    """

    def __init__(
        self,
        status_code: int,
        detail_en: str,
        detail_de: str,
        headers: dict[str, str] | None = None,
    ) -> None:
        # Store both languages; the handler will pick based on Accept-Language
        self.detail_en = detail_en
        self.detail_de = detail_de
        super().__init__(
            status_code=status_code,
            detail={"en": detail_en, "de": detail_de},
            headers=headers,
        )


class NotFoundError(AppException):
    """Raised when a requested resource doesn't exist (404)."""

    def __init__(self, resource: str, resource_id: int | str | None = None) -> None:
        identifier = f" with id {resource_id}" if resource_id is not None else ""
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail_en=f"{resource}{identifier} not found.",
            detail_de=f"{resource}{identifier} nicht gefunden.",
        )


class ForbiddenError(AppException):
    """Raised when a user tries to access another user's resource (403)."""

    def __init__(self, resource: str = "This resource") -> None:
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail_en=f"{resource} — you do not have access to this.",
            detail_de=f"{resource} — Sie haben keinen Zugriff darauf.",
        )


class BadRequestError(AppException):
    """Raised for malformed or invalid requests (400)."""

    def __init__(self, detail_en: str, detail_de: str) -> None:
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail_en=detail_en,
            detail_de=detail_de,
        )


class ConflictError(AppException):
    """Raised for duplicate/conflicting data (409)."""

    def __init__(self, detail_en: str, detail_de: str) -> None:
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail_en=detail_en,
            detail_de=detail_de,
        )
