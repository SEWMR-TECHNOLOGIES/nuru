# Moments Routes - /moments/...
# Handles stories/moments: CRUD, viewing, highlights

from fastapi import APIRouter

from models import (
    UserMoment,
    UserMomentSticker,
    UserMomentViewer,
    UserMomentHighlight,
    UserMomentHighlightItem,
    User,
)

router = APIRouter(prefix="/moments", tags=["Moments/Stories"])


# ──────────────────────────────────────────────
# Get Moments Feed
# ──────────────────────────────────────────────
@router.get("/")
async def get_moments_feed():
    """Returns moments feed (stories from followed users)."""
    pass


# ──────────────────────────────────────────────
# Get My Moments
# ──────────────────────────────────────────────
@router.get("/me")
async def get_my_moments():
    """Returns the authenticated user's active moments."""
    pass


# ──────────────────────────────────────────────
# Get User Moments
# ──────────────────────────────────────────────
@router.get("/user/{user_id}")
async def get_user_moments(user_id: str):
    """Returns moments for a specific user."""
    pass


# ──────────────────────────────────────────────
# Create Moment
# ──────────────────────────────────────────────
@router.post("/")
async def create_moment():
    """Creates a new moment."""
    pass


# ──────────────────────────────────────────────
# Delete Moment
# ──────────────────────────────────────────────
@router.delete("/{moment_id}")
async def delete_moment(moment_id: str):
    """Deletes a moment."""
    pass


# ──────────────────────────────────────────────
# Mark as Seen
# ──────────────────────────────────────────────
@router.post("/{moment_id}/seen")
async def mark_moment_seen(moment_id: str):
    """Marks a moment as seen."""
    pass


# ──────────────────────────────────────────────
# Get Moment Viewers
# ──────────────────────────────────────────────
@router.get("/{moment_id}/viewers")
async def get_moment_viewers(moment_id: str):
    """Returns list of users who viewed a moment."""
    pass


# ──────────────────────────────────────────────
# React to Moment
# ──────────────────────────────────────────────
@router.post("/{moment_id}/react")
async def react_to_moment(moment_id: str):
    """Reacts to a moment."""
    pass


# ──────────────────────────────────────────────
# Reply to Moment
# ──────────────────────────────────────────────
@router.post("/{moment_id}/reply")
async def reply_to_moment(moment_id: str):
    """Sends a reply to a moment."""
    pass


# ──────────────────────────────────────────────
# Vote on Poll Sticker
# ──────────────────────────────────────────────
@router.post("/{moment_id}/stickers/{sticker_id}/vote")
async def vote_on_poll(moment_id: str, sticker_id: str):
    """Votes on a poll sticker."""
    pass


# ──────────────────────────────────────────────
# HIGHLIGHTS
# ──────────────────────────────────────────────
@router.get("/highlights")
async def get_my_highlights():
    """Returns user's moment highlights."""
    pass


@router.get("/highlights/user/{user_id}")
async def get_user_highlights(user_id: str):
    """Returns highlights for a specific user."""
    pass


@router.post("/highlights")
async def create_highlight():
    """Creates a new highlight."""
    pass


@router.put("/highlights/{highlight_id}")
async def update_highlight(highlight_id: str):
    """Updates a highlight."""
    pass


@router.delete("/highlights/{highlight_id}")
async def delete_highlight(highlight_id: str):
    """Deletes a highlight."""
    pass


@router.post("/highlights/{highlight_id}/moments")
async def add_moment_to_highlight(highlight_id: str):
    """Adds a moment to a highlight."""
    pass


@router.delete("/highlights/{highlight_id}/moments/{moment_id}")
async def remove_moment_from_highlight(highlight_id: str, moment_id: str):
    """Removes a moment from a highlight."""
    pass
