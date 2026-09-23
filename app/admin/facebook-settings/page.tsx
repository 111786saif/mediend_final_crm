'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiGet, apiPatch } from '@/lib/api-client'

export default function FacebookSettingsPage() {
  const { data, refetch } = useQuery({ queryKey: ['facebook-settings'], queryFn: () => apiGet<any>('/api/admin/facebook-settings') })
  const [form, setForm] = useState<any>(null); const value = form ?? data
  if (!value) return <main className="p-6">Loading Facebook settings…</main>
  const update = (key: string, next: string) => setForm({ ...value, [key]: next })
  return <main className="mx-auto max-w-3xl space-y-5 p-6"><Card><CardHeader><CardTitle>Facebook Lead Ads</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Configure your Meta developer app and Pages. Add one Page configuration for each Facebook Page; each Page can map multiple campaigns to CRM campaigns.</p><div><Label>Meta App ID</Label><Input value={value.appId} onChange={(e) => update('appId', e.target.value)} /></div><div><Label>Meta App Secret</Label><Input type="password" value={value.appSecret} onChange={(e) => update('appSecret', e.target.value)} /></div><Button onClick={async () => { await apiPatch('/api/admin/facebook-settings', value); setForm(null); refetch() }}>Save Facebook settings</Button></CardContent></Card></main>
}
