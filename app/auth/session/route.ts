import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// Pure session-cookie plumbing — no database access, no business logic. The
// JWT itself is issued and verified entirely by the FastAPI backend; this
// route's only job is storing it in an httpOnly cookie so it can't be read
// by client-side JS, then letting the browser attach it automatically to
// same-origin /api/* requests (which next.config.ts rewrites to the backend).
export async function POST(req: Request) {
  const { token } = await req.json()
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'token is required' }, { status: 400 })
  }

  const cookieStore = await cookies()
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 1 day, matches JWT_EXPIRES_SECONDS on the backend
  })

  return NextResponse.json({ success: true })
}
