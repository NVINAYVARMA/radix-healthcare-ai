from app.database.connection import engine
from app.models.base import Base
import app.models  # Ensure all models are registered
from app.core.logging import logger


def init_db():
    """Initializes the database by creating all defined tables if they do not exist."""
    logger.info("Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized successfully.")


if __name__ == "__main__":
    init_db()
