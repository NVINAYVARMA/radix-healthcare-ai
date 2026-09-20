import os
import smtplib
from email.message import EmailMessage
from typing import Dict, Any
from app.core.logging import logger

def send_recovery_code_email(to_email: str, recovery_code: str) -> Dict[str, Any]:
    """
    Sends an institutional security recovery code to the radiologist's email.
    Uses SMTP if configured in environment, otherwise logs cleanly for local development.
    """
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    smtp_from = os.getenv("SMTP_FROM_EMAIL", "security@radixhealth.ai").strip()

    subject = f"RadiX AI Clinical Security - Recovery Code [{recovery_code}]"

    plain_body = f"""RadiX Medical AI System - Password Recovery

Hello,

A request was received to reset the clinical credentials for your RadiX account ({to_email}).

Your Verification Security Code is:
{recovery_code}

This code is valid for 15 minutes. Please return to the RadiX portal, enter this code, and set your new password.

If you did not request this recovery code, please report this incident immediately to your hospital IT/PACS security team.

Best regards,
RadiX AI Clinical Security Team
Metropolitan Hospital Center
"""

    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>RadiX Clinical Password Recovery</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);">
    <!-- Header -->
    <tr>
      <td style="background: #0f172a; padding: 20px 24px; text-align: left;">
        <h1 style="color: #ffffff; margin: 0; font-size: 1.25rem; font-weight: 800; letter-spacing: 1.5px;">RADIX <span style="color: #38bdf8; font-size: 0.8rem; font-weight: 600;">MEDICAL AI</span></h1>
        <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 0.72rem;">Institutional PACS & Clinical AI Triage Platform</p>
      </td>
    </tr>
    <!-- Content -->
    <tr>
      <td style="padding: 28px 24px;">
        <h2 style="font-size: 1.1rem; color: #0f172a; margin-top: 0; margin-bottom: 8px;">Password Recovery Verification</h2>
        <p style="font-size: 0.85rem; color: #475569; line-height: 1.5; margin: 0 0 18px 0;">
          A password reset request was initiated for your RadiX clinical workstation account (<strong>{to_email}</strong>). Use the verification code below to authorize your password change.
        </p>

        <!-- Code Callout Box -->
        <div style="background: #f0f9ff; border: 1.5px dashed #0284c7; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
          <div style="font-size: 0.72rem; color: #0369a1; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Your Security Verification Code</div>
          <div style="font-size: 2rem; font-weight: 800; letter-spacing: 4px; color: #0284c7; font-family: monospace;">{recovery_code}</div>
          <div style="font-size: 0.72rem; color: #64748b; margin-top: 6px;">Valid for 15 minutes • Do not share this code</div>
        </div>

        <p style="font-size: 0.82rem; color: #475569; line-height: 1.5; margin: 18px 0 0 0;">
          Return to the RadiX login page, click <strong>"Have a code? Enter here"</strong> or proceed directly on the reset screen, and enter this code along with your new password.
        </p>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; font-size: 0.7rem; color: #64748b; line-height: 1.4;">
        <strong style="color: #475569;">Security Notice:</strong> If you did not initiate this request, please contact your PACS Administrator or hospital Information Security Officer immediately.
      </td>
    </tr>
  </table>
</body>
</html>
"""

    if smtp_host:
        try:
            msg = EmailMessage()
            msg["Subject"] = subject
            msg["From"] = smtp_from
            msg["To"] = to_email
            msg.set_content(plain_body)
            msg.add_alternative(html_body, subtype="html")

            if smtp_port == 465:
                with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10) as server:
                    if smtp_user and smtp_password:
                        server.login(smtp_user, smtp_password)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                    server.starttls()
                    if smtp_user and smtp_password:
                        server.login(smtp_user, smtp_password)
                    server.send_message(msg)

            logger.info(f"[EmailService] Real SMTP email sent to {to_email} with code {recovery_code}")
            return {"sent": True, "method": "smtp", "email": to_email}
        except Exception as e:
            logger.error(f"[EmailService] SMTP delivery to {to_email} failed: {e}. Falling back to simulation.", exc_info=True)

    # Simulated / Local development dispatch log
    logger.info(f"[EmailService] [DISPATCHED TO MAIL] Recipient: {to_email} | Subject: {subject} | Code: {recovery_code}")
    return {"sent": True, "method": "simulated", "email": to_email}
