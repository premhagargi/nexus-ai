import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// Pure cookie plumbing, same as app/auth/session/route.ts — no DB, no
// business logic, just clearing the httpOnly session cookie.
export async function POST(req: Request) {
  const cookieStore = await cookies()
  cookieStore.delete('session')
  return NextResponse.redirect(new URL('/login', req.url))
}
