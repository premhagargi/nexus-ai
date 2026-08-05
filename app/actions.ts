'use server'

import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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

export async function updateWorkspace(workspaceId: string, name: string) {
  const session = await getSession()
  if (!session?.userId) throw new Error('Unauthorized')

  // Ensure user is owner
  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.userId } }
  })
  if (!membership || membership.role !== 'OWNER') throw new Error('Only owners can update the workspace')

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 6)

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { name, slug }
  })

  revalidatePath('/dashboard', 'layout')
}

export async function deleteWorkspace(workspaceId: string) {
  const session = await getSession()
  if (!session?.userId) throw new Error('Unauthorized')

  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.userId } }
  })
  if (!membership || membership.role !== 'OWNER') throw new Error('Only owners can delete the workspace')

  await prisma.workspace.delete({ where: { id: workspaceId } })

  revalidatePath('/dashboard', 'layout')
  redirect('/dashboard')
}
