import { Snaptrade } from 'snaptrade-typescript-sdk'

const CLIENT_ID    = process.env.SNAPTRADE_CLIENT_ID    ?? ''
const CONSUMER_KEY = process.env.SNAPTRADE_CONSUMER_KEY ?? ''

function client() {
  return new Snaptrade({ clientId: CLIENT_ID, consumerKey: CONSUMER_KEY })
}

// ─── User registration ───────────────────────────────────────────────────────

export async function snapRegisterUser(userId: string): Promise<{ userSecret: string }> {
  const snap = client()
  const res = await snap.authentication.registerSnapTradeUser({ userId })
  const userSecret = (res.data as any)?.userSecret
  if (!userSecret) throw new Error('SnapTrade registration failed — no userSecret returned')
  return { userSecret }
}

// ─── Connection portal URL ───────────────────────────────────────────────────

export async function snapLoginUrl(
  userId: string,
  userSecret: string,
  broker?: string,
): Promise<string> {
  const snap = client()
  const params: Record<string, unknown> = { userId, userSecret }
  if (broker) params.broker = broker
  const res = await snap.authentication.loginSnapTradeUser(params as any)
  // redirectURI is returned to the client for browser-side navigation only —
  // it is never fetched server-side. Not an SSRF risk.
  const redirectURI = (res.data as any)?.redirectURI
  if (!redirectURI) throw new Error('SnapTrade login failed — no redirectURI returned')
  if (typeof redirectURI !== 'string' || !redirectURI.startsWith('https://')) {
    throw new Error('SnapTrade returned an invalid redirect URL')
  }
  return redirectURI
}

// ─── Accounts ────────────────────────────────────────────────────────────────

export interface SnapAccount {
  id:              string
  authorizationId: string
  name:            string
  institutionName: string
  number:          string
}

export async function snapListAccounts(
  userId: string,
  userSecret: string,
): Promise<SnapAccount[]> {
  const snap = client()
  const res = await snap.accountInformation.listUserAccounts({ userId, userSecret })
  const data = res.data
  return (Array.isArray(data) ? data : []).map((a: any) => ({
    id:              a.id ?? '',
    authorizationId: a.brokerage_authorization?.id ?? a.id ?? '',
    name:            a.name ?? '',
    institutionName: a.institution_name ?? a.brokerage_authorization?.brokerage?.name ?? 'Broker',
    number:          a.number ?? '',
  }))
}

export async function snapDeleteAccount(
  userId: string,
  userSecret: string,
  authorizationId: string,
): Promise<void> {
  const snap = client()
  await snap.connections.removeBrokerageAuthorization({ authorizationId, userId, userSecret })
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
  const snap = client()
  const res = await snap.accountInformation.getAllUserHoldings({ userId, userSecret })
  const data = res.data

  const holdings: SnapHolding[] = []
  for (const account of Array.isArray(data) ? data : []) {
    const broker      = account.account?.institution_name
      ?? account.account?.brokerage_authorization?.brokerage?.name
      ?? 'Broker'
    const accountId   = account.account?.id ?? ''
    const accountName = account.account?.name ?? broker

    for (const pos of account.positions ?? []) {
      const sym = pos.symbol
      const ticker = typeof sym === 'string'
        ? sym
        : (sym?.symbol?.ticker ?? sym?.symbol?.symbol ?? sym?.ticker ?? sym?.raw_symbol ?? null)
      if (!ticker || typeof ticker !== 'string') continue
      const units = Number(pos.units ?? 0)
      const price = pos.price != null ? Number(pos.price) : null
      const avgCost = pos.average_purchase_price != null ? Number(pos.average_purchase_price) : null
      holdings.push({
        accountId,
        broker,
        accountName,
        ticker,
        shares: units,
        price,
        value:  price != null ? units * price : null,
        cost:   avgCost != null ? units * avgCost : null,
      })
    }
  }
  return holdings
}
