'use client'

import { useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Download, FileUp, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { apiPost } from '@/lib/api-client'
import {
  CRM_LEAD_STATUS_OPTIONS,
  CRM_MODE_OF_PAYMENT_OPTIONS,
} from '@/lib/lead-status-options'
import {
  buildManualMySQLLeadSampleCsv,
  createEmptyManualMySQLLeadValues,
  MANUAL_MYSQL_LEAD_FIELDS,
  MANUAL_MYSQL_LEAD_SECTION_ORDER,
} from '@/lib/manual-mysql-lead-import'
import {
  formatDateTimeLocalValue,
  getLeadDateInputMaxValue,
  isLeadDateAfterToday,
  LEAD_DATE_FUTURE_ERROR,
} from '@/lib/lead-date-validation'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

type ManualCreateResult = {
  processedCount: number
  duplicateCount: number
  failedCount: number
  skippedCount: number
  results: Array<{
    rowNumber: number
    incomingLeadId?: string
    leadId?: string
    leadRef?: string
    assignedBdName?: string | null
    status: 'processed' | 'already_processed' | 'duplicate' | 'failed' | 'skipped'
    error?: string
  }>
}

type ManualCreateMasters = {
  sources: Array<{
    id: string
    name: string
    isActive: boolean
  }>
  leadSources: Array<{
    id: string
    name: string
    cpl: number | null
    sourceId: string
    isActive: boolean
    source: {
      id: string
      name: string
      isActive: boolean
    }
  }>
  treatmentCategories: Array<{
    id: string
    name: string
    isActive: boolean
  }>
  treatments: Array<{
    id: string
    name: string
    category: string
    isActive: boolean
  }>
}

const HIDDEN_FORM_FIELD_KEYS = new Set([
  'id',
  'month',
  'Lead_Date',
  'LeadEntryDate',
  'create_date',
  'BDM',
  'TL',
  'ad_id',
  'form_id',
  'create_by',
  'update_by',
  'update_date',
  'Follow_up_Date',
  'Surgery_Date',
  'PaymentDetails',
  'aes',
  'OPD_Hospital',
  'OPD_DrName',
  'OPD_ContactNo',
  'OPD_Charges',
  'OPD_ScheduleDate',
  'OPD_Meeting',
  'IPD_AdmisisonDate',
  'IPD_Hospital',
  'IPD_DrName',
  'IPD_ContactNo',
  'IPD_TotalPayment',
  'IPD_Details',
  'Attendant',
  'AttendantName',
  'AttendantContactNo',
])

const HIDDEN_FORM_SECTIONS = new Set(['Communication', 'Tracking'])

function convertDateTimeLocalToMysql(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const normalized = trimmed.replace('T', ' ')
  return normalized.length === 16 ? `${normalized}:00` : normalized
}

function getMonthNameFromDateTimeLocal(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date)
}

function mergeCsvTexts(csvChunks: string[]) {
  const normalizedChunks = csvChunks
    .map((chunk) => chunk.replace(/^\uFEFF/, '').trim())
    .filter((chunk) => chunk.length > 0)

  if (normalizedChunks.length === 0) return ''

  let header: string | null = null
  const dataLines: string[] = []

  for (const chunk of normalizedChunks) {
    const lines = chunk
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter((line) => line.trim().length > 0)

    if (lines.length === 0) continue

    const [chunkHeader, ...chunkRows] = lines
    if (!header) {
      header = chunkHeader
      dataLines.push(...chunkRows)
      continue
    }

    if (chunkHeader === header) {
      dataLines.push(...chunkRows)
    } else {
      dataLines.push(...lines)
    }
  }

  if (!header) return ''
  return [header, ...dataLines].join('\n')
}

export function IncomingLeadsManualCreateDialog({
  open,
  onOpenChange,
  masters,
  onImported,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  masters?: ManualCreateMasters
  onImported: () => Promise<void> | void
}) {
  const [activeTab, setActiveTab] = useState<'form' | 'csv'>('form')
  const [formValues, setFormValues] = useState<Record<string, string>>(
    createEmptyManualMySQLLeadValues
  )
  const [manualLeadDate, setManualLeadDate] = useState(() =>
    formatDateTimeLocalValue(new Date())
  )
  const [csvText, setCsvText] = useState('')
  const [uploadedCsvFileNames, setUploadedCsvFileNames] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const groupedFields = useMemo(
    () =>
      MANUAL_MYSQL_LEAD_SECTION_ORDER.map((section) => ({
        section,
        fields: MANUAL_MYSQL_LEAD_FIELDS.filter(
          (field) => field.section === section && !HIDDEN_FORM_FIELD_KEYS.has(field.key)
        ),
      })).filter(
        (group) =>
          group.fields.length > 0 && !HIDDEN_FORM_SECTIONS.has(group.section)
      ),
    []
  )

  const categoryOptions = useMemo(
    () => (masters?.treatmentCategories ?? []).filter((item) => item.isActive !== false),
    [masters?.treatmentCategories]
  )

  const treatmentOptions = useMemo(() => {
    const selectedCategory = (formValues.Category ?? '').trim()
    const base = (masters?.treatments ?? []).filter((item) => item.isActive !== false)
    if (!selectedCategory) return base
    return base.filter((item) => item.category === selectedCategory)
  }, [formValues.Category, masters?.treatments])

  const sourceOptions = useMemo(
    () => (masters?.sources ?? []).filter((item) => item.isActive !== false),
    [masters?.sources]
  )

  const leadSourceOptions = useMemo(() => {
    const selectedSource = (formValues.Source ?? '').trim()
    const base = (masters?.leadSources ?? []).filter((item) => item.isActive !== false)
    if (!selectedSource) return base
    return base.filter((item) => item.source.name === selectedSource)
  }, [formValues.Source, masters?.leadSources])

  const resetState = () => {
    setActiveTab('form')
    setFormValues(createEmptyManualMySQLLeadValues())
    setManualLeadDate(formatDateTimeLocalValue(new Date()))
    setCsvText('')
    setUploadedCsvFileNames([])
  }

  const mutation = useMutation({
    mutationFn: (payload: { mode: 'form'; row: Record<string, string> } | { mode: 'csv'; csvText: string }) =>
      apiPost<ManualCreateResult>('/api/crm/incoming-leads/manual-create', payload),
    onSuccess: async (result) => {
      const processedLabel = `${result.processedCount} processed`
      const failedLabel = result.failedCount > 0 ? `, ${result.failedCount} failed` : ''
      const skippedLabel = result.skippedCount > 0 ? `, ${result.skippedCount} skipped` : ''
      toast.success(`Manual lead import completed: ${processedLabel}${failedLabel}${skippedLabel}`)
      resetState()
      onOpenChange(false)
      await onImported()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to import manual leads')
    },
  })

  const handleDownloadSample = () => {
    const csv = buildManualMySQLLeadSampleCsv()
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'manual-mysql-lead-sample.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleCsvFileSelect = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return
    const selectedFiles = Array.from(files)
    const texts = await Promise.all(selectedFiles.map((file) => file.text()))
    setUploadedCsvFileNames(selectedFiles.map((file) => file.name))
    setCsvText((current) => mergeCsvTexts([...texts, current]))
  }

  const handleFieldChange = (key: string, value: string) => {
    setFormValues((current) => {
      const next = {
        ...current,
        [key]: value,
      }

      if (key === 'Category' && current.Category !== value) {
        next.Treatment = ''
      }

      if (key === 'Source' && current.Source !== value) {
        next.Lead_Source = ''
      }

      return next
    })
  }

  const submitForm = () => {
    const parsedLeadDate = new Date(manualLeadDate)
    if (Number.isNaN(parsedLeadDate.getTime())) {
      toast.error('Lead date is invalid')
      return
    }

    if (isLeadDateAfterToday(parsedLeadDate)) {
      toast.error(LEAD_DATE_FUTURE_ERROR)
      return
    }

    const mysqlDateTime = convertDateTimeLocalToMysql(manualLeadDate)
    mutation.mutate({
      mode: 'form',
      row: {
        ...formValues,
        id: '',
        month: getMonthNameFromDateTimeLocal(manualLeadDate),
        Lead_Date: '',
        LeadEntryDate: mysqlDateTime,
        create_date: mysqlDateTime,
      },
    })
  }

  const submitCsv = () => {
    mutation.mutate({
      mode: 'csv',
      csvText,
    })
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!mutation.isPending && !nextOpen) {
          resetState()
        }
        onOpenChange(nextOpen)
      }}
    >
      <SheetContent
        side="right"
        className="flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden p-0 sm:max-w-5xl"
      >
        <SheetHeader className="shrink-0 border-b p-4 text-left">
          <SheetTitle>Manual Lead Creation</SheetTitle>
          <SheetDescription>
            Create incoming leads manually using the same MySQL-style columns used by the current sync flow.
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'form' | 'csv')}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="shrink-0 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <TabsList>
                <TabsTrigger value="form">Form</TabsTrigger>
                <TabsTrigger value="csv">CSV Upload</TabsTrigger>
              </TabsList>
              <Button type="button" variant="outline" size="sm" onClick={handleDownloadSample}>
                <Download className="mr-2 h-4 w-4" />
                Download sample CSV
              </Button>
            </div>
          </div>

          <TabsContent
            value="form"
            className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 data-[state=inactive]:hidden"
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-4 pb-6">
              <div className="space-y-6">
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  <code>Patient_Name</code>, <code>Patient_Number</code>, and <code>campaign_id</code> are
                  required. Lead identity is auto-generated. The selected date fills <code>LeadEntryDate</code>,{' '}
                  <code>create_date</code>, and derived <code>month</code>. It does not backfill the MySQL{' '}
                  <code>Lead_Date</code> assignment timestamp. Assignment follows the same campaign/circle/category
                  logic as MySQL intake, so{' '}
                  <code>campaign_id</code>, <code>Circle</code>, and <code>Category</code> are the most
                  important routing inputs.
                </div>

                <div className="rounded-xl border p-4">
                  <h3 className="text-sm font-semibold">Identity</h3>
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <Label className="mb-2 block">Lead date *</Label>
                      <Input
                        type="datetime-local"
                        value={manualLeadDate}
                        onChange={(event) => setManualLeadDate(event.target.value)}
                        max={getLeadDateInputMaxValue()}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        This fills lead entry date, create date, and month. Only today or older dates are allowed.
                      </p>
                    </div>
                  </div>
                </div>

                {groupedFields.map((group) => (
                  <div key={group.section} className="rounded-xl border p-4">
                    <h3 className="text-sm font-semibold">{group.section}</h3>
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {group.fields.map((field) => (
                        <div key={field.key} className={field.multiline ? 'md:col-span-2 xl:col-span-3' : ''}>
                          <Label className="mb-2 block">
                            {field.label}
                            {field.required ? ' *' : ''}
                          </Label>
                          {field.key === 'Category' ? (
                            <Select
                              value={formValues[field.key] || '__empty__'}
                              onValueChange={(value) =>
                                handleFieldChange(field.key, value === '__empty__' ? '' : value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__empty__">Blank</SelectItem>
                                {categoryOptions.map((option) => (
                                  <SelectItem key={option.id} value={option.name}>
                                    {option.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : field.key === 'Treatment' ? (
                            <Select
                              value={formValues[field.key] || '__empty__'}
                              onValueChange={(value) =>
                                handleFieldChange(field.key, value === '__empty__' ? '' : value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select treatment" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__empty__">Blank</SelectItem>
                                {treatmentOptions.map((option) => (
                                  <SelectItem key={option.id} value={option.name}>
                                    {option.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : field.key === 'Status' ? (
                            <Select
                              value={formValues[field.key] || '__empty__'}
                              onValueChange={(value) =>
                                handleFieldChange(field.key, value === '__empty__' ? '' : value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__empty__">Blank</SelectItem>
                                {CRM_LEAD_STATUS_OPTIONS.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : field.key === 'SubStatus' ? (
                            <Input
                              value={formValues[field.key] || ''}
                              onChange={(event) =>
                                handleFieldChange(field.key, event.target.value.slice(0, 25))
                              }
                              placeholder="Enter sub status"
                              maxLength={25}
                            />
                          ) : field.key === 'MOP' ? (
                            <Select
                              value={formValues[field.key] || '__empty__'}
                              onValueChange={(value) =>
                                handleFieldChange(field.key, value === '__empty__' ? '' : value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select mode of payment" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__empty__">Blank</SelectItem>
                                {CRM_MODE_OF_PAYMENT_OPTIONS.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : field.key === 'Source' ? (
                            <Select
                              value={formValues[field.key] || '__empty__'}
                              onValueChange={(value) =>
                                handleFieldChange(field.key, value === '__empty__' ? '' : value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select source" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__empty__">Blank</SelectItem>
                                {sourceOptions.map((option) => (
                                  <SelectItem key={option.id} value={option.name}>
                                    {option.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : field.key === 'Lead_Source' ? (
                            <Select
                              value={formValues[field.key] || '__empty__'}
                              onValueChange={(value) =>
                                handleFieldChange(field.key, value === '__empty__' ? '' : value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select lead source" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__empty__">Blank</SelectItem>
                                {leadSourceOptions.map((option) => (
                                  <SelectItem key={option.id} value={option.name}>
                                    {option.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : field.type === 'boolean' ? (
                            <Select
                              value={formValues[field.key] || '__empty__'}
                              onValueChange={(value) =>
                                handleFieldChange(field.key, value === '__empty__' ? '' : value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select value" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__empty__">Blank</SelectItem>
                                <SelectItem value="true">true</SelectItem>
                                <SelectItem value="false">false</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : field.multiline ? (
                            <Textarea
                              value={formValues[field.key] ?? ''}
                              onChange={(event) => handleFieldChange(field.key, event.target.value)}
                              placeholder={field.sample || field.helperText || field.label}
                              rows={3}
                            />
                          ) : (
                            <Input
                              type={field.type === 'number' ? 'number' : 'text'}
                              value={formValues[field.key] ?? ''}
                              onChange={(event) => handleFieldChange(field.key, event.target.value)}
                              placeholder={field.sample || field.helperText || field.label}
                            />
                          )}
                          {field.helperText ? (
                            <p className="mt-1 text-xs text-muted-foreground">{field.helperText}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex shrink-0 flex-col gap-2 border-t bg-background/95 px-0 pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button type="button" onClick={submitForm} disabled={mutation.isPending || !manualLeadDate.trim()}>
                {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Create lead
              </Button>
            </div>
          </TabsContent>

          <TabsContent
            value="csv"
            className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 data-[state=inactive]:hidden"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-4 pb-6">
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Upload or paste a CSV using the simplified manual-import headers from the sample
                file. Failed auto-assignment rows will stay in Incoming Leads for manual
                reassignment later.
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <FileUp className="mr-2 h-4 w-4" />
                  Upload CSVs
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    void handleCsvFileSelect(event.target.files)
                    event.currentTarget.value = ''
                  }}
                />
              </div>

              {uploadedCsvFileNames.length > 0 ? (
                <div className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
                  Added {uploadedCsvFileNames.length} file
                  {uploadedCsvFileNames.length === 1 ? '' : 's'}: {uploadedCsvFileNames.join(', ')}
                </div>
              ) : null}

              <div>
                <Label className="mb-2 block">CSV content</Label>
                <Textarea
                  value={csvText}
                  onChange={(event) => setCsvText(event.target.value)}
                  placeholder="Paste CSV content here or upload one or more .csv files"
                  rows={18}
                />
              </div>
            </div>

            <div className="mt-4 flex shrink-0 flex-col gap-2 border-t bg-background/95 px-0 pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button type="button" onClick={submitCsv} disabled={mutation.isPending || csvText.trim().length === 0}>
                {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                Import CSV
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
