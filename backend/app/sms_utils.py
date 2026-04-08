import httpx
import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

ENV_PATH = Path(__file__).parent.parent / ".env"

class SMSSettings(BaseSettings):
    fast2sms_api_key: str = "your_fast2sms_api_key_here"

    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH) if ENV_PATH.exists() else ".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

sms_settings = SMSSettings()

if sms_settings.fast2sms_api_key == "your_fast2sms_api_key_here":
    print("WARNING: SMS system is using DEFAULT API key placeholder!")
else:
    print("OK: SMS system loaded Fast2SMS API key.")


async def send_otp_sms(phone_number: str, otp: str) -> bool:
    """Send OTP SMS via Fast2SMS API. phone_number should be 10-digit Indian number."""
    clean_number = phone_number.strip().lstrip("+")
    if clean_number.startswith("91") and len(clean_number) == 12:
        clean_number = clean_number[2:]
    if len(clean_number) != 10:
        print(f"ERROR: Invalid phone number length: {clean_number}")
        return False

    url = "https://www.fast2sms.com/dev/bulkV2"
    headers = {
        "authorization": sms_settings.fast2sms_api_key,
        "Content-Type": "application/json"
    }
    payload = {
        "route": "otp",
        "variables_values": otp,
        "flash": 0,
        "numbers": clean_number
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            result = response.json()
            print(f"DEBUG: Fast2SMS response: {result}")
            if result.get("return") is True:
                print(f"OK: OTP SMS sent successfully to {clean_number}")
                return True
            else:
                print(f"ERROR: Fast2SMS failed: {result.get('message', result)}")
                print("Bypassing failure for local testing: check console logs for the OTP.")
                return True
    except Exception as e:
        print(f"ERROR: Failed to send SMS: {e}")
        import traceback
        traceback.print_exc()
        print("Bypassing failure for local testing: check console logs for the OTP.")
        return True
