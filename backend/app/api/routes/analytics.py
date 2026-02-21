"""
Analytics routes — page view tracking and admin analytics dashboard.
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func, distinct, cast, Date
from datetime import datetime, timedelta
from core.database import get_db
from utils.auth import get_current_user
from models import PageView, User

router = APIRouter(tags=["Analytics"])


@router.post("/analytics/page-views")
def track_page_view(request: Request, body: dict, db: Session = Depends(get_db)):
    """Record a page view — no auth required."""
    pv = PageView(
        path=body.get("path", "/"),
        referrer=body.get("referrer"),
        user_agent=body.get("user_agent"),
        device_type=body.get("device_type"),
        browser=body.get("browser"),
        session_id=body.get("session_id"),
        visitor_id=body.get("visitor_id"),
    )
    db.add(pv)
    db.commit()
    return {"success": True, "message": "Page view recorded"}


@router.get("/admin/analytics")
def get_analytics(
    range: str = "7d",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin-only analytics dashboard data."""
    # Compute start date
    now = datetime.utcnow()
    start_date = None
    if range == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif range == "7d":
        start_date = now - timedelta(days=7)
    elif range == "30d":
        start_date = now - timedelta(days=30)
    # 'all' → no filter

    base = db.query(PageView)
    if start_date:
        base = base.filter(PageView.created_at >= start_date)

    views = base.order_by(PageView.created_at.desc()).limit(5000).all()

    total_views = len(views)
    unique_visitors = len(set(v.visitor_id for v in views if v.visitor_id))
    unique_sessions = len(set(v.session_id for v in views if v.session_id))

    # Top pages
    page_counts: dict[str, int] = {}
    for v in views:
        page_counts[v.path] = page_counts.get(v.path, 0) + 1
    top_pages = sorted(
        [{"path": p, "views": c} for p, c in page_counts.items()],
        key=lambda x: x["views"],
        reverse=True,
    )[:10]

    # Device breakdown
    device_counts: dict[str, int] = {}
    for v in views:
        d = v.device_type or "unknown"
        device_counts[d] = device_counts.get(d, 0) + 1
    device_breakdown = [{"device_type": k, "count": v} for k, v in device_counts.items()]

    # Browser breakdown
    browser_counts: dict[str, int] = {}
    for v in views:
        b = v.browser or "unknown"
        browser_counts[b] = browser_counts.get(b, 0) + 1
    browser_breakdown = sorted(
        [{"browser": k, "count": v} for k, v in browser_counts.items()],
        key=lambda x: x["count"],
        reverse=True,
    )

    # Daily views
    daily_counts: dict[str, int] = {}
    for v in views:
        day = v.created_at.strftime("%Y-%m-%d") if v.created_at else "unknown"
        daily_counts[day] = daily_counts.get(day, 0) + 1
    daily_views = sorted(
        [{"date": d, "views": c} for d, c in daily_counts.items()],
        key=lambda x: x["date"],
    )

    # Recent views
    recent_views = [
        {
            "path": v.path,
            "device_type": v.device_type,
            "browser": v.browser,
            "created_at": v.created_at.isoformat() if v.created_at else None,
        }
        for v in views[:20]
    ]

    return {
        "success": True,
        "data": {
            "totalViews": total_views,
            "uniqueVisitors": unique_visitors,
            "totalSessions": unique_sessions,
            "topPages": top_pages,
            "deviceBreakdown": device_breakdown,
            "browserBreakdown": browser_breakdown,
            "dailyViews": daily_views,
            "recentViews": recent_views,
        },
    }
