import prisma from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

export default async function ToolLogsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  
  const logs = await prisma.toolExecution.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h2 className="text-3xl font-semibold tracking-tighter">Tool Execution Logs</h2>
        <p className="text-muted-foreground">
          Audit trail for AI tool usage in this workspace.
        </p>
      </div>

      <div className="space-y-4">
        {logs.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">
            No tool executions yet.
          </div>
        ) : (
          logs.map(log => (
            <Card key={log.id}>
              <CardHeader className="py-3 px-4 bg-muted/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-mono">{log.toolName}</CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-4 grid md:grid-cols-2 gap-4 text-xs font-mono">
                <div className="space-y-2">
                  <div className="font-semibold text-muted-foreground">Arguments:</div>
                  <pre className="bg-muted p-2 rounded-md overflow-x-auto border border-border text-xs">
                    {JSON.stringify(log.arguments, null, 2)}
                  </pre>
                </div>
                <div className="space-y-2">
                  <div className="font-semibold text-muted-foreground">Result:</div>
                  <pre className="bg-muted p-2 rounded-md overflow-x-auto border border-border text-xs">
                    {JSON.stringify(log.result, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
