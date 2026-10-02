// Forwards /api/v1/* to the Renters API with the signed-in user's Kinde access token.
// The token is read from the server-side session, so it never reaches browser JavaScript.
import type { NextRequest } from 'next/server'
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'

const API_TARGET = (process.env.API_PROXY_TARGET ?? 'http://localhost:5000/api/v1').replace(/\/$/, '')

type Context = { params: Promise<{ path: string[] }> }

/** Reads a JWT's expiry without verifying it — the API does the verifying. */
function isExpired(token: string) {
  try {
    const { exp } = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    return typeof exp === 'number' && exp * 1000 < Date.now() + 30_000
  } catch {
    return true
  }
}

async function accessToken() {
  const session = getKindeServerSession()
  if (!(await session.isAuthenticated())) return null
  let token = await session.getAccessTokenRaw()
  if (!token || isExpired(token)) {
    await session.refreshTokens()
    token = await session.getAccessTokenRaw()
  }
  return token
}

/**
 * The API only accepts tokens for users in its own User table. On a signed-in user's first visit,
 * register them through the open sign-up route so their token is accepted from then on.
 */
async function registerUser() {
  const user = await getKindeServerSession().getUser()
  if (!user?.email) return false
  const name = [user.given_name, user.family_name].filter(Boolean).join(' ') || user.email
  const response = await fetch(`${API_TARGET}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email: user.email, kindeId: user.id }),
    cache: 'no-store',
  })
  return response.ok
}

async function forward(request: NextRequest, { params }: Context) {
  const { path } = await params
  const url = `${API_TARGET}/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text()

  let token: string | null
  try {
    token = await accessToken()
  } catch {
    token = null // refresh failed — the user needs to sign in again
  }

  const send = () => fetch(url, {
    method: request.method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body,
    cache: 'no-store',
  })

  let response: Response
  try {
    response = await send()
    if (response.status === 401 && token && (await registerUser())) response = await send()
  } catch {
    return Response.json({ message: 'The Renters API is not reachable.', statusCode: 502 }, { status: 502 })
  }

  return new Response(response.body, { status: response.status, headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/json' } })
}

export { forward as GET, forward as POST, forward as PATCH, forward as PUT, forward as DELETE }
