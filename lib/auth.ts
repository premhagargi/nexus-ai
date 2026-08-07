import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const secretKey = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET environment variable is missing in production!') })() : 'nexus-ai-dev-jwt-secret-key-change-in-prod-32bytes')
const key = new TextEncoder().encode(secretKey)

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(key)
}

export async function decrypt(input: string): Promise<any> {
  const { payload } = await jwtVerify(input, key, {
    algorithms: ['HS256'],
  })
  return payload
}

export async function getSession() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  if (!session) return null
  try {
    return await decrypt(session)
  } catch (error) {
    return null
  }
}

export async function setSession(userId: string) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const session = await encrypt({ userId, expires })
  
  const cookieStore = await cookies()
  cookieStore.set('session', session, {
    expires,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  })
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}

export async function requireWorkspaceAccess(workspaceId: string) {
  const session = await getSession()
  if (!session?.userId) return null

  const membership = await import('./prisma').then(m => m.default.membership.findFirst({
    where: {
      workspaceId,
      userId: session.userId,
    },
    include: {
      workspace: true,
      user: {
        select: { id: true, email: true }
      }
    }
  }))

  if (!membership) return null

  return {
    userId: session.userId,
    role: membership.role,
    workspace: membership.workspace,
    user: membership.user
  }
}

