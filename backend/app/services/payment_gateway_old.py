"""SasaPay payment gateway service for Alfa platform.
Adapted from sewmrsms payment_service.py for subscription payments."""

import base64
import os
from typing import Dict, Any
from fastapi import HTTPException
import httpx


class PaymentGateway:
    AUTH_URL = "https://api.sasapay.co.tz/api/v1/auth/token/?grant_type=client_credentials"
    PAYMENT_REQUEST_URL = "https://api.sasapay.co.tz/api/v1/payments/request-payment/"
    TRANSACTION_STATUS_URL = "https://api.sasapay.co.tz/api/v1/transactions/status/"

    NETWORK_PREFIXES = {
        "76": "VODACOM", "75": "VODACOM", "74": "VODACOM",
        "65": "TIGO", "71": "TIGO", "77": "TIGO", "67": "TIGO",
        "69": "AIRTEL", "68": "AIRTEL", "78": "AIRTEL",
        "61": "HALOPESA", "62": "HALOPESA",
    }

    NETWORK_CODES = {
        "VODACOM": "VODACOM",
        "TIGO": "TIGO",
        "AIRTEL": "AIRTELMONEYTZ",
        "HALOPESA": "HALOPESA",
    }

    def __init__(self):
        self.client_id = os.getenv("SASAPAY_CLIENT_ID", "")
        self.client_secret = os.getenv("SASAPAY_CLIENT_SECRET", "")
        self.merchant_code = os.getenv("SASAPAY_MERCHANT_CODE", "")
        self.callback_url = os.getenv("SASAPAY_CALLBACK_URL", "")

    async def _get_auth_token(self) -> str:
        auth_header = base64.b64encode(
            f"{self.client_id}:{self.client_secret}".encode()
        ).decode()
        headers = {"Authorization": f"Basic {auth_header}"}

        async with httpx.AsyncClient() as client:
            resp = await client.get(self.AUTH_URL, headers=headers)
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Payment gateway authentication failed.")
            token = resp.json().get("access_token")
            if not token:
                raise HTTPException(status_code=401, detail="No access token from payment gateway.")
            return token

    async def request_payment(
        self, phone_number: str, amount: float, description: str, merchant_request_id: str
    ) -> Dict[str, Any]:
        network_code = self._identify_network(phone_number)
        if network_code == "UNKNOWN":
            raise HTTPException(status_code=400, detail="Unsupported phone number network.")

        token = await self._get_auth_token()
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        payload = {
            "MerchantCode": self.merchant_code,
            "NetworkCode": network_code,
            "PhoneNumber": phone_number,
            "TransactionDesc": description,
            "AccountReference": merchant_request_id,
            "Amount": amount,
            "Currency": "TZS",
            "CallBackURL": self.callback_url,
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(self.PAYMENT_REQUEST_URL, json=payload, headers=headers)
            data = resp.json()
            if not data.get("status"):
                raise HTTPException(
                    status_code=400,
                    detail=data.get("detail", "Payment request failed."),
                )
            return data

    async def check_transaction_status(self, checkout_request_id: str) -> str:
        token = await self._get_auth_token()
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        payload = {
            "MerchantCode": self.merchant_code,
            "CallbackUrl": self.callback_url,
            "CheckoutRequestId": checkout_request_id,
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(self.TRANSACTION_STATUS_URL, json=payload, headers=headers)
            if resp.status_code != 200:
                return "PENDING"
            data = resp.json()
            if not data.get("status"):
                return "PENDING"
            if data["data"].get("ResultCode") == "0" and data["data"].get("Paid", False):
                return "PAID"
            return "PENDING"

    @classmethod
    def _identify_network(cls, phone_number: str) -> str:
        phone = phone_number[3:] if phone_number.startswith("255") else phone_number
        provider = cls.NETWORK_PREFIXES.get(phone[:2], "UNKNOWN")
        return cls.NETWORK_CODES.get(provider, "UNKNOWN")
