import { getAuthToken } from '@/lib/auth'
import LandingClient from './landing-client'

export default async function Page() {
  const token = await getAuthToken()
  return <LandingClient isAuthenticated={!!token} />
}
