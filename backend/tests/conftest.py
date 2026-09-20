import pytest
import os
import sys

# Ensure backend directory is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.models.base import Base
from app.database.connection import get_db
from app.main import app

# Test SQLite in-memory database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="session", autouse=True)
def override_ai_provider_to_mock():
    """
    Forces all API-level tests to use MockAIProvider regardless of the
    AI_PROVIDER environment variable set in .env.
    This keeps general tests fast, deterministic, and self-contained.
    ResNet18-specific tests inject the real provider explicitly themselves.
    """
    from app.services import MockAIProvider
    import app.api.studies as studies_router_module

    original_service = studies_router_module.study_service
    from app.services.study_service import StudyService
    mock_service = StudyService(ai_service=__import__("app.services.ai_service", fromlist=["AIService"]).AIService(provider=MockAIProvider()))
    studies_router_module.study_service = mock_service
    yield
    studies_router_module.study_service = original_service


@pytest.fixture
def db_session():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
