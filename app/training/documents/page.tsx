'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/use-auth'
import { apiGet, apiPost, apiDelete } from '@/lib/api-client'
import { toast } from 'sonner'
import {
  ArrowLeft,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react'

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'EXECUTIVE_ASSISTANT'])

const ROLE_OPTIONS = [
  'BD',
  'TEAM_LEAD',
  'ASSISTANT_CATEGORY_MANAGER',
  'CATEGORY_MANAGER',
  'SALES_HEAD',
  'HR_HEAD',
  'FINANCE_HEAD',
  'INSURANCE_HEAD',
  'PL_HEAD',
  'MD',
  'ADMIN',
  'IT_HEAD',
  'DIGITAL_MARKETING_HEAD',
  'EXECUTIVE_ASSISTANT',
]

type KnowledgeDoc = {
  id: string
  title: string
  description: string | null
  visibility: 'GENERAL' | 'RESTRICTED'
  isActive: boolean
  sourceType: string
  createdAt: string
  uploadedBy: { id: string; name: string }
  roles: { role: string }[]
  users: { user: { id: string; name: string; email: string } }[]
  departments: { department: { id: string; name: string } }[]
  _count: { chunks: number }
}

type Department = { id: string; name: string }
type EmployeeOpt = { id: string; userId: string; name: string; email: string }

export default function KnowledgeDocumentsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const canManage = user && ADMIN_ROLES.has(user.role)

  const [docs, setDocs] = useState<KnowledgeDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [contentText, setContentText] = useState('')
  const [visibility, setVisibility] = useState<'GENERAL' | 'RESTRICTED'>('GENERAL')
  const [roles, setRoles] = useState<string[]>([])
  const [departmentIds, setDepartmentIds] = useState<string[]>([])
  const [userIds, setUserIds] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)

  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<EmployeeOpt[]>([])
  const [userSearch, setUserSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGet<KnowledgeDoc[]>('/api/ai/knowledge')
      setDocs(data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canManage) load()
  }, [canManage, load])

  useEffect(() => {
    if (!canManage) return
    ;(async () => {
      try {
        const depts = await apiGet<Department[]>('/api/departments')
        setDepartments(Array.isArray(depts) ? depts : [])
      } catch {
        /* optional */
      }
      try {
        const emps = await apiGet<
          Array<{
            id: string
            userId: string
            user?: { name: string; email: string }
          }>
        >('/api/employees')
        const list = Array.isArray(emps)
          ? emps
          : ((emps as { data?: typeof emps })?.data as typeof emps) || []
        setEmployees(
          (list as Array<{ id: string; userId: string; user?: { name: string; email: string } }>).map(
            (e) => ({
              id: e.id,
              userId: e.userId,
              name: e.user?.name ?? e.userId,
              email: e.user?.email ?? '',
            })
          )
        )
      } catch {
        /* optional */
      }
    })()
  }, [canManage])

  const filteredEmployees = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    if (!q) return employees.slice(0, 20)
    return employees
      .filter(
        (e) =>
          e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)
      )
      .slice(0, 20)
  }, [employees, userSearch])

  function toggleRole(role: string) {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }

  function toggleDept(id: string) {
    setDepartmentIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    )
  }

  function toggleUser(userId: string) {
    setUserIds((prev) =>
      prev.includes(userId) ? prev.filter((u) => u !== userId) : [...prev, userId]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    setSaving(true)
    try {
      if (file) {
        const form = new FormData()
        form.set('title', title)
        form.set('description', description)
        form.set('contentText', contentText)
        form.set('visibility', visibility)
        form.set('roles', JSON.stringify(roles))
        form.set('userIds', JSON.stringify(userIds))
        form.set('departmentIds', JSON.stringify(departmentIds))
        form.set('file', file)
        const res = await fetch('/api/ai/knowledge', {
          method: 'POST',
          body: form,
          credentials: 'include',
        })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.error || 'Upload failed')
      } else {
        await apiPost('/api/ai/knowledge', {
          title,
          description,
          contentText,
          visibility,
          roles,
          userIds,
          departmentIds,
        })
      }
      toast.success('Document saved')
      setShowForm(false)
      setTitle('')
      setDescription('')
      setContentText('')
      setVisibility('GENERAL')
      setRoles([])
      setUserIds([])
      setDepartmentIds([])
      setFile(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this document?')) return
    try {
      await apiDelete(`/api/ai/knowledge/${id}`)
      toast.success('Deleted')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  if (authLoading) {
    return (
      <AuthenticatedLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AuthenticatedLayout>
    )
  }

  if (!canManage) {
    return (
      <AuthenticatedLayout>
        <div className="mx-auto max-w-lg px-6 py-16 text-center">
          <h1 className="text-lg font-semibold">Access denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Only SUPER_ADMIN and EXECUTIVE_ASSISTANT can manage knowledge documents.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/training">Back to mediend AI</Link>
          </Button>
        </div>
      </AuthenticatedLayout>
    )
  }

  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-4xl px-6 py-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon">
              <Link href="/training">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Knowledge documents</h1>
              <p className="text-xs text-muted-foreground">
                Upload docs for mediend AI. Set audience by role, user, or department.
              </p>
            </div>
          </div>
          <Button onClick={() => setShowForm((v) => !v)} size="sm">
            <Plus className="size-4 mr-1" />
            {showForm ? 'Cancel' : 'Add document'}
          </Button>
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border bg-card p-5 space-y-4"
          >
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="HR leave policy"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="content">Paste text content</Label>
              <Textarea
                id="content"
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                rows={8}
                placeholder="Paste policy / guide text here…"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="file">Or upload file (.txt, .md, .pdf, .docx)</Label>
              <Input
                id="file"
                type="file"
                accept=".txt,.md,.markdown,.pdf,.docx,text/plain,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="grid gap-2">
              <Label>Visibility</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={visibility === 'GENERAL' ? 'default' : 'outline'}
                  onClick={() => setVisibility('GENERAL')}
                >
                  General (everyone)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={visibility === 'RESTRICTED' ? 'default' : 'outline'}
                  onClick={() => setVisibility('RESTRICTED')}
                >
                  Restricted
                </Button>
              </div>
            </div>

            {visibility === 'RESTRICTED' && (
              <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                <div>
                  <Label className="mb-2 block">Roles</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {ROLE_OPTIONS.map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleRole(role)}
                        className={`rounded-full px-2.5 py-1 text-xs border ${
                          roles.includes(role)
                            ? 'bg-violet-600 text-white border-violet-600'
                            : 'bg-background'
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Departments</Label>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                    {departments.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleDept(d.id)}
                        className={`rounded-full px-2.5 py-1 text-xs border ${
                          departmentIds.includes(d.id)
                            ? 'bg-violet-600 text-white border-violet-600'
                            : 'bg-background'
                        }`}
                      >
                        {d.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Specific users</Label>
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search employees…"
                    className="mb-2"
                  />
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                    {filteredEmployees.map((e) => (
                      <button
                        key={e.userId}
                        type="button"
                        onClick={() => toggleUser(e.userId)}
                        className={`rounded-full px-2.5 py-1 text-xs border ${
                          userIds.includes(e.userId)
                            ? 'bg-violet-600 text-white border-violet-600'
                            : 'bg-background'
                        }`}
                      >
                        {e.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Upload className="size-4 mr-2" />
              )}
              Save document
            </Button>
          </form>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : docs.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No knowledge documents yet. Add HR rules, platform guides, or role-restricted docs.
          </div>
        ) : (
          <div className="space-y-3">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="rounded-xl border bg-card p-4 flex items-start gap-3"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
                  <FileText className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-sm truncate">{doc.title}</h3>
                    <Badge variant="secondary" className="text-[10px]">
                      {doc.visibility}
                    </Badge>
                    {!doc.isActive && (
                      <Badge variant="outline" className="text-[10px]">
                        inactive
                      </Badge>
                    )}
                  </div>
                  {doc.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {doc.description}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {doc._count.chunks} chunks · by {doc.uploadedBy.name} ·{' '}
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                  {(doc.roles.length > 0 ||
                    doc.users.length > 0 ||
                    doc.departments.length > 0) && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {doc.roles.map((r) => (
                        <Badge key={r.role} variant="outline" className="text-[10px]">
                          {r.role}
                        </Badge>
                      ))}
                      {doc.departments.map((d) => (
                        <Badge
                          key={d.department.id}
                          variant="outline"
                          className="text-[10px]"
                        >
                          {d.department.name}
                        </Badge>
                      ))}
                      {doc.users.map((u) => (
                        <Badge key={u.user.id} variant="outline" className="text-[10px]">
                          {u.user.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive shrink-0"
                  onClick={() => handleDelete(doc.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  )
}
