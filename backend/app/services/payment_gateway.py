"""SasaPay payment gateway — multi-provider.

Responsibilities:
  * Authenticate against SasaPay
  * Identify mobile-money network from a phone number
  * Push STK (request_payment) and check transaction status
  * Stay stateless — caller persists Transaction + MobilePaymentAttempt rows.

Reference (SasaPay Developer Portal):
  • POST /payments/request-payment/        — C2B STK push (Request Payment)
  • POST /transactions/status-query/       — Transaction Status Query
  • POST {merchant CallBackURL}            — C2B Callback Results (per request)
  • POST {merchant IPN URL}                — Instant Payment Notification

The inbound callback + IPN endpoints are handled by `api/routes/payments.py`.
"""

import base64
import os
from typing import Dict, Any, Optional

import httpx
from fastapi import HTTPException


class PaymentGateway:
    """Lightweight SasaPay client. Endpoints/credentials read from env so we
    can swap sandbox / live without code changes."""

    AUTH_URL = os.getenv(
        "SASAPAY_AUTH_URL",
        "https://api.sasapay.co.tz/api/v1/auth/token/?grant_type=client_credentials",
    )
    PAYMENT_REQUEST_URL = os.getenv(
        "SASAPAY_PAYMENT_REQUEST_URL",
        "https://api.sasapay.co.tz/api/v1/payments/request-payment/",
    )
    # NOTE: SasaPay's `/transactions/status-query/` endpoint does not reliably
    # return synchronous results for our merchant — it only acks and promises a
    # callback. The legacy `/transactions/status/` endpoint DOES return the
    # authoritative result inline (ResultCode / Paid under a `data` envelope),
    # which is what we rely on for polling. Keep this as the default.
    TRANSACTION_STATUS_URL = os.getenv(
        "SASAPAY_TRANSACTION_STATUS_URL",
        "https://api.sasapay.co.tz/api/v1/transactions/status/",
    )

    # Tanzania prefixes → internal provider key
    NETWORK_PREFIXES_TZ = {
        "76": "VODACOM", "75": "VODACOM", "74": "VODACOM",
        "65": "TIGO", "71": "TIGO", "77": "TIGO", "67": "TIGO",
        "69": "AIRTEL", "68": "AIRTEL", "78": "AIRTEL",
        "61": "HALOPESA", "62": "HALOPESA",
    }

    # Kenya prefixes (Safaricom M-Pesa primary)
    NETWORK_PREFIXES_KE = {
        "70": "MPESA", "71": "MPESA", "72": "MPESA",
        "74": "MPESA", "79": "MPESA", "11": "MPESA",
    }

    # Internal key → SasaPay NetworkCode
    NETWORK_CODES = {
        "VODACOM": "VODACOM",
        "TIGO": "TIGO",
        "AIRTEL": "AIRTELMONEYTZ",
        "HALOPESA": "HALOPESA",
        "MPESA": "MPESA",
    }

    def __init__(self):
        self.client_id = os.getenv("SASAPAY_CLIENT_ID", "")
        self.client_secret = os.getenv("SASAPAY_CLIENT_SECRET", "")
        self.merchant_code = os.getenv("SASAPAY_MERCHANT_CODE", "")
        self._explicit_callback_url = os.getenv("SASAPAY_CALLBACK_URL", "")

    # ──────────────────────────────────────────────
    # Callback URL resolution
    # ──────────────────────────────────────────────
    @property
    def callback_url(self) -> str:
        """Resolve the callback URL SasaPay should POST results to.

        Order: explicit ``SASAPAY_CALLBACK_URL`` env →
        ``{API_BASE_URL}/api/v1/payments/callback``. Empty in dev when
        neither is set; in production one of the two MUST be configured
        or SasaPay will silently fail to deliver the result.
        """
        if self._explicit_callback_url:
            return self._explicit_callback_url
        try:
            from core.config import API_BASE_URL
        except Exception:
            API_BASE_URL = ""
        if API_BASE_URL:
            return f"{API_BASE_URL}/api/v1/payments/callback"
        return ""

    @property
    def ipn_url(self) -> str:
        """IPN URL — separate from C2B callback per SasaPay docs."""
        explicit = os.getenv("SASAPAY_IPN_URL", "")
        if explicit:
            return explicit
        try:
            from core.config import API_BASE_URL
        except Exception:
            API_BASE_URL = ""
        if API_BASE_URL:
            return f"{API_BASE_URL}/api/v1/payments/ipn"
        return ""

    # ──────────────────────────────────────────────
    # Auth
    # ──────────────────────────────────────────────
    async def _get_auth_token(self) -> str:
        if not self.client_id or not self.client_secret:
            raise HTTPException(status_code=500, detail="Payment gateway not configured.")
        auth_header = base64.b64encode(
            f"{self.client_id}:{self.client_secret}".encode()
        ).decode()
        headers = {"Authorization": f"Basic {auth_header}"}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(self.AUTH_URL, headers=headers)
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail="Payment gateway authentication failed.")
            token = resp.json().get("access_token")
            if not token:
                raise HTTPException(status_code=502, detail="No access token from payment gateway.")
            return token

    # ──────────────────────────────────────────────
    # Phone normalization + network detection
    # ──────────────────────────────────────────────
    @classmethod
    def normalize_phone_number(cls, phone_number: str, country_code: str = "TZ") -> str:
        """Normalize user-entered numbers into gateway-ready international digits."""
        if not phone_number:
            return ""

        digits = "".join(ch for ch in str(phone_number) if ch.isdigit())
        cc = (country_code or "TZ").upper()

        if cc == "TZ":
            if digits.startswith("255"):
                return digits
            if digits.startswith("0") and len(digits) >= 10:
                return f"255{digits[1:]}"
            if len(digits) == 9:
                return f"255{digits}"
            return digits

        if cc == "KE":
            if digits.startswith("254"):
                return digits
            if digits.startswith("0") and len(digits) >= 10:
                return f"254{digits[1:]}"
            if len(digits) == 9:
                return f"254{digits}"
            return digits

        return digits

    @classmethod
    def identify_network(cls, phone_number: str, country_code: str = "TZ") -> str:
        """Return internal network key (e.g. 'VODACOM') or 'UNKNOWN'."""
        if not phone_number:
            return "UNKNOWN"
        ph = cls.normalize_phone_number(phone_number, country_code)
        cc = (country_code or "TZ").upper()
        if cc == "TZ" and ph.startswith("255"):
            ph = ph[3:]
            return cls.NETWORK_PREFIXES_TZ.get(ph[:2], "UNKNOWN")
        if cc == "KE" and ph.startswith("254"):
            ph = ph[3:]
            return cls.NETWORK_PREFIXES_KE.get(ph[:2], "UNKNOWN")
        return cls.NETWORK_PREFIXES_TZ.get(ph[:2], "UNKNOWN")

    @classmethod
    def gateway_code_for(cls, network_key: str) -> str:
        return cls.NETWORK_CODES.get(network_key, "UNKNOWN")

    # ──────────────────────────────────────────────
    # STK push (C2B Request Payment)
    # ──────────────────────────────────────────────
    async def request_payment(
        self,
        phone_number: str,
        amount: float,
        description: str,
        merchant_request_id: str,
        country_code: str = "TZ",
        currency: str = "TZS",
        network_override: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Initiate an STK push.

        Mirrors SasaPay ``POST /payments/request-payment/`` exactly — see
        the developer portal "Request Payment" section. Caller should
        persist the response onto MobilePaymentAttempt and
        ``Transaction.api_response_payload_snapshot``.
        """
        phone_number = self.normalize_phone_number(phone_number, country_code)
        gateway_code = network_override or self.gateway_code_for(
            self.identify_network(phone_number, country_code)
        )
        if gateway_code == "UNKNOWN":
            raise HTTPException(status_code=400, detail="Unsupported phone number network.")

        token = await self._get_auth_token()
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        payload = {
            "MerchantCode": self.merchant_code,
            "NetworkCode": gateway_code,
            "PhoneNumber": phone_number,
            "TransactionDesc": description,
            "AccountReference": merchant_request_id,
            "Amount": str(amount),  # SasaPay docs show this as a string
            "Currency": currency,
            "CallBackURL": self.callback_url,
            # SasaPay docs literally include the space — kept verbatim.
            "Transaction Fee": "0",
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(self.PAYMENT_REQUEST_URL, json=payload, headers=headers)
            try:
                data = resp.json()
            except Exception:
                raise HTTPException(status_code=502, detail="Invalid response from payment gateway.")
            if not data.get("status"):
                raise HTTPException(
                    status_code=400,
                    detail=data.get("detail") or data.get("message") or "Payment request failed.",
                )
            data["_request_payload"] = payload
            return data

    # ──────────────────────────────────────────────
    # Transaction status query
    # ──────────────────────────────────────────────
    async def check_transaction_status(self, checkout_request_id: str) -> str:
        """Returns 'PAID' | 'PENDING' | 'FAILED' (back-compat shim)."""
        status, _ = await self.check_transaction_status_detail(checkout_request_id)
        return status

    async def check_transaction_status_detail(
        self, checkout_request_id: str
    ) -> tuple[str, str | None]:
        """Query SasaPay for the authoritative status of a checkout request.

        Per SasaPay docs ``POST /transactions/status-query/`` may return EITHER:
          • An async ack: ``{"status": true, "message": "...callback..."}`` —
            the real result will arrive on the configured CallbackUrl.
          • A synchronous result: ``ResultCode``, ``Paid``, ``PaidAmount``,
            ``TransactionCode``, ``ResultDescription`` …

        We accept either shape — including a nested ``data`` envelope used
        by some sandbox responses — and return ``(status, reason)`` where
        ``status`` is one of PAID / PENDING / FAILED and ``reason`` is the
        human-readable description suitable for ``Transaction.failure_reason``.
        """
        token = await self._get_auth_token()
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        payload = {
            "MerchantCode": self.merchant_code,
            "CheckoutRequestId": checkout_request_id,
            # CallbackUrl is technically optional but accepted; if SasaPay
            # decides to push the answer asynchronously it'll use this URL.
            "CallbackUrl": self.callback_url,
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(self.TRANSACTION_STATUS_URL, json=payload, headers=headers)
            if resp.status_code != 200:
                return "PENDING", None
            try:
                data = resp.json()
            except Exception:
                return "PENDING", None

        # Normalize: some sandbox responses wrap fields in `data`, others are flat.
        flat: Dict[str, Any] = {}
        if isinstance(data.get("data"), dict):
            flat.update(data["data"])
        flat.update({k: v for k, v in data.items() if k != "data"})

        result_code = str(flat.get("ResultCode", "")).strip()
        paid_raw = flat.get("Paid")
        paid = paid_raw is True or str(paid_raw).strip().lower() == "true"
        reason = (
            flat.get("ResultDescription")
            or flat.get("ResultDesc")
            or flat.get("ResponseDescription")
            or flat.get("detail")
            or flat.get("message")
        )

        # Async ack shape: gateway accepted query but answer comes via callback.
        # IMPORTANT: do NOT propagate the ack `message` ("Your request has been
        # received. Check your callback url for response") as a `reason` — it
        # would later be persisted as `failure_reason` and shown to users as
        # the failure cause, which is misleading. Real status arrives via the
        # /payments/callback webhook.
        if not result_code and paid_raw is None and data.get("status") is True:
            return "PENDING", None

        if result_code == "0" and paid:
            return "PAID", reason
        if result_code == "0" and not paid:
            # Some MNOs return ResultCode 0 mid-flight — be conservative.
            return "PENDING", reason
        if result_code and result_code != "0":
            return "FAILED", reason or "Gateway reported failure."
        return "PENDING", reason


# Singleton — cheap to instantiate but avoids re-reading env per request
gateway = PaymentGateway()
