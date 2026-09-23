'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiPost } from '@/lib/api-client'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

type ImportRow = Record<string, unknown>
const required = 'Appointment ID'

export default function PlImportPage() {
  const [rows, setRows] = useState<ImportRow[]>([])
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ imported: number; unmatched: string[]; invalid: string[] } | null>(null)
  const readFile = async (file: File) => {
    try {
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const parsed = XLSX.utils.sheet_to_json<ImportRow>(sheet, { defval: '' }).filter((row) => Object.values(row).some((value) => String(value).trim() !== ''))
      if (!parsed.length) throw new Error('The selected file has no data rows')
      if (!(required in parsed[0])) throw new Error('The sample format requires an Appointment ID column')
      setRows(parsed.slice(0, 1000)); setFileName(file.name); setResult(null)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to read file') }
  }
  const importRows = async () => {
    setLoading(true)
    try { setResult(await apiPost('/api/pl/import', { rows })); toast.success('P&L import completed') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Import failed') }
    finally { setLoading(false) }
  }
  return <ProtectedRoute resource="insurance_pl.pl_ledger"><main className="space-y-6 p-4 md:p-6 max-w-5xl">
    <div><h1 className="text-2xl font-bold">P&L Excel Import</h1><p className="text-muted-foreground mt-1">Upload the completed sample file. Rows match existing cases using Appointment ID / Lead Ref.</p></div>
    <Card><CardHeader><CardTitle>1. Download the sample</CardTitle><CardDescription>Use this exact column layout. Do not change the Appointment ID header.</CardDescription></CardHeader><CardContent><Button asChild><a href="/api/pl/import/sample"><Download className="mr-2 h-4 w-4" />Download sample Excel file</a></Button></CardContent></Card>
    <Card><CardHeader><CardTitle>2. Upload and review</CardTitle><CardDescription>Up to 1,000 rows. The import updates existing leads only; unmatched rows are reported and skipped.</CardDescription></CardHeader><CardContent className="space-y-4"><Input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file) }} />
      {rows.length > 0 && <div className="rounded-md border p-4 flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{fileName}</p><p className="text-sm text-muted-foreground">{rows.length} rows ready. Preview: {String(rows[0][required] || 'missing Appointment ID')}</p></div><Button onClick={() => void importRows()} disabled={loading}>{loading ? 'Importing…' : <><Upload className="mr-2 h-4 w-4" />Import {rows.length} rows</>}</Button></div>}
    </CardContent></Card>
    {result && <Card><CardHeader><CardTitle>Import result</CardTitle></CardHeader><CardContent className="space-y-2"><p><b>{result.imported}</b> rows imported.</p><p><b>{result.unmatched.length}</b> Appointment IDs were not found.</p><p><b>{result.invalid.length}</b> rows were invalid.</p>{result.unmatched.length > 0 && <p className="text-sm text-muted-foreground break-words">Unmatched: {result.unmatched.slice(0, 30).join(', ')}</p>}{result.invalid.map((message) => <p key={message} className="text-sm text-destructive">{message}</p>)}</CardContent></Card>}
    <div className="flex gap-2 text-sm text-muted-foreground"><FileSpreadsheet className="h-4 w-4 shrink-0" />Dates and numeric fields are validated before saving. Existing patient cases are never created by this importer.</div>
  </main></ProtectedRoute>
}
