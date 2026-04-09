from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.models.user import User, UserRole
from passlib.context import CryptContext

router = APIRouter()
# Prefer pbkdf2_sha256 to avoid bcrypt backend incompatibilities on some environments.
# Keep bcrypt for backward verification of already-registered users.
pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")

class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: UserRole = UserRole.USER

class UserLogin(BaseModel):
    email: str
    password: str


async def _verify_user_password(user: User, provided_password: str) -> bool:
    stored = user.hashed_password or ""
    if not stored:
        return False

    # Normal path for properly hashed passwords.
    try:
        if pwd_context.verify(provided_password, stored):
            return True
    except Exception:
        pass

    # Legacy fallback: some historical demo users were stored as plain text.
    if stored == provided_password:
        user.hashed_password = pwd_context.hash(provided_password)
        await user.save()
        return True

    return False

@router.post("/register")
async def register(user_data: UserCreate):
    existing_user = await User.find_one(User.email == user_data.email)
    if existing_user:
        if not (existing_user.hashed_password or "").strip():
            existing_user.name = user_data.name
            existing_user.role = user_data.role
            existing_user.hashed_password = pwd_context.hash(user_data.password)
            await existing_user.save()
            return {"message": "Account recovered successfully", "id": str(existing_user.id)}
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = pwd_context.hash(user_data.password)
    user = User(
        email=user_data.email, 
        hashed_password=hashed_password, 
        name=user_data.name,
        role=user_data.role
    )
    await user.insert()
    return {"message": "User registered successfully", "id": str(user.id)}

@router.post("/login")
async def login(login_data: UserLogin):
    user = await User.find_one(User.email == login_data.email)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    if not await _verify_user_password(user, login_data.password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    # In a real app, generate JWT here
    return {"message": "Login successful", "email": user.email, "role": user.role, "id": str(user.id), "name": user.name}
