
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie, Document, Link
from pydantic import Field
from typing import Optional, List
from datetime import datetime

# Redefining minimal models for diagnostic script to avoid import errors
class User(Document):
    email: str
    role: str
    class Settings:
        name = "users"

class Course(Document):
    title: str
    teacher: Link[User]
    class Settings:
        name = "courses"

class CalendarEvent(Document):
    title: str
    course: Link[Course]
    creator_id: str
    class Settings:
        name = "calendar_events"

async def test():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    await init_beanie(database=client.cleverclassroom, document_models=[User, Course, CalendarEvent])
    
    print("\n--- DIAGNOSTIC: FINDING ONE CALENDAR EVENT ---")
    event_raw = await CalendarEvent.get_motor_collection().find_one()
    if event_raw:
        print(f"RAW DOCUMENT: {event_raw}")
        print(f"Course field structure: {event_raw.get('course')}")
    else:
        print("No events found in DB!")

    print("\n--- DIAGNOSTIC: FINDING ONE COURSE ---")
    course_raw = await Course.get_motor_collection().find_one()
    if course_raw:
        print(f"RAW DOCUMENT: {course_raw}")
        print(f"Teacher field structure: {course_raw.get('teacher')}")
    else:
        print("No courses found in DB!")

if __name__ == "__main__":
    asyncio.run(test())
