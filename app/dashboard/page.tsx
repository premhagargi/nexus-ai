import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'

export default async function DashboardIndexPage() {
  const session = await getSession()

  if (!session?.userId) {
    redirect('/login')
  }

  // Find the user's workspaces
  const userWorkspaces = await prisma.workspace.findMany({
    where: {
      memberships: {
        some: { userId: session.userId }
      }
    }
  })

  if (userWorkspaces.length > 0) {
    redirect(`/dashboard/${userWorkspaces[0].id}`)
  }

  // Handle case where user has no workspaces (create a default one)
  const newWorkspace = await prisma.workspace.create({
    data: {
      name: 'Personal Workspace',
      slug: `personal-${session.userId.substring(0, 8)}`,
      ownerId: session.userId,
      memberships: {
        create: {
          userId: session.userId,
          role: 'OWNER'
        }
      }
    }
  })

  redirect(`/dashboard/${newWorkspace.id}`)
}
