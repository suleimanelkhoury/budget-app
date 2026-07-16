"""Structured logging configuration using structlog.

Call `setup_logging()` once at application startup (in main.py) to configure
both structlog and the standard logging bridge.
"""

import logging
import sys

import structlog


def setup_logging(debug: bool = False) -> None:
    """Configure structured logging for the entire application.

    Args:
        debug: If True, use pretty console output for development.
               If False, use JSON output for production.
    """
    # Shared processors for structlog
    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    structlog.configure(
        processors=[
            *shared_processors,
            # Choose renderer based on debug mode
            structlog.dev.ConsoleRenderer()
            if debug
            else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Bridge stdlib logging to structlog so uvicorn/sqlalchemy logs are captured
    logging.basicConfig(
        level=logging.DEBUG if debug else logging.INFO,
        stream=sys.stdout,
        format="%(message)s",
        force=True,
    )

    # Route uvicorn and sqlalchemy logs through structlog
    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access", "sqlalchemy"):
        logger = logging.getLogger(logger_name)
        logger.handlers = []
        logger.propagate = True


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Return a structured logger instance.

    Args:
        name: Optional logger name (typically __name__).

    Returns:
        A bound structlog logger.
    """
    return structlog.stdlib.get_logger(name)
