import { Resend } from 'resend'
import { getOnboardingDocLabels, type ExperienceType } from '@/lib/onboarding-docs'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const FROM_EMAIL = 'HR <hr@mediend.com>'

export async function sendDocumentEmail(
  to: string,
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    return { success: false, error: 'Email service not configured (RESEND_API_KEY missing)' }
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html: htmlContent,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send email'
    return { success: false, error: message }
  }
}

export async function sendOnboardingInviteEmail(params: {
  to: string
  name: string
  email: string
  password: string
  employeeCode?: string
  experienceType?: ExperienceType | null
}): Promise<{ success: boolean; error?: string }> {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://workspace.mediend.com').replace(/\/$/, '')
  const loginUrl = `${baseUrl}/login`
  const firstName = params.name.trim().split(/\s+/)[0] || params.name
  const experienceLabel = params.experienceType === 'EXPERIENCED' ? 'experienced hire' : 'fresher'
  const docsHtml = getOnboardingDocLabels(params.experienceType).map(
    (d) => `<li style="margin:0 0 6px;">${escapeHtml(d)}</li>`
  ).join('')

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f7fb;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="padding:28px 28px 12px;background:linear-gradient(135deg,#0284c7,#7c3aed);color:#fff;">
              <div style="font-size:13px;opacity:.9;letter-spacing:.04em;text-transform:uppercase;">Mediend Workspace</div>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;font-weight:700;">Welcome to Mediend, ${escapeHtml(firstName)}!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.55;">
                Welcome aboard! Your Mediend Workspace account has been created by HR.
                Use the login details below to access the portal and complete your onboarding as a ${escapeHtml(experienceLabel)}.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin:0 0 20px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 10px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">Login credentials</p>
                    <p style="margin:0 0 8px;font-size:14px;"><strong>Username (email):</strong> ${escapeHtml(params.email)}</p>
                    <p style="margin:0 0 8px;font-size:14px;"><strong>Temporary password:</strong> <code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;font-size:13px;">${escapeHtml(params.password)}</code></p>
                    ${params.employeeCode ? `<p style="margin:0 0 8px;font-size:14px;"><strong>Employee code:</strong> ${escapeHtml(params.employeeCode)}</p>` : ''}
                    <p style="margin:0;font-size:14px;"><strong>Portal link:</strong> <a href="${loginUrl}" style="color:#0284c7;">${escapeHtml(loginUrl)}</a></p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:15px;font-weight:600;">Getting started</p>
              <ol style="margin:0 0 20px;padding-left:18px;font-size:14px;line-height:1.6;color:#334155;">
                <li>Open the portal link and sign in with the username and temporary password above</li>
                <li>Complete your onboarding profile and upload the required documents</li>
                <li>After you can access the app, go to <strong>Profile → Change password</strong> and set a new password only you know</li>
              </ol>
              <p style="margin:0 0 8px;font-size:15px;font-weight:600;">Documents needed for onboarding</p>
              <p style="margin:0 0 8px;font-size:14px;line-height:1.55;color:#334155;">
                Please keep soft copies ready (PDF or clear photos) so you can upload them during onboarding:
              </p>
              <ul style="margin:0 0 20px;padding-left:18px;font-size:14px;line-height:1.55;color:#334155;">
                ${docsHtml}
              </ul>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#334155;">
                You will also need your phone number, address, emergency contact, Aadhaar number, PAN, and bank account details (account holder name, account number, IFSC).
              </p>
              <a href="${loginUrl}" style="display:inline-block;background:#0284c7;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 18px;border-radius:10px;">
                Open Mediend Workspace
              </a>
              <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#64748b;">
                This welcome email was sent by Mediend HR to your personal email. If you were not expecting this, please contact HR.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim()

  return sendDocumentEmail(
    params.to,
    'Welcome to Mediend — your Workspace login & onboarding details',
    html
  )
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
