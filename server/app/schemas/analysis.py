from datetime import datetime

from pydantic import BaseModel, Field


class AnalysisJobCreate(BaseModel):
    owner_id: str = Field(default="local_user", max_length=80)
    job_type: str = Field(max_length=60)
    note_local_id: str | None = Field(default=None, max_length=120)
    input_text: str | None = None


class AnalysisJobUpdate(BaseModel):
    status: str = Field(max_length=30)
    result_json: str | None = None
    error_message: str | None = None


class AnalysisJobOut(BaseModel):
    id: int
    owner_id: str
    job_type: str
    note_local_id: str | None
    status: str
    input_text: str | None
    result_json: str | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
