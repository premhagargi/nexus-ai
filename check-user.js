const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function check() {
  const users = await prisma.user.findMany()
  console.log('All Users:', users.map(u => u.email))
  
  const specific = await prisma.user.findFirst({
    where: { email: { contains: 'premhagaragi@gmail' } }
  })
  console.log('Specific Match:', specific ? specific.email : 'None')
}

check().catch(console.error).finally(() => prisma.$disconnect())
