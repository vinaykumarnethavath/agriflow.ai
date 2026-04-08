from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select

from .database import get_session
from .models import User
from .utils import SECRET_KEY, ALGORITHM

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

async def get_current_user(token: str = Depends(oauth2_scheme), session: AsyncSession = Depends(get_session)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        subject: str = payload.get("sub")
        role: str = payload.get("role")
        if subject is None:
            raise credentials_exception
    except Exception:
        raise credentials_exception

    statement = select(User).where((User.email == subject) | (User.phone_number == subject))
    if role is not None:
        statement = statement.where(User.role == role)
    result = await session.exec(statement)
    user = result.first()
    if user is None:
        raise credentials_exception
    return user
