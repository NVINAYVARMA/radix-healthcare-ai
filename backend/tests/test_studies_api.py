import io


def test_upload_study_success(client):
    file_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    files = {"file": ("chest_xray_critical.png", io.BytesIO(file_content), "image/png")}
    data = {"study_id": "XR-TEST-100", "modality": "X-RAY"}

    response = client.post("/api/v1/studies", data=data, files=files)
    assert response.status_code == 201
    res_data = response.json()
    assert res_data["study_id"] == "XR-TEST-100"
    assert res_data["status"] == "PENDING_REVIEW"


def test_upload_study_invalid_file_extension(client):
    file_content = b"Not an image file"
    files = {"file": ("report.txt", io.BytesIO(file_content), "text/plain")}

    response = client.post("/api/v1/studies", files=files)
    assert response.status_code == 400
    assert "Unsupported file format" in response.json()["detail"]


def test_upload_duplicate_study_id(client):
    file_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    files = {"file": ("scan1.png", io.BytesIO(file_content), "image/png")}
    data = {"study_id": "XR-DUP-01"}

    # First upload
    res1 = client.post("/api/v1/studies", data=data, files=files)
    assert res1.status_code == 201

    # Second upload with same ID
    files2 = {"file": ("scan2.png", io.BytesIO(file_content), "image/png")}
    res2 = client.post("/api/v1/studies", data=data, files=files2)
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"]


def test_get_study_detail(client):
    file_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    files = {"file": ("patient_scan.png", io.BytesIO(file_content), "image/png")}
    data = {"study_id": "XR-DETAIL-01"}

    client.post("/api/v1/studies", data=data, files=files)

    response = client.get("/api/v1/studies/XR-DETAIL-01")
    assert response.status_code == 200
    detail = response.json()
    assert detail["study_id"] == "XR-DETAIL-01"
    assert detail["modality"] == "X-RAY"
    assert detail["ai_score"] is not None
    assert detail["ai_confidence"] is not None
    assert detail["image_url"].startswith("/api/v1/storage/")
    assert len(detail["model_runs"]) >= 1


def test_get_study_not_found(client):
    response = client.get("/api/v1/studies/XR-NONEXISTENT")
    assert response.status_code == 404


def test_list_studies_filtering(client):
    # Upload two studies
    file_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    client.post(
        "/api/v1/studies",
        data={"study_id": "XR-LIST-01"},
        files={"file": ("scan_a.png", io.BytesIO(file_content), "image/png")}
    )
    client.post(
        "/api/v1/studies",
        data={"study_id": "XR-LIST-02"},
        files={"file": ("scan_b.png", io.BytesIO(file_content), "image/png")}
    )

    response = client.get("/api/v1/studies?limit=10")
    assert response.status_code == 200
    items = response.json()
    assert len(items) >= 2
    study_ids = [item["study_id"] for item in items]
    assert "XR-LIST-01" in study_ids
    assert "XR-LIST-02" in study_ids
