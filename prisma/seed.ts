import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('Seeding dummy data...')

  // Create a dummy user
  const userId = '11111111-1111-1111-1111-111111111111'
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email: 'test@example.com'
    }
  })

  // Create a dummy workspace
  const workspaceId = '22222222-2222-2222-2222-222222222222'
  await prisma.workspace.upsert({
    where: { id: workspaceId },
    update: {},
    create: {
      id: workspaceId,
      name: 'Test Workspace',
      slug: 'test-workspace',
      ownerId: userId
    }
  })

  // Link user to workspace
  await prisma.membership.upsert({
    where: { workspaceId_userId: { workspaceId, userId } },
    update: {},
    create: {
      workspaceId,
      userId,
      role: 'OWNER'
    }
  })

  // Create a task
  await prisma.task.create({
    data: {
      title: 'Setup E2E Tests',
      description: 'Run playwright tests',
      completed: false,
      workspaceId
    }
  })

  console.log('Dummy data seeded!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
