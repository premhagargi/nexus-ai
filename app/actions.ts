'use server'

import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function createWorkspace(name: string) {
  const session = await getSession()
  if (!session?.userId) throw new Error('Unauthorized')

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 7)
  
  const workspace = await prisma.workspace.create({
    data: {
      name,
      slug,
      ownerId: session.userId,
      memberships: {
        create: {
          userId: session.userId,
          role: 'OWNER'
        }
      }
    }
  })

  revalidatePath('/dashboard', 'layout')
  return workspace.id
}
