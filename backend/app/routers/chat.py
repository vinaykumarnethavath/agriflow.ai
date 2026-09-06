from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select, or_, and_
from sqlmodel.ext.asyncio.session import AsyncSession
from pydantic import BaseModel

from ..deps import get_current_user
from ..database import get_session
from ..models.user import User, UserRole
from ..models.chat import ChatChannel, ChannelMember, ChatMessage, ChannelType
from ..models.farmer import FarmerProfile
from ..models.shop import ShopProfile
from ..models.manufacturer import MillProfile
from ..models.customer import CustomerProfile

router = APIRouter(prefix="/chat", tags=["chat"])

# ── Response/Request Models ──────────────────────────────────────────────────

class ChannelRead(BaseModel):
    id: int
    name: str
    channel_type: ChannelType
    location_tag: Optional[str] = None
    created_at: datetime
    last_message: Optional[str] = None
    last_message_time: Optional[datetime] = None

class MessageRead(BaseModel):
    id: int
    channel_id: int
    sender_id: int
    sender_name: str
    message_text: str
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    sender_role: Optional[str] = None
    created_at: datetime

class MessageCreate(BaseModel):
    message_text: str
    media_url: Optional[str] = None
    media_type: Optional[str] = None

class FarmerListItem(BaseModel):
    id: int
    full_name: str
    role: UserRole
    phone_number: Optional[str] = None
    village: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    profile_picture_url: Optional[str] = None

# ── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/channels", response_model=List[ChannelRead])
async def get_my_channels(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    """
    Get all chat channels (P2P and Groups) that the current user belongs to.
    Automatically ensures the user is joined to their regional Group chats (State & District)
    if they have a FarmerProfile.
    """
    # 1. Fetch user's profile to find their state and district
    stmt_profile = select(FarmerProfile).where(FarmerProfile.user_id == current_user.id)
    profile_res = await db.execute(stmt_profile)
    profile = profile_res.scalar_one_or_none()

    if profile:
        # Check and join State Group
        if profile.state:
            state_group_name = f"{profile.state} Farmers Group"
            stmt_ch = select(ChatChannel).where(
                and_(ChatChannel.channel_type == ChannelType.GROUP, ChatChannel.name == state_group_name)
            )
            ch_res = await db.execute(stmt_ch)
            channel = ch_res.scalar_one_or_none()

            if not channel:
                channel = ChatChannel(
                    name=state_group_name,
                    channel_type=ChannelType.GROUP,
                    location_tag=profile.state
                )
                db.add(channel)
                await db.commit()
                await db.refresh(channel)

            # Ensure membership
            stmt_mem = select(ChannelMember).where(
                and_(ChannelMember.channel_id == channel.id, ChannelMember.user_id == current_user.id)
            )
            mem_res = await db.execute(stmt_mem)
            if not mem_res.scalar_one_or_none():
                db.add(ChannelMember(channel_id=channel.id, user_id=current_user.id))
                await db.commit()

        # Check and join District Group
        if profile.district:
            dist_group_name = f"{profile.district} District Community"
            stmt_ch = select(ChatChannel).where(
                and_(ChatChannel.channel_type == ChannelType.GROUP, ChatChannel.name == dist_group_name)
            )
            ch_res = await db.execute(stmt_ch)
            channel = ch_res.scalar_one_or_none()

            if not channel:
                channel = ChatChannel(
                    name=dist_group_name,
                    channel_type=ChannelType.GROUP,
                    location_tag=profile.district
                )
                db.add(channel)
                await db.commit()
                await db.refresh(channel)

            # Ensure membership
            stmt_mem = select(ChannelMember).where(
                and_(ChannelMember.channel_id == channel.id, ChannelMember.user_id == current_user.id)
            )
            mem_res = await db.execute(stmt_mem)
            if not mem_res.scalar_one_or_none():
                db.add(ChannelMember(channel_id=channel.id, user_id=current_user.id))
                await db.commit()

    # 2. Query all channels where user is a member
    stmt_my_ch = select(ChatChannel).join(ChannelMember).where(ChannelMember.user_id == current_user.id)
    my_ch_res = await db.execute(stmt_my_ch)
    my_channels = my_ch_res.scalars().all()

    response_list = []
    for ch in my_channels:
        # Get last message details
        stmt_last = select(ChatMessage).where(ChatMessage.channel_id == ch.id).order_by(ChatMessage.created_at.desc()).limit(1)
        last_res = await db.execute(stmt_last)
        last_msg = last_res.scalar_one_or_none()

        name = ch.name
        # If P2P, we should display the OTHER participant's name rather than "P2P Chat"
        if ch.channel_type == ChannelType.P2P:
            stmt_other = select(User).join(ChannelMember).where(
                and_(ChannelMember.channel_id == ch.id, ChannelMember.user_id != current_user.id)
            )
            other_res = await db.execute(stmt_other)
            other_user = other_res.scalar_one_or_none()
            if other_user:
                name = other_user.full_name

        response_list.append(ChannelRead(
            id=ch.id,
            name=name,
            channel_type=ch.channel_type,
            location_tag=ch.location_tag,
            created_at=ch.created_at,
            last_message=last_msg.message_text if last_msg else None,
            last_message_time=last_msg.created_at if last_msg else None
        ))

    # Sort channels by last message time descending
    response_list.sort(key=lambda x: x.last_message_time or x.created_at, reverse=True)
    return response_list

@router.get("/discover", response_model=List[FarmerListItem])
async def discover_local_farmers(
    query: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    """
    Search and find any registered user by name or phone number to initiate chat.
    Searches across all roles: Farmer, Shop, Manufacturer, Customer, Expert.
    """
    stmt = select(User).where(User.id != current_user.id)

    if query:
        clean_q = query.strip()
        # If query looks like a phone number (mostly digits), search by phone
        if clean_q.replace("+", "").replace("-", "").replace(" ", "").isdigit():
            stmt = stmt.where(User.phone_number.ilike(f"%{clean_q}%"))
        else:
            stmt = stmt.where(User.full_name.ilike(f"%{clean_q}%"))

    # Limit results to avoid huge lists
    stmt = stmt.limit(50)
    res = await db.execute(stmt)
    users = res.scalars().all()

    # Deduplicate by user id (in case of multiple accounts with same phone across roles)
    seen_ids = set()
    result = []
    for u in users:
        if u.id in seen_ids:
            continue
        seen_ids.add(u.id)

        district = None
        state = None
        village = None
        profile_picture_url = None
        phone = u.phone_number

        # Try to get profile info from the user's role-specific table
        if u.role == UserRole.FARMER or u.role == UserRole.EXPERT:
            p_res = await db.execute(select(FarmerProfile).where(FarmerProfile.user_id == u.id))
            p = p_res.scalar_one_or_none()
            if p:
                district = p.district
                state = p.state
                village = p.village
                profile_picture_url = p.profile_picture_url
                if not phone:
                    phone = p.phone_number
        elif u.role == UserRole.SHOP:
            p_res = await db.execute(select(ShopProfile).where(ShopProfile.user_id == u.id))
            p = p_res.scalar_one_or_none()
            if p:
                district = p.district
                state = p.state
                village = p.village
                profile_picture_url = p.profile_picture_url
                if not phone:
                    phone = p.phone_number or p.contact_number
        elif u.role == UserRole.MANUFACTURER:
            p_res = await db.execute(select(MillProfile).where(MillProfile.user_id == u.id))
            p = p_res.scalar_one_or_none()
            if p:
                district = p.district
                state = p.state
                village = p.village
                profile_picture_url = p.profile_picture_url
                if not phone:
                    phone = p.phone_number or p.contact_number
        elif u.role == UserRole.CUSTOMER:
            p_res = await db.execute(select(CustomerProfile).where(CustomerProfile.user_id == u.id))
            p = p_res.scalar_one_or_none()
            if p:
                district = p.district
                state = p.state
                village = p.village
                profile_picture_url = p.profile_picture_url
                if not phone:
                    phone = p.phone_number

        # Skip users that have no real name (placeholder OTP accounts)
        if not u.full_name or "@" in u.full_name:
            continue

        result.append(FarmerListItem(
            id=u.id,
            full_name=u.full_name,
            role=u.role,
            phone_number=phone,
            village=village,
            district=district,
            state=state,
            profile_picture_url=profile_picture_url
        ))
    return result

@router.post("/channels/p2p/{other_user_id}", response_model=ChannelRead)
async def start_p2p_chat(
    other_user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    """
    Check if a P2P chat channel already exists with other_user_id.
    If not, create one and register both users as members.
    """
    if other_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot chat with yourself.")

    # Fetch other user details
    stmt_user = select(User).where(User.id == other_user_id)
    u_res = await db.execute(stmt_user)
    other_user = u_res.scalar_one_or_none()
    if not other_user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Find existing P2P channel
    stmt_ch = select(ChatChannel).join(ChannelMember).where(
        and_(ChatChannel.channel_type == ChannelType.P2P, ChannelMember.user_id == current_user.id)
    )
    res_ch = await db.execute(stmt_ch)
    my_p2ps = res_ch.scalars().all()

    existing_channel = None
    for ch in my_p2ps:
        stmt_mem = select(ChannelMember).where(
            and_(ChannelMember.channel_id == ch.id, ChannelMember.user_id == other_user_id)
        )
        mem_res = await db.execute(stmt_mem)
        if mem_res.scalar_one_or_none():
            existing_channel = ch
            break

    if existing_channel:
        return ChannelRead(
            id=existing_channel.id,
            name=other_user.full_name,
            channel_type=existing_channel.channel_type,
            location_tag=existing_channel.location_tag,
            created_at=existing_channel.created_at
        )

    # Create new P2P channel
    new_ch = ChatChannel(
        name=f"P2P {current_user.id}-{other_user_id}",
        channel_type=ChannelType.P2P
    )
    db.add(new_ch)
    await db.commit()
    await db.refresh(new_ch)

    # Add members
    db.add(ChannelMember(channel_id=new_ch.id, user_id=current_user.id))
    db.add(ChannelMember(channel_id=new_ch.id, user_id=other_user_id))
    await db.commit()

    return ChannelRead(
        id=new_ch.id,
        name=other_user.full_name,
        channel_type=new_ch.channel_type,
        location_tag=new_ch.location_tag,
        created_at=new_ch.created_at
    )

@router.get("/channels/{channel_id}/messages", response_model=List[MessageRead])
async def get_messages(
    channel_id: int,
    lang: Optional[str] = Query("en"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    """
    Get messages for a channel. Verifies membership first.
    Auto-translates message text if lang != 'en'.
    """
    stmt_mem = select(ChannelMember).where(
        and_(ChannelMember.channel_id == channel_id, ChannelMember.user_id == current_user.id)
    )
    mem_res = await db.execute(stmt_mem)
    if not mem_res.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized to access this chat room.")

    stmt_msg = select(ChatMessage, User.role).join(User, ChatMessage.sender_id == User.id).where(ChatMessage.channel_id == channel_id).order_by(ChatMessage.created_at.asc())
    msg_res = await db.execute(stmt_msg)
    messages = msg_res.all()

    msg_reads = [
        MessageRead(
            id=m.ChatMessage.id,
            channel_id=m.ChatMessage.channel_id,
            sender_id=m.ChatMessage.sender_id,
            sender_name=m.ChatMessage.sender_name,
            message_text=m.ChatMessage.message_text,
            media_url=m.ChatMessage.media_url,
            media_type=m.ChatMessage.media_type,
            sender_role=m.role,
            created_at=m.ChatMessage.created_at
        ) for m in messages
    ]

    if lang and lang != "en" and msg_reads:
        try:
            from .translate import translate_texts_batch
            texts = [m.message_text for m in msg_reads]
            translated = await translate_texts_batch(texts, target_lang=lang)
            for idx, m in enumerate(msg_reads):
                if translated[idx]:
                    m.message_text = translated[idx]
        except Exception as e:
            print(f"[chat] Auto-translate messages error: {e}")

    return msg_reads


@router.post("/channels/{channel_id}/messages", response_model=MessageRead)
async def send_message(
    channel_id: int,
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    """
    Send a message to a channel.
    """
    stmt_mem = select(ChannelMember).where(
        and_(ChannelMember.channel_id == channel_id, ChannelMember.user_id == current_user.id)
    )
    mem_res = await db.execute(stmt_mem)
    if not mem_res.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this chat channel.")

    new_msg = ChatMessage(
        channel_id=channel_id,
        sender_id=current_user.id,
        sender_name=current_user.full_name,
        message_text=payload.message_text,
        media_url=payload.media_url,
        media_type=payload.media_type
    )
    db.add(new_msg)
    await db.commit()
    await db.refresh(new_msg)

    return MessageRead(
        id=new_msg.id,
        channel_id=new_msg.channel_id,
        sender_id=new_msg.sender_id,
        sender_name=new_msg.sender_name,
        message_text=new_msg.message_text,
        media_url=new_msg.media_url,
        media_type=new_msg.media_type,
        sender_role=current_user.role,
        created_at=new_msg.created_at
    )

@router.get("/channels/groups/all", response_model=List[ChannelRead])
async def get_all_group_channels(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    """
    Get all group channels available to join.
    """
    stmt = select(ChatChannel).where(ChatChannel.channel_type == ChannelType.GROUP)
    res = await db.execute(stmt)
    groups = res.scalars().all()
    
    response_list = []
    for ch in groups:
        response_list.append(ChannelRead(
            id=ch.id,
            name=ch.name,
            channel_type=ch.channel_type,
            location_tag=ch.location_tag,
            created_at=ch.created_at
        ))
    return response_list

@router.post("/channels/{channel_id}/join")
async def join_channel(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    """
    Join a specific group channel.
    """
    stmt_ch = select(ChatChannel).where(ChatChannel.id == channel_id)
    res_ch = await db.execute(stmt_ch)
    channel = res_ch.scalar_one_or_none()
    
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
        
    if channel.channel_type != ChannelType.GROUP:
        raise HTTPException(status_code=400, detail="Can only join group channels directly")
        
    stmt_mem = select(ChannelMember).where(
        and_(ChannelMember.channel_id == channel_id, ChannelMember.user_id == current_user.id)
    )
    res_mem = await db.execute(stmt_mem)
    if not res_mem.scalar_one_or_none():
        db.add(ChannelMember(channel_id=channel_id, user_id=current_user.id))
        await db.commit()
    
    return {"status": "joined"}
