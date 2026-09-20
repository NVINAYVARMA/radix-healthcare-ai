import sys, os, shutil, re
sys.path.insert(0, 'backend')

from app.core.config import settings
from app.database.connection import SessionLocal
from app.database.init_db import init_db
from app.models.study import Study, StudyStatus, PriorityLevel
from app.models.priority import PriorityFactor
from app.models.review import ReviewLog
from app.models.model_run import ModelRun
from datetime import datetime, timedelta, timezone

init_db()
db = SessionLocal()

with open('frontend/src/data/mockStudies.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Match each raw mock study block
pattern = r'id:\s*(\d+).*?patientId:\s*"([^"]+)".*?patientName:\s*"([^"]+)".*?age:\s*(\d+).*?sex:\s*"([^"]+)".*?modality:\s*"([^"]+)".*?bodyPart:\s*"([^"]+)".*?arrivalTime:\s*"([^"]+)".*?priority:\s*"([^"]+)".*?priorityScore:\s*([0-9.]+)'
matches = list(re.finditer(pattern, content, re.DOTALL))
print(f'Matched {len(matches)} studies from mockStudies.js')

db.query(PriorityFactor).delete()
db.query(ReviewLog).delete()
db.query(ModelRun).delete()
db.query(Study).delete()
db.commit()

storage_dir = settings.STORAGE_LOCAL_DIR
os.makedirs(storage_dir, exist_ok=True)

src_img = 'frontend/public/xray_frontal_hd.png'
if not os.path.exists(src_img):
    src_img = 'frontend/public/xray_frontal.png'

now = datetime.now(timezone.utc)

for idx, match in enumerate(matches, 1):
    s_id_num, patient_id, patient_name, age, sex, modality, body_part, arrival_time_str, priority, priority_score = match.groups()
    study_id = f'ST-{idx:03d}'
    score_float = float(priority_score)
    p_level = 'HIGH' if priority == 'High' else 'MEDIUM' if priority == 'Medium' else 'STANDARD'

    study_storage_dir = os.path.join(storage_dir, 'studies', study_id)
    os.makedirs(study_storage_dir, exist_ok=True)
    target_img = os.path.join(study_storage_dir, 'scan.png')
    shutil.copyfile(src_img, target_img)

    arrival_time = now - timedelta(minutes=int(idx * 15))

    study = Study(
        id=int(s_id_num),
        study_id=study_id,
        modality=modality.upper(),
        image_path=f'studies/{study_id}/scan.png',
        arrival_time=arrival_time,
        status=StudyStatus.PENDING_REVIEW.value if idx != 1 else StudyStatus.IN_REVIEW.value,
        ai_score=score_float,
        ai_confidence=0.95,
        priority_score=score_float,
        priority_level=p_level,
        image_quality_score=0.98
    )
    db.add(study)
    db.flush()

    factors = [
        PriorityFactor(
            study_id=study.id,
            factor_name='AI Abnormality Urgency',
            factor_value=score_float,
            weight=0.70,
            contribution=round(score_float * 0.70, 2),
            description=f'DenseNet121 acute pattern detection score ({score_float:.2f})'
        ),
        PriorityFactor(
            study_id=study.id,
            factor_name='Model Confidence',
            factor_value=0.95,
            weight=0.10,
            contribution=round(0.95 * 0.10, 2),
            description='Inference calibration certainty index'
        ),
        PriorityFactor(
            study_id=study.id,
            factor_name='Waiting Time Escalation',
            factor_value=round(idx * 0.02, 2),
            weight=0.10,
            contribution=round(idx * 0.002, 2),
            description='Queue dwell time anti-starvation adjustment'
        ),
        PriorityFactor(
            study_id=study.id,
            factor_name='Image Quality Check',
            factor_value=0.98,
            weight=0.10,
            contribution=round(0.98 * 0.10, 2),
            description='Diagnostic resolution and contrast compliance'
        )
    ]
    db.add_all(factors)

    mrun = ModelRun(
        study_id=study.id,
        model_name='DenseNet121-CheXNet-Backlog',
        model_version='2.0.0',
        score=score_float,
        confidence=0.95,
        processing_time_ms=1240.0
    )
    db.add(mrun)

db.commit()
print(f'Successfully seeded {len(matches)} studies into {settings.DATABASE_URL}')

root_db = 'radix.db'
shutil.copyfile('backend/radix.db', root_db)
print('Copied backend/radix.db to radix.db')