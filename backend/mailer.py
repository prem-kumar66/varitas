"""
Veritas Academic — Email Notification Service
============================================
Handles sending transactional emails such as Password Reset OTP codes.
Supports standard SMTP (Gmail, Outlook, AWS SES, custom SMTP) when configured in .env.
Falls back safely to Development Preview mode if SMTP credentials are not provided.
"""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any


def send_password_reset_email(
    to_email: str,
    recipient_name: str,
    otp: str,
    user_type: str = "student"
) -> Dict[str, Any]:
    """
    Sends a 6-digit OTP email to the user for password reset.
    Returns status dict indicating whether it was sent via SMTP or development preview.
    """
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASSWORD", "")
    smtp_from = os.getenv("SMTP_FROM", smtp_user or "noreply@anurag.edu.in")

    role_label = "Student" if user_type.lower() == "student" else "Faculty Evaluator"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8f8f8; margin: 0; padding: 20px; }}
        .card {{ max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e5e5e5; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }}
        .header {{ text-align: center; border-bottom: 2px solid #C8102E; padding-bottom: 16px; margin-bottom: 24px; }}
        .brand {{ font-size: 22px; font-weight: 800; color: #171717; letter-spacing: -0.5px; }}
        .accent {{ color: #C8102E; }}
        .greeting {{ font-size: 15px; color: #333333; margin-bottom: 16px; }}
        .otp-box {{ background: #FFF1F2; border: 1.5px dashed #C8102E; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }}
        .otp-code {{ font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #C8102E; }}
        .expiry {{ font-size: 12px; color: #666666; margin-top: 8px; }}
        .notice {{ font-size: 13px; color: #555555; line-height: 1.5; margin-bottom: 20px; }}
        .footer {{ font-size: 11px; color: #888888; text-align: center; border-top: 1px solid #eeeeee; padding-top: 16px; margin-top: 24px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="brand">VERITAS <span class="accent">ACADEMIC</span></div>
          <p style="margin: 4px 0 0; font-size: 12px; color: #666666;">Security Verification Service</p>
        </div>
        <div class="greeting">
          Dear <strong>{recipient_name}</strong> ({role_label}),
        </div>
        <p class="notice">
          We received a request to reset your password for the Anurag University Veritas Academic Portal. Use the verification code below to authorize your password change:
        </p>
        <div class="otp-box">
          <div class="otp-code">{otp}</div>
          <div class="expiry">Valid for <strong>10 minutes</strong>. Do not share this code with anyone.</div>
        </div>
        <p class="notice">
          If you did not request this password reset, you can safely ignore this email. Your current password will remain unchanged and secure.
        </p>
        <div class="footer">
          &copy; Veritas Academic — Anurag University AI Assessment & Authentication Portal.<br>
          Automated message, please do not reply.
        </div>
      </div>
    </body>
    </html>
    """

    plain_text = (
        f"VERITAS ACADEMIC — PASSWORD RESET VERIFICATION\n\n"
        f"Dear {recipient_name} ({role_label}),\n\n"
        f"Your 6-digit verification code is: {otp}\n\n"
        f"This code will expire in 10 minutes.\n"
        f"If you did not request a password reset, please disregard this email.\n\n"
        f"Veritas Academic — Anurag University\n"
    )

    # Check if SMTP is configured
    if smtp_host and smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"Your Veritas Academic Password Reset Code: {otp}"
            msg["From"] = f"Veritas Academic <{smtp_from}>"
            msg["To"] = to_email

            msg.attach(MIMEText(plain_text, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)

            print(f"[MAIL] Password reset email sent via SMTP to {to_email}")
            return {"sent": True, "mode": "smtp", "message": f"Verification code sent to {to_email}"}
        except Exception as e:
            print(f"[MAIL WARN] SMTP delivery failed: {e}. Falling back to dev mode.")
            return {
                "sent": False,
                "mode": "preview",
                "otp": otp,
                "warning": f"SMTP delivery failed ({str(e)}), code available in preview",
                "message": f"Verification code generated for {to_email}"
            }
    else:
        # Development Preview Mode (no SMTP configured)
        print(f"[MAIL DEV SIMULATOR] Password reset OTP for {to_email}: {otp}")
        return {
            "sent": False,
            "mode": "preview",
            "otp": otp,
            "message": f"Verification code generated for {to_email} (Dev Preview)"
        }
