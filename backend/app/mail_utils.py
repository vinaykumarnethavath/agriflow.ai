import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

# Get the path to the .env file in the backend directory
ENV_PATH = Path(__file__).parent.parent / ".env"

class MailSettings(BaseSettings):
    smtp_user: str = "your-email@gmail.com"
    smtp_password: str = "your-app-password"
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 465

    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH) if ENV_PATH.exists() else ".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

mail_settings = MailSettings()

# Debugging: Print loaded settings (masked)
print(f"DEBUG: Mail account: {mail_settings.smtp_user}")
if mail_settings.smtp_password == "your-app-password":
    print("WARNING: Mail system is using DEFAULT password placeholder!")
else:
    print("OK: Mail system loaded custom password.")

def send_registration_otp_email(to_email: str, otp: str, role: str):
    """Sends an account verification OTP email during registration."""
    role_label = role.replace("_", " ").title()
    try:
        message = MIMEMultipart("alternative")
        message["Subject"] = "AgriFlow - Verify Your Email"
        message["From"] = mail_settings.smtp_user
        message["To"] = to_email

        text = f"Your AgriFlow email verification code is: {otp}. This code expires in 10 minutes."
        html = f"""
        <html>
          <body style="font-family: Arial, sans-serif; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
              <h2 style="color: #166534; text-align: center;">Verify Your AgriFlow Account</h2>
              <p>Hello,</p>
              <p>You are creating an <strong>{role_label}</strong> account on AgriFlow. Use the code below to verify your email:</p>
              <div style="background-color: #f0fdf4; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                <span style="font-size: 36px; font-weight: bold; color: #16a34a; letter-spacing: 8px;">{otp}</span>
              </div>
              <p>This code will expire in <strong>10 minutes</strong>. If you did not try to register, please ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 12px; color: #666; text-align: center;">AgriFlow - Connecting Farmers &amp; Markets</p>
            </div>
          </body>
        </html>
        """

        part1 = MIMEText(text, "plain")
        part2 = MIMEText(html, "html")
        message.attach(part1)
        message.attach(part2)

        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(mail_settings.smtp_host, mail_settings.smtp_port, context=context) as server:
            server.login(mail_settings.smtp_user, mail_settings.smtp_password)
            server.sendmail(mail_settings.smtp_user, to_email, message.as_string())

        print(f"OK: Registration OTP email sent to {to_email}")
        return True
    except Exception as e:
        print(f"ERROR: Failed to send registration OTP email: {e}")
        import traceback
        traceback.print_exc()
        return False


def send_otp_email(to_email: str, otp: str):
    """Sends an OTP email using Gmail SMTP."""
    
    try:
        # Create the email message
        message = MIMEMultipart("alternative")
        message["Subject"] = "AgriFlow - Password Reset OTP"
        message["From"] = mail_settings.smtp_user
        message["To"] = to_email

        # Plain-text and HTML versions
        text = f"Your AgriFlow password reset OTP is: {otp}. This code expires in 10 minutes."
        html = f"""
        <html>
          <body style="font-family: Arial, sans-serif; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
              <h2 style="color: #166534; text-align: center;">AgriFlow Password Reset</h2>
              <p>Hello,</p>
              <p>You requested a password reset for your AgriFlow account. Please use the following One-Time Password (OTP) to proceed:</p>
              <div style="background-color: #f0fdf4; padding: 20px; text-align: center; border-radius: 8px;">
                <span style="font-size: 32px; font-weight: bold; color: #16a34a; letter-spacing: 5px;">{otp}</span>
              </div>
              <p style="margin-top: 20px;">This code will expire in <strong>10 minutes</strong>. If you did not request this, please ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 12px; color: #666; text-align: center;">AgriFlow - Connecting Farmers & Markets</p>
            </div>
          </body>
        </html>
        """

        part1 = MIMEText(text, "plain")
        part2 = MIMEText(html, "html")
        message.attach(part1)
        message.attach(part2)

        # Create a secure SSL context and send the email
        context = ssl.create_default_context()
        
        print(f"DEBUG: Connecting to {mail_settings.smtp_host}:{mail_settings.smtp_port}...")
        with smtplib.SMTP_SSL(mail_settings.smtp_host, mail_settings.smtp_port, context=context) as server:
            server.login(mail_settings.smtp_user, mail_settings.smtp_password)
            server.sendmail(mail_settings.smtp_user, to_email, message.as_string())
        
        print(f"OK: OTP Email sent successfully to {to_email}")
        return True
    except Exception as e:
        print(f"ERROR: Failed to send email: {e}")
        import traceback
        traceback.print_exc()
        return False
