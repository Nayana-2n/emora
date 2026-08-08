from pydantic import BaseModel, Field, field_validator
from typing import Optional


class UserCreate(BaseModel):
    email: str
    password: str = Field(min_length=6, max_length=128)
    display_name: Optional[str] = Field(default=None, max_length=50)

    @field_validator("email")
    @classmethod
    def email_must_be_valid(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Enter a valid email address")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=50)


class JournalCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)
    mood_tag: Optional[str] = None
    section: Optional[str] = None
    date: Optional[str] = None


class JournalUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    mood_tag: Optional[str] = None
    section: Optional[str] = None


class MoodCreate(BaseModel):
    mood: int = Field(ge=1, le=5)
    note: Optional[str] = None
    emotion: Optional[str] = None
    stress: Optional[int] = Field(default=None, ge=0, le=100)
    date: Optional[str] = None


class HabitCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    category: Optional[str] = Field(default=None, max_length=50)
    priority: int = Field(default=2, ge=1, le=3)
    description: Optional[str] = Field(default=None, max_length=300)
    frequency: Optional[str] = Field(default=None, max_length=50)


class HabitToggle(BaseModel):
    date: Optional[str] = None
    completed: Optional[bool] = None


class WaterCreate(BaseModel):
    amount_ml: int = Field(default=250, ge=1, le=2000)
    date: Optional[str] = None


class WaterGoalUpdate(BaseModel):
    goal_ml: int = Field(ge=500, le=4000)


class SleepCreate(BaseModel):
    hours: float = Field(ge=0, le=24)
    quality: int = Field(ge=1, le=5)
    date: Optional[str] = None
