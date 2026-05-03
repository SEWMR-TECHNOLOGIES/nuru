"""
Firebase Cloud Messaging (FCM HTTP v1) sender.

Configuration
-------------
Set ONE of these environment variables with the **service-account JSON** for
the Firebase project that owns the mobile app:

* ``FCM_SERVICE_ACCOUNT_JSON`` — the full JSON content as a string.
* ``FCM_SERVICE_ACCOUNT_FILE`` — absolute path to a JSON file on disk.

The project_id is read from the service account JSON automatically.

Usage
-----
    from utils.fcm import send_push_to_user
    send_push_to_user(db, user_id, title="New message", body="...",
                     data={"type": "message", "conversation_id": "..."})

All failures are swallowed and logged — pushes are best-effort and must never
block the request that triggered them.
"""
from __future__ import annotations

import json
import os
import threading
import time
from typing import Iterable

import requests

_FCM_SCOPES = ["https://www.googleapis.com/auth/firebase.messaging"]
_FCM_ENDPOINT = "https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"

_lock = threading.Lock()
_cached_credentials = None
_cached_project_id: str | None = None


def _load_service_account() -> tuple[object | None, str | None]:
    """Lazy-load and cache google-auth credentials + project_id."""
    global _cached_credentials, _cached_project_id
    with _lock:
        if _cached_credentials and _cached_project_id:
            return _cached_credentials, _cached_project_id

        info = None
        raw = os.getenv("FCM_SERVICE_ACCOUNT_JSON")
        if raw:
            try:
                info = json.loads(raw)
            except Exception as e:  # noqa: BLE001
                print(f"[fcm] FCM_SERVICE_ACCOUNT_JSON is not valid JSON: {e}")
                return None, None
        else:
            path = os.getenv("FCM_SERVICE_ACCOUNT_FILE")
            if path and os.path.exists(path):
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        info = json.load(f)
                except Exception as e:  # noqa: BLE001
                    print(f"[fcm] failed to read {path}: {e}")
                    return None, None

        if not info:
            return None, None

        try:
            from google.oauth2 import service_account  # type: ignore

            creds = service_account.Credentials.from_service_account_info(
                info, scopes=_FCM_SCOPES,
            )
        except Exception as e:  # noqa: BLE001
            print(f"[fcm] could not build credentials (is google-auth installed?): {e}")
            return None, None

        _cached_credentials = creds
        _cached_project_id = info.get("project_id")
        return _cached_credentials, _cached_project_id


def _access_token() -> str | None:
    creds, _ = _load_service_account()
    if not creds:
        return None
    try:
        from google.auth.transport.requests import Request as GAuthRequest  # type: ignore

        if not creds.valid:
            creds.refresh(GAuthRequest())
        return creds.token
    except Exception as e:  # noqa: BLE001
        print(f"[fcm] token refresh failed: {e}")
        return None


def _redact(t: str) -> str:
    if not t:
        return "(empty)"
    if len(t) <= 12:
        return "***"
    return f"{t[:6]}…{t[-4:]} (len={len(t)})"


def _send_one(token: str, title: str, body: str, data: dict, *,
              high_priority: bool = False, collapse_key: str | None = None,
              image: str | None = None) -> dict:
    """Returns {'ok': bool, 'status': int|None, 'error': str|None, 'unregistered': bool}."""
    creds, project_id = _load_service_account()
    if not creds or not project_id:
        return {"ok": False, "status": None, "error": "fcm_not_configured", "unregistered": False}
    access = _access_token()
    if not access:
        return {"ok": False, "status": None, "error": "no_access_token", "unregistered": False}

    string_data = {k: str(v) for k, v in (data or {}).items() if v is not None}

    notification: dict = {"title": title or "Nuru", "body": body or ""}
    if image:
        notification["image"] = image

    android_notif: dict = {"sound": "default", "channel_id": "nuru_default"}
    if image:
        # Used by the mobile client to render a circular largeIcon (sender
        # avatar) in WhatsApp-style — separate from the big `image` preview.
        android_notif["image"] = image

    apns_payload: dict = {"aps": {"sound": "default", "mutable-content": 1, "content-available": 1}}

    message: dict = {
        "token": token,
        "notification": notification,
        "data": string_data,
        "android": {
            "priority": "HIGH" if high_priority else "NORMAL",
            "notification": android_notif,
        },
        "apns": {
            "headers": {"apns-priority": "10" if high_priority else "5"},
            "payload": apns_payload,
        },
    }
    if image:
        # iOS rich notification needs a Notification Service Extension to
        # download `fcm_options.image`; harmless if the app doesn't have one.
        message["apns"]["fcm_options"] = {"image": image}
    if collapse_key:
        message["android"]["collapse_key"] = collapse_key
        message["apns"]["headers"]["apns-collapse-id"] = collapse_key

    url = _FCM_ENDPOINT.format(project_id=project_id)
    try:
        resp = requests.post(
            url,
            headers={"Authorization": f"Bearer {access}",
                     "Content-Type": "application/json; charset=UTF-8"},
            data=json.dumps({"message": message}),
            timeout=10,
        )
    except Exception as e:  # noqa: BLE001
        print(f"[fcm] HTTP error sending to {_redact(token)}: {e}")
        return {"ok": False, "status": None, "error": str(e)[:120], "unregistered": False}

    if resp.status_code == 200:
        print(f"[fcm] sent ok → {_redact(token)}")
        return {"ok": True, "status": 200, "error": None, "unregistered": False}

    body_text = resp.text[:300]
    unregistered = resp.status_code in (404, 400) and (
        "UNREGISTERED" in body_text or "NOT_FOUND" in body_text
    )
    print(f"[fcm] send failed → {_redact(token)} status={resp.status_code} body={body_text}")
    return {"ok": False, "status": resp.status_code,
            "error": body_text, "unregistered": unregistered}


def send_push_to_tokens(tokens: Iterable[str], *, title: str, body: str,
                        data: dict | None = None, high_priority: bool = False,
                        collapse_key: str | None = None,
                        image: str | None = None) -> dict:
    """Fire push to a list of raw FCM tokens. Returns counts + per-token results."""
    results = []
    sent = 0
    failed = 0
    for t in tokens:
        if not t:
            continue
        r = _send_one(t, title, body, data or {},
                      high_priority=high_priority, collapse_key=collapse_key,
                      image=image)
        results.append({"token": _redact(t), **r})
        if r["ok"]:
            sent += 1
        else:
            failed += 1
    return {"sent": sent, "failed": failed, "results": results}


def send_push_to_user(db, user_id, *, title: str, body: str,
                      data: dict | None = None, high_priority: bool = False,
                      collapse_key: str | None = None,
                      image: str | None = None) -> dict:
    """Fan-out push to every device registered to this user (kind='fcm').

    Auto-prunes tokens FCM rejects as UNREGISTERED. Best-effort, never raises.
    """
    try:
        from models import DeviceToken  # local import to avoid model cycles
    except Exception as e:  # noqa: BLE001
        print(f"[fcm] cannot import DeviceToken: {e}")
        return {"sent": 0, "failed": 0, "devices": 0, "results": []}

    try:
        rows = db.query(DeviceToken).filter(
            DeviceToken.user_id == user_id,
            DeviceToken.kind == "fcm",
        ).all()
    except Exception as e:  # noqa: BLE001
        print(f"[fcm] db error reading device_tokens: {e}")
        return {"sent": 0, "failed": 0, "devices": 0, "results": []}

    if not rows:
        print(f"[fcm] no device_tokens for user {user_id}")
        return {"sent": 0, "failed": 0, "devices": 0, "results": []}

    out = send_push_to_tokens(
        [r.token for r in rows],
        title=title, body=body, data=data,
        high_priority=high_priority, collapse_key=collapse_key,
        image=image,
    )
    out["devices"] = len(rows)

    # Prune stale tokens
    try:
        stale = {res["token"] for res in out["results"] if res.get("unregistered")}
        if stale:
            for r in rows:
                if _redact(r.token) in stale:
                    db.delete(r)
            db.commit()
            print(f"[fcm] pruned {len(stale)} unregistered tokens for user {user_id}")
    except Exception as e:  # noqa: BLE001
        print(f"[fcm] prune failed: {e}")
        try: db.rollback()
        except Exception: pass

    return out


def send_push_async(db, user_id, *, title: str, body: str,
                    data: dict | None = None, high_priority: bool = False,
                    collapse_key: str | None = None,
                    image: str | None = None):
    """Schedule a push without blocking the caller.

    We don't have a Celery task wired here yet, so spawn a daemon thread.
    The DB session is *not* shared with the thread — we open a fresh one.
    """
    payload_data = dict(data or {})

    def _worker():
        try:
            from core.database import SessionLocal  # type: ignore
            session = SessionLocal()
            try:
                send_push_to_user(
                    session, user_id,
                    title=title, body=body, data=payload_data,
                    high_priority=high_priority, collapse_key=collapse_key,
                    image=image,
                )
            finally:
                session.close()
        except Exception as e:  # noqa: BLE001
            print(f"[fcm] async push worker error: {e}")

    try:
        threading.Thread(target=_worker, name="fcm-push", daemon=True).start()
    except Exception as e:  # noqa: BLE001
        print(f"[fcm] could not spawn push thread: {e}")


# Cheap sanity check for /health-style probing.
def fcm_configured() -> bool:
    creds, project_id = _load_service_account()
    return bool(creds and project_id)
