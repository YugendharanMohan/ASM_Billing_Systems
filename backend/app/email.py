"""
Email Service for ASM Billing System
Sends invitation emails to team members via SMTP (Gmail).
"""
import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)


def _build_invite_html(
    org_name: str,
    role: str,
    password_reset_link: str,
    app_url: str,
) -> str:
    """Builds a professional HTML invitation email."""
    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#16a34a,#15803d);padding:32px 32px 24px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                🏭 ASM Billing
              </h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">
                Management System
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 8px;color:#18181b;font-size:18px;font-weight:600;">
                You've been invited! 🎉
              </h2>
              <p style="margin:0 0 24px;color:#71717a;font-size:14px;line-height:1.6;">
                You've been added to <strong style="color:#18181b;">{org_name}</strong> as
                <span style="display:inline-block;background:#f0fdf4;color:#16a34a;padding:2px 10px;border-radius:20px;font-size:13px;font-weight:600;">{role}</span>
              </p>

              <!-- What to do -->
              <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;padding:20px;margin-bottom:24px;">
                <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#18181b;">Getting started:</p>
                <ol style="margin:8px 0 0;padding-left:18px;color:#52525b;font-size:13px;line-height:1.8;">
                  <li>Click the button below to <strong>set your password</strong></li>
                  <li>Once set, login at <a href="{app_url}" style="color:#16a34a;text-decoration:none;">{app_url}</a></li>
                </ol>
              </div>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="{password_reset_link}"
                       style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.2px;">
                      Set Your Password →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;color:#a1a1aa;font-size:11px;text-align:center;line-height:1.5;">
                If you didn't expect this email, you can safely ignore it.<br>
                This link expires in 1 hour.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#fafafa;padding:16px 32px;border-top:1px solid #e4e4e7;text-align:center;">
              <p style="margin:0;color:#a1a1aa;font-size:11px;">
                ASM Billing &mdash; Loom Management System
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def send_invite_email(
    to_email: str,
    org_name: str,
    role: str,
    password_reset_link: str,
) -> bool:
    """
    Sends an invitation email to a new team member.

    Args:
        to_email: Recipient's email address
        org_name: Name of the organization inviting them
        role: Role assigned (Owner, Manager, Operator)
        password_reset_link: Firebase password reset URL

    Returns:
        True if email sent successfully, False otherwise
    """
    # Read env vars at runtime so they pick up load_dotenv() from main.py
    SMTP_EMAIL = os.environ.get("SMTP_EMAIL", "")
    SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
    SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
    APP_URL = os.environ.get("APP_URL", "http://localhost:8080")

    if not SMTP_EMAIL or not SMTP_PASSWORD:
        logger.warning(
            "SMTP credentials not configured (SMTP_EMAIL / SMTP_PASSWORD). "
            "Skipping invitation email to %s", to_email
        )
        return False

    # Build the email
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"You're invited to {org_name} — ASM Billing"
    msg["From"] = f"ASM Billing <{SMTP_EMAIL}>"
    msg["To"] = to_email

    html_body = _build_invite_html(
        org_name=org_name,
        role=role,
        password_reset_link=password_reset_link,
        app_url=APP_URL,
    )
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, msg.as_string())

        logger.info("✅ Invitation email sent to %s", to_email)
        return True

    except Exception as e:
        logger.error("❌ Failed to send invitation email to %s: %s", to_email, e)
        return False
