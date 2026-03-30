import crypto from 'crypto'

const CLIENT_ID    = process.env.SNAPTRADE_CLIENT_ID    ?? ''
const CONSUMER_KEY = process.env.SNAPTRADE_CONSUMER_KEY ?? ''
const BASE_URL     = 'https://api.snaptrade.com/api/v1'

/** Build the required SnapTrade request headers (signature + timestamp). */
function snapHeaders(timestamp: number): Record<string, string> {
  const signature = crypto
    .createHmac('sha256', CONSUMER_KEY)
    .update(`${CLIENT_ID}${timestamp}${CONSUMER_KEY}`)
    .digest('base64')
  return {
    'Content-Type':    'application/json',
    'clientId':        CLIENT_ID,
    'timestamp':       String(timestamp),
    'signature':       signature,
  }
}

/** Append required query params to a SnapTrade URL that needs user auth. */
function userParams(userId: string, userSecret: string) {
  return new URLSearchParams({ clientId: CLIENT_ID, userId, userSecret })
}

// ─── User registration ───────────────────────────────────────────────────────

export async function snapRegisterUser(userId: string): Promise<{ userSecret: string }> {
  const ts = Math.floor(Date.now() / 1000)
  const res = await fetch(`${BASE_URL}/snapTrade/registerUser`, {
    method: 'POST',
    headers: snapHeaders(ts),
    body: JSON.stringify({ userId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.detail ?? `SnapTrade registerUser failed: ${res.status}`)
  }
  const data = await res.json()
  return { userSecret: data.userSecret }
}

// ─── Connection portal URL ───────────────────────────────────────────────────

export async function snapLoginUrl(
  userId: string,
  userSecret: string,
  broker?: string,
): Promise<string> {
  const ts = Math.floor(Date.now() / 1000)
  const body: Record<string, string> = { userId, userSecret }
  if (broker) body.broker = broker

  const res = await fetch(`${BASE_URL}/snapTrade/login`, {
    method: 'POST',
    headers: snapHeaders(ts),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`SnapTrade login failed: ${res.status}`)
  const data = await res.json()
  return data.redirectURI as string
}

// ─── Accounts ────────────────────────────────────────────────────────────────

export interface SnapAccount {
  id:           string
  name:         string
  institutionName: string
  number:       string
}

export async function snapListAccounts(
  userId: string,
  userSecret: string,
): Promise<SnapAccount[]> {
  const ts = Math.floor(Date.now() / 1000)
  const url = `${BASE_URL}/accounts?${userParams(userId, userSecret)}`
  const res = await fetch(url, { headers: snapHeaders(ts) })
  if (!res.ok) return []
  const data = await res.json()
  return (Array.isArray(data) ? data : []).map((a: any) => ({
    id:              a.id,
    name:            a.name,
    institutionName: a.institution_name ?? a.brokerage_authorization?.brokerage?.name ?? 'Broker',
    number:          a.number ?? '',
  }))
}

export async function snapDeleteAccount(
  userId: string,
  userSecret: string,
  accountId: string,
): Promise<void> {
  const ts = Math.floor(Date.now() / 1000)
  const url = `${BASE_URL}/accounts/${accountId}?${userParams(userId, userSecret)}`
  await fetch(url, { method: 'DELETE', headers: snapHeaders(ts) })
}

// ─── Holdings ────────────────────────────────────────────────────────────────

export interface SnapHolding {
  accountId:   string
  broker:      string
  accountName: string
  ticker:      string
  shares:      number
  price:       number | null
  value:       number | null
  cost:        number | null
}

export async function snapFetchHoldings(
  userId: string,
  userSecret: string,
): Promise<SnapHolding[]> {
  const ts = Math.floor(Date.now() / 1000)
  const url = `${BASE_URL}/holdings?${userParams(userId, userSecret)}`
  const res = await fetch(url, { headers: snapHeaders(ts) })
  if (!res.ok) return []
  const data = await res.json()

  const holdings: SnapHolding[] = []
  for (const account of Array.isArray(data) ? data : []) {
    const broker      = account.institution_name
      ?? account.brokerage_authorization?.brokerage?.name
      ?? 'Broker'
    const accountId   = account.account?.id ?? ''
    const accountName = account.account?.name ?? broker

    for (const pos of account.positions ?? []) {
      const ticker = pos.symbol?.symbol ?? pos.symbol?.ticker ?? pos.ticker ?? null
      if (!ticker) continue
      holdings.push({
        accountId,
        broker,
        accountName,
        ticker,
        shares: Number(pos.units ?? 0),
        price:  pos.price != null ? Number(pos.price) : null,
        value:  pos.open_pnl != null || pos.price != null
          ? Number(pos.units ?? 0) * Number(pos.price ?? 0)
          : null,
        cost:   pos.average_purchase_price != null
          ? Number(pos.units ?? 0) * Number(pos.average_purchase_price)
          : null,
      })
    }
  }
  return holdings
}
