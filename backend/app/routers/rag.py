"""
RAG Chat Router — Privacy-Aware AI Assistant
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from pydantic import BaseModel
from typing import Optional

from ..database import get_session
from ..deps import get_current_user
from ..models.user import User
from ..services.rag_service import handle_chat

router = APIRouter(prefix="/rag", tags=["rag"])


class ChatRequest(BaseModel):
    question: str
    lang: Optional[str] = "en"


class ChatResponse(BaseModel):
    answer: str
    source: str  # db_only | external | mixed
    data_points: Optional[dict] = None


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    result = await handle_chat(current_user, request.question.strip(), session, target_lang=request.lang or "en")
    return ChatResponse(**result)

