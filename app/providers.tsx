'use client'

import { useState } from 'react'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

// No-op during SSR (no window) so the component tree is identical on the
// server and first client render — a real persister here would otherwise
// cause a hydration mismatch between the SSR pass and the client restore.
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data is "fresh" for 1 minute — no network call on remount/navigation
            // within that window, even without the persisted cache.
            staleTime: 60 * 1000,
            // Persisted cache entries are considered too old to restore after this.
            gcTime: 30 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  )

  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: typeof window !== 'undefined' ? window.sessionStorage : noopStorage,
      key: 'nexus-query-cache',
    })
  )

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 30 * 60 * 1000 }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
