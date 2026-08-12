import { cookies } from 'next/headers'

// Next.js is frontend-only now — all auth verification, DB access, and
// business logic live in the FastAPI backend. This module's only job is
// reading the httpOnly session cookie (set by app/auth/session/route.ts)
// and forwarding it to the backend as a Bearer token for server-side data
// fetching in Server Components.
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://127.0.0.1:8000'

export async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('session')?.value ?? null
}

/**
 * Server-side fetch to the FastAPI backend, for use in Server Components
 * and Server Actions-free page loaders. Returns `null` on 401 (caller
 * should redirect to /login) so pages can render `redirect()` cleanly.
 */
export async function backendFetch<T = any>(
  path: string,
  options: { token?: string | null; method?: string; body?: unknown } = {}
): Promise<T | null> {
  const token = options.token ?? (await getAuthToken())
  if (!token) return null

  const res = await fetch(`${BACKEND_API_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  })

  if (res.status === 401) return null
  if (!res.ok) throw new Error(`Backend request failed: ${res.status} ${await res.text()}`)
  return res.json()
}
