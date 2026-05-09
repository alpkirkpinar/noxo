type SendEmailInput = {
  to: string | string[]
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

type TicketNotificationInput = {
  to: string[]
  companyName: string
  ticketNo: string
  title: string
  description?: string | null
  customerName: string
  machineName?: string | null
  openedByName: string
  priority?: string | null
  detailUrl: string
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

export async function sendNewTicketNotificationEmail(
  input: TicketNotificationInput
): Promise<SendEmailResult> {
  const recipients = Array.from(
    new Set(
      input.to
        .map((value) => String(value).trim().toLowerCase())
        .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    )
  )

  if (recipients.length === 0) {
    return {
      sent: false,
      skipped: true,
      error: "Gecerli alici e-posta adresi bulunamadi.",
    }
  }

  const safeCompanyName = escapeHtml(input.companyName)
  const safeTicketNo = escapeHtml(input.ticketNo)
  const safeTitle = escapeHtml(input.title)
  const safeDescription = escapeHtml(String(input.description ?? "").trim() || "-")
  const safeCustomerName = escapeHtml(input.customerName)
  const safeMachineName = escapeHtml(String(input.machineName ?? "").trim() || "-")
  const safeOpenedByName = escapeHtml(input.openedByName)
  const safePriority = escapeHtml(String(input.priority ?? "").trim() || "-")
  const safeDetailUrl = escapeHtml(input.detailUrl)

  return sendEmail({
    to: recipients,
    subject: `Yeni ticket: ${input.ticketNo} - ${input.title}`,
    text: [
      `${input.companyName} icin yeni bir ticket olusturuldu.`,
      "",
      `Ticket No: ${input.ticketNo}`,
      `Baslik: ${input.title}`,
      `Musteri: ${input.customerName}`,
      `Makine: ${String(input.machineName ?? "").trim() || "-"}`,
      `Oncelik: ${String(input.priority ?? "").trim() || "-"}`,
      `Acan kisi: ${input.openedByName}`,
      `Aciklama: ${String(input.description ?? "").trim() || "-"}`,
      "",
      `Detay: ${input.detailUrl}`,
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.55;">
        <h2 style="margin: 0 0 16px;">Yeni ticket olusturuldu</h2>
        <p><strong>${safeCompanyName}</strong> icin yeni bir ticket kaydi acildi.</p>
        <table style="border-collapse: collapse; margin: 18px 0;">
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc;">Ticket No</td>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${safeTicketNo}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc;">Baslik</td>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${safeTitle}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc;">Musteri</td>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${safeCustomerName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc;">Makine</td>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${safeMachineName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc;">Oncelik</td>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${safePriority}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc;">Acan kisi</td>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${safeOpenedByName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc;">Aciklama</td>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${safeDescription}</td>
          </tr>
        </table>
        <p><a href="${safeDetailUrl}">Ticket detayini ac</a></p>
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
        to: Array.isArray(input.to) ? input.to : [input.to],
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
