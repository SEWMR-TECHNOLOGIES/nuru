import os
import requests
from core import config

class SewmrSmsClient:
    def __init__(self):
        # Load from environment
        self.base_url = config.SEWMR_SMS_BASE_URL
        self.access_token = config.SEWMR_SMS_ACCESS_TOKEN
        self.default_sender_id = config.SEWMR_SMS_DEFAULT_SENDER_ID

        # Headers
        self.headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }

    def send_quick_sms(self, message: str, recipients: list, sender_id: str = None,
                       schedule: bool = False, scheduled_for: str = None, schedule_name: str = None):
        url = f"{self.base_url}sms/quick-send"
        sender_id = sender_id or self.default_sender_id

        payload = {
            "sender_id": sender_id,
            "message": message,
            "recipients": "\n".join(recipients),
            "schedule": schedule
        }

        if schedule and scheduled_for:
            payload["scheduled_for"] = scheduled_for
        if schedule_name:
            payload["schedule_name"] = schedule_name

        return self._send_request("POST", url, payload)

    def send_group_sms(self, message: str, group_uuid: str, sender_id: str = None,
                       schedule: bool = False, scheduled_for: str = None, schedule_name: str = None):
        url = f"{self.base_url}sms/quick-send/group"
        sender_id = sender_id or self.default_sender_id

        payload = {
            "sender_id": sender_id,
            "message": message,
            "group_uuid": group_uuid,
            "schedule": schedule
        }

        if schedule and scheduled_for:
            payload["scheduled_for"] = scheduled_for
        if schedule_name:
            payload["schedule_name"] = schedule_name

        return self._send_request("POST", url, payload)

    def get_sender_ids(self):
        url = f"{self.base_url}sender-ids"
        return self._send_request("GET", url)

    def _send_request(self, method: str, url: str, payload: dict = None):
        try:
            if method.upper() == "POST":
                response = requests.post(url, json=payload, headers=self.headers, timeout=15)
            else:
                response = requests.get(url, headers=self.headers, timeout=15)

            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {"success": False, "error": str(e)}
