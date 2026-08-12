import { test, expect } from '@playwright/test'

test.describe('Nexus AI Pipeline Tests', () => {
  test('Protected API endpoints return 401/403 for unauthorized requests', async ({ request }) => {
    const taskRes = await request.get('/api/tasks?workspaceId=fake-workspace-id')
    expect([401, 403]).toContain(taskRes.status())

    const docContentRes = await request.get('/api/documents/fake-doc-id/content')
    expect([401, 403, 404]).toContain(docContentRes.status())
  })
})
