import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const secretKey = process.env.JWT_SECRET || 'super-secret-key-for-nexus-ai-dev'
const key = new TextEncoder().encode(secretKey)

export async function middleware(request: NextRequest) {
  const session = request.cookies.get('session')?.value

  let user = null
  if (session) {
    try {
      const { payload } = await jwtVerify(session, key, {
        algorithms: ['HS256'],
      })
      user = payload
    } catch (e) {
      user = null
    }
  }

  const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard') || 
                           (request.nextUrl.pathname.startsWith('/api/') && !request.nextUrl.pathname.startsWith('/api/auth/'))

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Also prevent logged-in users from visiting login/signup
  if (
    user &&
    (request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/signup'))
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
