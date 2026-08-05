import { createClient } from '@/lib/supabase/server'
import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'

export default async function DashboardIndex() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { workspace: true }
  })

  if (memberships.length > 0) {
    redirect(`/dashboard/${memberships[0].workspaceId}`)
  } else {
    // Create default workspace
    const newWorkspace = await prisma.workspace.create({
      data: {
        name: 'Personal Workspace',
        slug: 'personal-' + Date.now(),
        ownerId: user.id,
        memberships: {
          create: {
            userId: user.id,
            role: 'OWNER'
          }
        }
      }
    })
    redirect(`/dashboard/${newWorkspace.id}`)
  }
}
