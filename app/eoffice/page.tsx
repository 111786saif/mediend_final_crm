'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, FolderTree, Network, ShieldCheck, Workflow } from 'lucide-react'

type Overview = {
  counts: { documents: number; folders: number; workflows: number; activeProviders: number; activeConnectors: number }
  recentDocuments: Array<{ id: number; documentNumber: string; title: string; documentType: string; status: string; updatedAt: string; folderName: string | null }>
}

const cards = [
  { key: 'documents', label: 'Documents', icon: FileText, tone: 'text-sky-600' },
  { key: 'folders', label: 'Folders', icon: FolderTree, tone: 'text-violet-600' },
  { key: 'workflows', label: 'Active workflows', icon: Workflow, tone: 'text-emerald-600' },
  { key: 'activeProviders', label: 'Storage providers', icon: ShieldCheck, tone: 'text-amber-600' },
  { key: 'activeConnectors', label: 'Connected services', icon: Network, tone: 'text-rose-600' },
] as const

export default function EOfficePage() {
  const { data, isLoading } = useQuery<Overview>({ queryKey: ['v2-eoffice-overview'], queryFn: () => apiGet('/api/v2/eoffice/overview') })
  return <main className="mx-auto max-w-7xl space-y-6 p-6">
    <div><h1 className="text-3xl font-bold tracking-tight">eOffice</h1><p className="mt-1 text-muted-foreground">Document control, approvals, secure storage, and connected services.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{cards.map(({ key, label, icon: Icon, tone }) => <Card key={key}><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{isLoading ? '—' : data?.counts[key] ?? 0}</p></div><Icon className={`h-7 w-7 ${tone}`} /></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle>Recent documents</CardTitle><CardDescription>Documents and approvals will appear here once the eOffice workspace is in use.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b text-left text-muted-foreground"><tr><th className="p-3">Document</th><th className="p-3">Type</th><th className="p-3">Folder</th><th className="p-3">Status</th><th className="p-3">Updated</th></tr></thead><tbody>{data?.recentDocuments.map((document) => <tr key={document.id} className="border-b last:border-0"><td className="p-3"><p className="font-medium">{document.title}</p><p className="text-xs text-muted-foreground">{document.documentNumber}</p></td><td className="p-3">{document.documentType}</td><td className="p-3">{document.folderName ?? 'Unfiled'}</td><td className="p-3"><Badge variant="secondary">{document.status.replace('_', ' ')}</Badge></td><td className="p-3">{new Date(document.updatedAt).toLocaleDateString('en-IN')}</td></tr>)}{!isLoading && !data?.recentDocuments.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No documents yet.</td></tr>}</tbody></table></div></CardContent></Card>
  </main>
}
