import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { setSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = body.email?.trim()
    const password = body.password
    const workspaceName = body.workspaceName?.trim() || 'My Workspace'

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email already exists. Please log in instead.' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        ownedWorkspaces: {
          create: {
            name: workspaceName,
            slug: workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 6)
          }
        }
      },
      include: {
        ownedWorkspaces: true
      }
    })
    
    // Add membership for the created workspace
    if (user.ownedWorkspaces.length > 0) {
      await prisma.membership.create({
        data: {
          userId: user.id,
          workspaceId: user.ownedWorkspaces[0].id,
          role: 'OWNER'
        }
      })
    }

    await setSession(user.id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
