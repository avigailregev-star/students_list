import nodemailer from 'nodemailer'
import { Resend } from 'resend'

interface InviteEmailParams {
  teacherEmail: string
  teacherName: string
  inviteLink: string
}

export async function sendTeacherInviteEmail({ teacherEmail, teacherName, inviteLink }: InviteEmailParams) {
  const gmailUser = process.env.GMAIL_USER
  const gmailPass = process.env.GMAIL_APP_PASSWORD

  if (!gmailUser || !gmailPass) {
    throw new Error('GMAIL_USER או GMAIL_APP_PASSWORD חסרים')
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: gmailUser, pass: gmailPass },
  })

  await transporter.sendMail({
    from: `"מערכת מעקב שיעורים" <${gmailUser}>`,
    to: teacherEmail,
    subject: 'הוזמנת להצטרף לאפליקציית מעקב השיעורים',
    html: `
      <div dir="rtl" style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h2 style="color:#0f766e;margin-bottom:8px">שלום ${escapeHtml(teacherName)},</h2>
        <p style="color:#374151;font-size:15px;line-height:1.6">הוזמנת להצטרף למערכת מעקב השיעורים.</p>
        <p style="color:#374151;font-size:15px;line-height:1.6">לחצי על הכפתור למטה להגדרת סיסמה וכניסה לאפליקציה:</p>
        <div style="margin:28px 0;text-align:center">
          <a href="${inviteLink}"
             style="background:#14b8a6;color:white;padding:13px 30px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;display:inline-block">
            הגדרת סיסמה וכניסה ←
          </a>
        </div>
        <p style="color:#9ca3af;font-size:12px">הקישור בתוקף ל-24 שעות.</p>
      </div>
    `,
  })
}

interface BugEmailParams {
  teacherName: string
  errorMessage: string
  pageUrl: string
  userDescription?: string
  createdAt: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function sendBugReportEmail(params: BugEmailParams) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY is not set — emails will not be sent')
    return
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { teacherName, errorMessage, pageUrl, userDescription, createdAt } = params

  try {
    const { error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'avigailregev@gmail.com',
      subject: `🐛 באג חדש — ${escapeHtml(teacherName)}`,
      html: `
        <div dir="rtl" style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <div style="background:#fef2f2;border-right:4px solid #ef4444;border-radius:8px;padding:14px;margin-bottom:16px">
            <div style="font-size:12px;font-weight:700;color:#ef4444;margin-bottom:4px">שגיאה חדשה דווחה</div>
            <div style="font-size:13px;color:#7f1d1d">${escapeHtml(errorMessage)}</div>
          </div>
          <table style="width:100%;font-size:13px;border-collapse:collapse">
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:8px 4px;color:#6b7280;width:100px">מורה</td>
              <td style="padding:8px 4px;font-weight:600;color:#111">${escapeHtml(teacherName)}</td>
            </tr>
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:8px 4px;color:#6b7280">דף</td>
              <td style="padding:8px 4px;color:#111">${escapeHtml(pageUrl)}</td>
            </tr>
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:8px 4px;color:#6b7280">שעה</td>
              <td style="padding:8px 4px;color:#111">${escapeHtml(createdAt)}</td>
            </tr>
            ${userDescription ? `
            <tr>
              <td style="padding:8px 4px;color:#6b7280">תיאור</td>
              <td style="padding:8px 4px;color:#111">״${escapeHtml(userDescription)}״</td>
            </tr>
            ` : ''}
          </table>
          <div style="margin-top:20px;text-align:center">
            <a href="https://students-list-ochre.vercel.app/admin/bugs"
               style="background:#14b8a6;color:white;padding:10px 24px;border-radius:8px;font-weight:700;font-size:13px;text-decoration:none;display:inline-block">
              פתחי דף הבאגים ←
            </a>
          </div>
        </div>
      `,
    })

    if (error) {
      console.error('[email] Resend returned error:', error)
    }
  } catch (err) {
    console.error('[email] Failed to send bug report email:', err)
    // Do not re-throw — email is best-effort
  }
}
