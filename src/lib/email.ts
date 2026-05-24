import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface BugEmailParams {
  teacherName: string
  errorMessage: string
  pageUrl: string
  userDescription?: string
  createdAt: string
}

export async function sendBugReportEmail(params: BugEmailParams) {
  const { teacherName, errorMessage, pageUrl, userDescription, createdAt } = params

  await resend.emails.send({
    from: 'noreply@students-list.app',
    to: 'avigailregev@gmail.com',
    subject: `🐛 באג חדש — ${teacherName}`,
    html: `
      <div dir="rtl" style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:#fef2f2;border-right:4px solid #ef4444;border-radius:8px;padding:14px;margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:#ef4444;margin-bottom:4px">שגיאה חדשה דווחה</div>
          <div style="font-size:13px;color:#7f1d1d">${errorMessage}</div>
        </div>
        <table style="width:100%;font-size:13px;border-collapse:collapse">
          <tr style="border-bottom:1px solid #f3f4f6">
            <td style="padding:8px 4px;color:#6b7280;width:100px">מורה</td>
            <td style="padding:8px 4px;font-weight:600;color:#111">${teacherName}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6">
            <td style="padding:8px 4px;color:#6b7280">דף</td>
            <td style="padding:8px 4px;color:#111">${pageUrl}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6">
            <td style="padding:8px 4px;color:#6b7280">שעה</td>
            <td style="padding:8px 4px;color:#111">${createdAt}</td>
          </tr>
          ${userDescription ? `
          <tr>
            <td style="padding:8px 4px;color:#6b7280">תיאור</td>
            <td style="padding:8px 4px;color:#111">״${userDescription}״</td>
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
}
