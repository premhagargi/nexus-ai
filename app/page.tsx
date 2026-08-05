import { getSession } from '@/lib/auth'
import LandingClient from './landing-client'

export default async function Page() {
  const session = await getSession()
  return <LandingClient isAuthenticated={!!session?.userId} />
}
