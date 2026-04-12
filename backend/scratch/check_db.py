
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.models.calendar_event import CalendarEvent
from app.models.course import Course
from app.models.user import User

async def test():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    await init_beanie(database=client.cleverclassroom, document_models=[CalendarEvent, Course, User])
    
    events = await CalendarEvent.find_all(fetch_links=True).to_list()
    print(f"\n--- TOTAL EVENTS IN DB: {len(events)} ---")
    for e in events:
        print(f"Title: {e.title}")
        print(f"  Date: {e.date}")
        if e.course:
            print(f"  Course Title: {e.course.title}")
            print(f"  Course ID: {e.course.id}")
        else:
            print(f"  NO COURSE LINKED")
        print(f"  Creator: {e.creator_id}")
        print("-" * 20)
    
    courses = await Course.find_all().to_list()
    print(f"\n--- TOTAL COURSES IN DB: {len(courses)} ---")
    for c in courses:
        print(f"Course: {c.title} (ID: {c.id})")

if __name__ == "__main__":
    asyncio.run(test())
