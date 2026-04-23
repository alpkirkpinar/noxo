import { randomUUID, randomBytes } from "crypto"
import { existsSync, readFileSync } from "fs"
import { resolve } from "path"
import { createClient } from "@supabase/supabase-js"

loadEnvFile(".env.local")
loadEnvFile(".env")

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = (process.argv[2] || "master@noxo.local").trim().toLowerCase()
const fullName = process.argv[3] || "Master Kullanıcı"
const password = process.argv[4] || generatePassword()

if (!supabaseUrl || !serviceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.")
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const existingUser = await findUserByEmail(email)
let authUserId = existingUser?.id ?? null

if (authUserId) {
  const { error } = await admin.auth.admin.updateUserById(authUserId, {
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      must_change_password: false,
    },
    app_metadata: {
      role: "master",
      super_user: true,
      permissions: [],
    },
  })

  if (error) {
    console.error(error.message)
    process.exit(1)
  }
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      must_change_password: false,
    },
    app_metadata: {
      role: "master",
      super_user: true,
      permissions: [],
    },
  })

  if (error || !data.user) {
    console.error(error?.message || "Master auth kullanıcısı oluşturulamadı.")
    process.exit(1)
  }

  authUserId = data.user.id
}

const companyId = await ensureMasterAppUser(authUserId, email, fullName)
await ensureMasterSettings(companyId)

console.log("Master kullanıcı hazır.")
console.log(`E-posta: ${email}`)
console.log("Kullanıcı adı: master")
console.log(`Şifre: ${password}`)
console.log(`Master company_id: ${companyId}`)

async function ensureMasterAppUser(authUserId, email, fullName) {
  const { data: existing, error: existingError } = await admin
    .from("app_users")
    .select("id, company_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle()

  if (existingError) {
    console.error(existingError.message)
    process.exit(1)
  }

  const companyId = existing?.company_id || randomUUID()
  await ensureCompanyRecord(companyId, "Master")

  if (existing?.id) {
    const { error } = await admin
      .from("app_users")
      .update({
        company_id: companyId,
        username: "master",
        full_name: fullName,
        email,
        title: "Master",
      })
      .eq("id", existing.id)

    if (error) {
      console.error(error.message)
      process.exit(1)
    }

    return companyId
  }

  const { error } = await admin.from("app_users").insert({
    auth_user_id: authUserId,
    company_id: companyId,
    username: "master",
    full_name: fullName,
    email,
    title: "Master",
  })

  if (error) {
    console.error(error.message)
    process.exit(1)
  }

  return companyId
}

async function ensureCompanyRecord(companyId, companyName) {
  const { data: existing, error: selectError } = await admin
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .maybeSingle()

  if (selectError) {
    console.error(selectError.message)
    process.exit(1)
  }

  if (existing?.id) return

  const payloads = [
    { id: companyId, name: companyName, short_code: buildShortCode(companyName) },
    { id: companyId, company_name: companyName },
    { id: companyId },
  ]

  let lastError = null

  for (const payload of payloads) {
    const { error } = await admin.from("companies").insert(payload)

    if (!error) return

    lastError = error

    if (
      !/column .* does not exist/i.test(error.message) &&
      !/could not find .* column/i.test(error.message) &&
      !/null value in column/i.test(error.message)
    ) {
      break
    }
  }

  console.error(lastError?.message || "Master şirket kaydı oluşturulamadı.")
  process.exit(1)
}

function buildShortCode(companyName) {
  const code = companyName
    .toUpperCase()
    .replace(/İ/g, "I")
    .replace(/Ş/g, "S")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12)

  return code || `FIRMA${Date.now().toString().slice(-6)}`
}

async function ensureMasterSettings(companyId) {
  const { error } = await admin.from("system_settings").upsert(
    {
      company_id: companyId,
      company_name: "Master",
      logo_url: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id" }
  )

  if (error) {
    console.error(error.message)
    process.exit(1)
  }
}

async function findUserByEmail(email) {
  let page = 1

  while (page < 100) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })

    if (error) {
      console.error(error.message)
      process.exit(1)
    }

    const user = data.users.find((item) => item.email?.toLowerCase() === email)
    if (user) return user
    if (data.users.length < 1000) return null

    page += 1
  }

  return null
}

function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*"
  const bytes = randomBytes(16)

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")
}

function loadEnvFile(fileName) {
  const path = resolve(process.cwd(), fileName)
  if (!existsSync(path)) return

  const content = readFileSync(path, "utf8")

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const equalsIndex = trimmed.indexOf("=")
    if (equalsIndex === -1) continue

    const key = trimmed.slice(0, equalsIndex).trim()
    let value = trimmed.slice(equalsIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}
