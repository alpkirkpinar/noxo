type SendEmailInput = {
  to: string
  subject: string
  text: string
  html: string
}

type SendEmailResult =
  | { sent: true }
  | { sent: false; skipped: true; error: string }
  | { sent: false; skipped?: false; error: string }

type NewEmployeeCredentialsInput = {
  fullName: string
  email: string
  password: string
  companyName: string
  loginUrl: string
}

export async function sendNewEmployeeCredentialsEmail(
  input: NewEmployeeCredentialsInput
): Promise<SendEmailResult> {
  const safeFullName = escapeHtml(input.fullName)
  const safeCompanyName = escapeHtml(input.companyName)
  const safeEmail = escapeHtml(input.email)
  const safePassword = escapeHtml(input.password)
  const safeLoginUrl = escapeHtml(input.loginUrl)

  return sendEmail({
    to: input.email,
    subject: "Noxo giriş bilgileriniz",
    text: [
      `Merhaba ${input.fullName},`,
      "",
      `${input.companyName} için Noxo hesabınız oluşturuldu.`,
      "",
      `Giriş adresi: ${input.loginUrl}`,
      `E-posta: ${input.email}`,
      `Geçici şifre: ${input.password}`,
      "",
      "İlk girişinizden sonra şifrenizi değiştirmeniz istenecektir.",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.55;">
        <h2 style="margin: 0 0 16px;">Noxo giriş bilgileriniz</h2>
        <p>Merhaba ${safeFullName},</p>
        <p><strong>${safeCompanyName}</strong> için Noxo hesabınız oluşturuldu.</p>
        <table style="border-collapse: collapse; margin: 18px 0;">
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc;">Giriş adresi</td>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0;"><a href="${safeLoginUrl}">${safeLoginUrl}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc;">E-posta</td>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${safeEmail}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc;">Geçici şifre</td>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-family: monospace; font-size: 16px;">${safePassword}</td>
          </tr>
        </table>
        <p>İlk girişinizden sonra şifrenizi değiştirmeniz istenecektir.</p>
      </div>
    `,
  })
}

async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.MAIL_FROM?.trim() || process.env.EMAIL_FROM?.trim()

  if (!apiKey || !from) {
    return {
      sent: false,
      skipped: true,
      error: "Mail ayarlari eksik. RESEND_API_KEY ve MAIL_FROM tanimlanmali.",
    }
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    })

    if (!response.ok) {
      return {
        sent: false,
        error: await readEmailProviderError(response),
      }
    }

    return { sent: true }
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Mail gonderilemedi.",
    }
  }
}

async function readEmailProviderError(response: Response) {
  const fallback = `Mail servisi ${response.status} hatasi dondu.`

  try {
    const data = (await response.json()) as { message?: unknown; error?: unknown }
    const message = data.message || data.error
    return typeof message === "string" && message.trim() ? message : fallback
  } catch {
    try {
      const text = await response.text()
      return text.trim() || fallback
    } catch {
      return fallback
    }
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
