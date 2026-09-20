import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_auth_login():
    res = client.post('/api/v1/auth/login', json={'email': 'dr.vance@radix.ai', 'password': 'securePass123'})
    assert res.status_code == 200
    data = res.json()
    assert data['success'] is True
    assert 'radix_jwt_' in data['token']
    assert data['user']['email'] == 'dr.vance@radix.ai'

def test_auth_register():
    res = client.post('/api/v1/auth/register', json={
        'email': 'new.fellow@radix.ai',
        'password': 'fellowPass123',
        'name': 'Dr. Jane Doe',
        'role': 'Radiology Fellow'
    })
    assert res.status_code == 200
    data = res.json()
    assert data['success'] is True
    assert data['user']['name'] == 'Dr. Jane Doe'

def test_auth_forgot_and_reset_password():
    res1 = client.post('/api/v1/auth/forgot-password', json={'email': 'dr.vance@radix.ai'})
    assert res1.status_code == 200
    assert res1.json()['success'] is True

    res2 = client.post('/api/v1/auth/reset-password', json={'token': 'sample_tok', 'newPassword': 'brandNewPass'})
    assert res2.status_code == 200
    assert res2.json()['success'] is True

def test_analytics_frontend_endpoints():
    res_sum = client.get('/api/v1/analytics/summary')
    assert res_sum.status_code == 200
    assert 'processingMetrics' in res_sum.json()
    assert 'priorityDistribution' in res_sum.json()

    res_ai = client.get('/api/v1/analytics/ai-performance')
    assert res_ai.status_code == 200
    assert 'DenseNet121' in res_ai.json()['modelName']

    res_act = client.get('/api/v1/analytics/activity')
    assert res_act.status_code == 200
    assert len(res_act.json()) > 0

def test_queue_has_frontend_fields():
    res = client.get('/api/v1/queue')
    assert res.status_code == 200
    data = res.json()
    assert 'items' in data
    assert 'studies' in data
    if data['items']:
        first = data['items'][0]
        assert 'study_id' in first
        assert 'patient_id' in first
        assert 'priority_score' in first

def test_frontend_app_mount():
    res = client.get('/app')
    assert res.status_code in (200, 307)
