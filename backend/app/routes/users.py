"""User management routes."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Header, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Job, JobStatus, User, UserRole
from app.schemas import JobListResponse, JobResponse, UserCreate, UserResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/users", tags=["users"])


def get_current_user(
    x_user: str = Header(None),
) -> str:
    """Extract current user from header."""
    if not x_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User header (X-User) is required",
        )
    return x_user


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_create: UserCreate,
    session: AsyncSession = Depends(get_session),
    current_user: str = Depends(get_current_user),
) -> UserResponse:
    """Create a new user (admin only)."""
    try:
        # Check if user already exists
        result = await session.execute(
            select(User).where(User.username == user_create.username)
        )
        existing = result.scalar_one_or_none()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User {user_create.username} already exists",
            )

        # For now, just hash the password simply (in production use bcrypt)
        import hashlib

        password_hash = hashlib.sha256(user_create.password.encode()).hexdigest()

        # Create user
        user = User(
            username=user_create.username,
            password_hash=password_hash,
            display_name=user_create.display_name,
            email=user_create.email,
            role=UserRole(user_create.role) if user_create.role else UserRole.ADMIN,
        )

        session.add(user)
        await session.commit()
        logger.info(f"Created user {user_create.username} with role {user_create.role}")

        await session.refresh(user)
        return UserResponse.model_validate(user)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user",
        )


@router.get("", response_model=list[UserResponse])
async def list_users(
    session: AsyncSession = Depends(get_session),
    current_user: str = Depends(get_current_user),
) -> list[UserResponse]:
    """List all users."""
    try:
        result = await session.execute(select(User))
        users = result.scalars().all()

        return [UserResponse.model_validate(user) for user in users]

    except Exception as e:
        logger.error(f"Error listing users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list users",
        )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: str = Depends(get_current_user),
) -> UserResponse:
    """Get a specific user."""
    try:
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User {user_id} not found",
            )

        return UserResponse.model_validate(user)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user",
        )


@router.get("/{username}/queue", response_model=JobListResponse)
async def get_user_queue(
    username: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    current_user: str = Depends(get_current_user),
) -> JobListResponse:
    """Get all jobs assigned to a linguist."""
    try:
        from sqlalchemy import desc, func

        # Build query for jobs assigned to this user
        query = select(Job).where(Job.assigned_to == username)

        # Filter for review-pending jobs
        query = query.where(
            (Job.status == JobStatus.AWAITING_TRANSCRIPTION_REVIEW)
            | (Job.status == JobStatus.AWAITING_TRANSLATION_REVIEW)
        )

        # Count total
        count_result = await session.execute(
            select(func.count(Job.id))
            .where(Job.assigned_to == username)
            .where(
                (Job.status == JobStatus.AWAITING_TRANSCRIPTION_REVIEW)
                | (Job.status == JobStatus.AWAITING_TRANSLATION_REVIEW)
            )
        )
        total = count_result.scalar() or 0

        # Apply sorting and pagination
        query = query.order_by(desc(Job.created_at))
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await session.execute(query)
        jobs = result.scalars().all()

        pages = (total + page_size - 1) // page_size

        return JobListResponse(
            items=[JobResponse.model_validate(job) for job in jobs],
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
        )

    except Exception as e:
        logger.error(f"Error getting user queue for {username}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user queue",
        )
