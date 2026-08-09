'use client'

import { useState } from 'react'
import { Task } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { CheckCircle2, Circle, Plus, Trash2, Filter, CheckSquare, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

export function TasksClient({ initialTasks, workspaceId }: { initialTasks: Task[], workspaceId: string }) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleToggleCompleted = async (task: Task) => {
    const nextState = !task.completed
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: nextState } : t))

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: nextState })
      })
      if (!res.ok) {
        throw new Error('Failed to update task')
      }
      toast.success(nextState ? 'Task marked complete' : 'Task marked pending')
    } catch (err: any) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: task.completed } : t))
      toast.error(err.message || 'Failed to update task')
    }
  }

  const handleDeleteTask = async (taskId: string, title: string) => {
    if (!confirm(`Delete task "${title}"?`)) return
    setTasks(prev => prev.filter(t => t.id !== taskId))

    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete task')
      toast.success('Task deleted')
    } catch (err: any) {
      toast.error(err.message || 'Deletion failed')
    }
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || isCreating) return

    setIsCreating(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          title: newTitle.trim(),
          description: newDescription.trim() || null
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create task')
      }

      const newTask = await res.json()
      setTasks(prev => [newTask, ...prev])
      toast.success('Task created!')
      setNewTitle('')
      setNewDescription('')
      setIsDialogOpen(false)
    } catch (err: any) {
      toast.error(err.message || 'Task creation failed')
    } finally {
      setIsCreating(false)
    }
  }

  const filteredTasks = tasks.filter(task => {
    if (filter === 'pending') return !task.completed
    if (filter === 'completed') return task.completed
    return true
  })

  const completedCount = tasks.filter(t => t.completed).length
  const pendingCount = tasks.length - completedCount

  return (
    <div className="space-y-6 pb-10">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/10 text-pink-500 border border-pink-500/20">
            <CheckSquare className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tighter text-foreground">Due Diligence Checklist</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Due diligence items created manually or automatically by the M&A assistant.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${filter === 'all' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              All ({tasks.length})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${filter === 'pending' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${filter === 'completed' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Done ({completedCount})
            </button>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger>
              <Button size="sm" className="rounded-xl shadow-sm">
                <Plus className="h-4 w-4 mr-1.5" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <form onSubmit={handleCreateTask}>
                <DialogHeader>
                  <DialogTitle>Create Item</DialogTitle>
                  <DialogDescription>
                    Add a new item to your deal room due diligence checklist.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="task-title">Item Title</Label>
                    <Input
                      id="task-title"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. Review Q3 financial summary"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-desc">Description (Optional)</Label>
                    <Textarea
                      id="task-desc"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Additional detail or instructions..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isCreating}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!newTitle.trim() || isCreating}>
                    {isCreating ? 'Creating...' : 'Create Item'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Task Cards Grid */}
      <div className="grid gap-3">
        {filteredTasks.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-border/80 bg-card/40">
            <CheckSquare className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">No tasks in this view</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Create a task above or ask the AI assistant in chat to save action items for you.
            </p>
          </Card>
        ) : (
          filteredTasks.map(task => (
            <Card
              key={task.id}
              className={`border border-border/60 hover:border-border shadow-sm transition-all duration-200 group ${task.completed ? 'bg-muted/20 opacity-75' : 'bg-card'}`}
            >
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="flex items-start gap-3 flex-1">
                  <button
                    onClick={() => handleToggleCompleted(task)}
                    className="mt-0.5 text-muted-foreground hover:text-emerald-500 transition-colors focus:outline-none"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Circle className="h-5 w-5 hover:scale-110 transition-transform" />
                    )}
                  </button>
                  <div className="flex-1">
                    <p className={`font-medium text-[14px] tracking-tight ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {task.description}
                      </p>
                    )}
                    <span className="text-[11px] text-muted-foreground/70 font-mono mt-2 inline-block">
                      {new Date(task.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteTask(task.id, task.title)}
                  className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
