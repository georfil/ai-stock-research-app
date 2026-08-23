from fastapi import APIRouter, HTTPException, status
from sqlmodel import select

from app.schemas import UserCreate, UserLogin
from app.models import User
from app.core.deps import SessionDep

from app.core.security import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/register", status_code=status.HTTP_201_CREATED)
def create_user(session: SessionDep, data: UserCreate):

    #Check if user already exists
    existing_user  = session.exec(
        select(User).where(User.username == data.username)
    ).first()

    if existing_user :
        raise HTTPException(status_code=400, detail="Username already taken")

    #Hash Password
    hashed_password = hash_password(data.raw_password)

    #Create User
    new_user = User(username=data.username, hashed_password=hashed_password)
    session.add(new_user)
    session.commit()

    return {"message" : "User Created Successfully!"}

@router.post("/login")
def login(session: SessionDep, data: UserLogin):

    #Verify username and password
    user  = session.exec(
        select(User).where(User.username == data.username)
    ).first()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    #Create JWT Token and return it
    token = create_access_token(user_id=user.id, username=user.username)
    return {'access_token': token, 'token_type': 'bearer'}
