from sqlalchemy.orm import Session
from app.models import AuditLog


def log_audit(
    db: Session,
    user_id: int | None,
    user_name: str,
    action: str,
    entity: str,
    entity_id: int | None,
    description: str,
):
    entry = AuditLog(
        user_id=user_id,
        user_name=user_name,
        action=action,
        entity=entity,
        entity_id=entity_id,
        description=description,
    )
    db.add(entry)
