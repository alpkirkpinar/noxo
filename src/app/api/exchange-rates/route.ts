import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
const CACHE_TTL_MS = 10 * 60 * 1000

type ExchangeRatesPayload = {
  base: string
  amount: number
  updatedAt: string
  source: string
  rates: LiveRate[]
  warning?: string
}

let exchangeRatesCache: { payload: ExchangeRatesPayload; expiresAt: number } | null = null

type LiveRate = {
  code: string
  name: string
  value: number
  unit: number
  buy: number
  sell: number
  source: string
}

type TcmbRateNode = {
  code: string
  unit: number
  forexSelling: number | null
}

const SUPPORTED_CURRENCIES = [
  { code: "USD", name: "Dolar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "Sterlin" },
] as const

function parseNumber(value: string | null | undefined) {
  const normalized = String(value ?? "")
    .trim()
    .replace(",", ".")

  const numeric = Number(normalized)
  return Number.isFinite(numeric) ? numeric : null
}

function extractTagValue(block: string, tagName: string) {
  const pattern = new RegExp(`<${tagName}>([^<]+)</${tagName}>`, "i")
  const match = block.match(pattern)
  return match?.[1]?.trim() ?? null
}

function parseTcmbRates(xml: string) {
  const currencyBlocks = xml.match(/<Currency[\s\S]*?<\/Currency>/gi) ?? []

  const parsed = currencyBlocks
    .map((block) => {
      const codeMatch = block.match(/CurrencyCode="([^"]+)"/i)
      const code = codeMatch?.[1]?.trim().toUpperCase() ?? ""

      if (!SUPPORTED_CURRENCIES.some((currency) => currency.code === code)) {
        return null
      }

      const unit = parseNumber(extractTagValue(block, "Unit")) ?? 1
      const forexSelling = parseNumber(extractTagValue(block, "ForexSelling"))
      const banknoteSelling = parseNumber(extractTagValue(block, "BanknoteSelling"))

      return {
        code,
        unit,
        forexSelling: forexSelling ?? banknoteSelling,
      } satisfies TcmbRateNode
    })
    .filter((item): item is TcmbRateNode => item !== null)

  return SUPPORTED_CURRENCIES.flatMap((currency) => {
    const match = parsed.find((item) => item.code === currency.code)

    if (!match?.forexSelling || match.forexSelling <= 0 || match.unit <= 0) {
      return []
    }

    return [
      {
        code: currency.code,
        name: currency.name,
        value: match.forexSelling / match.unit,
        unit: match.unit,
        buy: match.forexSelling / match.unit,
        sell: match.forexSelling / match.unit,
        source: "TCMB",
      } satisfies LiveRate,
    ]
  })
}

async function fetchTcmbRates() {
  const response = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml", {
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`TCMB request failed with status ${response.status}`)
  }

  const xml = await response.text()
  const rates = parseTcmbRates(xml)

  if (rates.length === 0) {
    throw new Error("TCMB response did not include supported currencies")
  }

  return rates
}

async function fetchFallbackRates() {
  const response = await fetch("https://open.er-api.com/v6/latest/TRY", {
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Fallback request failed with status ${response.status}`)
  }

  const data = await response.json()
  const sourceRates = data?.rates ?? {}

  const rates = SUPPORTED_CURRENCIES.flatMap((currency) => {
    const numericValue = Number(sourceRates?.[currency.code])

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return []
    }

    return [
      {
        code: currency.code,
        name: currency.name,
        value: 1 / numericValue,
        unit: 1,
        buy: 1 / numericValue,
        sell: 1 / numericValue,
        source: "open.er-api.com",
      } satisfies LiveRate,
    ]
  })

  if (rates.length === 0) {
    throw new Error("Fallback response did not include supported currencies")
  }

  return rates
}

export async function GET() {
  const now = Date.now()

  if (exchangeRatesCache && exchangeRatesCache.expiresAt > now) {
    return NextResponse.json(exchangeRatesCache.payload)
  }

  try {
    const rates = await fetchTcmbRates()
    const payload: ExchangeRatesPayload = {
      base: "TRY",
      amount: 1,
      updatedAt: new Date().toISOString(),
      source: "TCMB",
      rates,
    }

    exchangeRatesCache = {
      payload,
      expiresAt: now + CACHE_TTL_MS,
    }

    return NextResponse.json(payload)
  } catch (primaryError) {
    try {
      const rates = await fetchFallbackRates()
      const payload: ExchangeRatesPayload = {
        base: "TRY",
        amount: 1,
        updatedAt: new Date().toISOString(),
        source: "open.er-api.com",
        rates,
        warning:
          primaryError instanceof Error
            ? primaryError.message
            : "Primary exchange rate source failed.",
      }

      exchangeRatesCache = {
        payload,
        expiresAt: now + CACHE_TTL_MS,
      }

      return NextResponse.json(payload)
    } catch (fallbackError) {
      const message =
        fallbackError instanceof Error ? fallbackError.message : "Exchange rates could not be loaded."

      return NextResponse.json({ error: message }, { status: 502 })
    }
  }
}
