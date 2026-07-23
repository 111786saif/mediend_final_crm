'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { MasterFileField } from '@/components/master-data/master-file-field'
import {
  HospitalMasterForm,
  type HospitalFormState,
} from '@/components/master-data/hospital-master-form'
import { emptyHospitalDetails, parseHospitalDetails } from '@/lib/masters/hospital'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { apiGet, apiPost, apiPatch } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { useFileUpload } from '@/hooks/use-file-upload'
import { hasPermission } from '@/lib/rbac'
import { toast } from 'sonner'
import { ExternalLink, Eye, Loader2, Pencil, Plus, Database, Trash2, Upload } from 'lucide-react'
import type { MasterItem, MasterType } from '@/components/ui/master-combobox'
import type { DoctorDocument } from '@/lib/masters/schemas'
import Link from 'next/link'

type TabKey =
  | 'hospitals'
  | 'doctors'
  | 'tpas'
  | 'anesthesia'
  | 'insurance'
  | 'treatments'
  | 'treatment-categories'

const TAB_API: Record<TabKey, string> = {
  hospitals: '/api/masters/hospitals',
  doctors: '/api/masters/doctors',
  tpas: '/api/masters/tpas',
  anesthesia: '/api/masters/anesthesia',
  insurance: '/api/masters/insurance',
  treatments: '/api/masters/treatments',
  'treatment-categories': '/api/masters/treatment-categories',
}

const TAB_LABEL: Record<TabKey, string> = {
  hospitals: 'Hospital',
  doctors: 'Doctor',
  tpas: 'TPA',
  insurance: 'Insurance Company',
  anesthesia: 'Anesthesia Type',
  treatments: 'Treatment',
  'treatment-categories': 'Treatment Category',
}

const API_BASE: Record<MasterType, string> = {
  hospitals: '/api/masters/hospitals',
  doctors: '/api/masters/doctors',
  tpas: '/api/masters/tpas',
  anesthesia: '/api/masters/anesthesia',
  insurance: '/api/masters/insurance',
  treatments: '/api/masters/treatments',
}

const DOC_TYPES: { value: DoctorDocument['type']; label: string }[] = [
  { value: 'DEGREE', label: 'Degree' },
  { value: 'DOCUMENTATION', label: 'Documentation' },
  { value: 'MOU', label: 'MOU' },
  { value: 'OTHER', label: 'Other' },
]

function useMasterList(tab: TabKey, search: string, enabled: boolean) {
  const base = TAB_API[tab]
  const q = search.trim()
  return useQuery({
    queryKey: ['masters-admin', tab, q],
    enabled,
    queryFn: () =>
      apiGet<{ items: MasterItem[] }>(
        `${base}?search=${encodeURIComponent(q)}&includeInactive=true`,
      ),
  })
}

function emptyDoctorForm() {
  return {
    name: '',
    category: '',
    treatment: '',
    age: '',
    sex: '',
    phoneNumber: '',
    aadhaarNumber: '',
    aadhaarCardUrl: '',
    panNumber: '',
    panCardUrl: '',
    agreementUrl: '',
    experienceYears: '',
    experienceNotes: '',
    feeStructure: '',
    ratingAverage: '',
    ratingCount: '',
    documents: [] as DoctorDocument[],
    isActive: true,
  }
}

function emptyHospitalForm(): HospitalFormState {
  return {
    name: '',
    address: '',
    googleMapLink: '',
    mouAgreementUrl: '',
    hospitalShare: '',
    mediendShare: '',
    details: emptyHospitalDetails(),
    insuranceIds: [],
    isActive: true,
  }
}

export default function MasterDataPage() {
  const { user, isLoading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<TabKey>('hospitals')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MasterItem | null>(null)

  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formAtsNewDelhi, setFormAtsNewDelhi] = useState('')
  const [formAtsMumbai, setFormAtsMumbai] = useState('')
  const [formAtsPune, setFormAtsPune] = useState('')
  const [formAtsHyderabad, setFormAtsHyderabad] = useState('')
  const [formAtsBangalore, setFormAtsBangalore] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)
  const [doctorForm, setDoctorForm] = useState(emptyDoctorForm())
  const [hospitalForm, setHospitalForm] = useState<HospitalFormState>(emptyHospitalForm)
  const [docType, setDocType] = useState<DoctorDocument['type']>('DEGREE')

  const { uploadFile, uploading: docUploading } = useFileUpload({
    folder: 'masters/doctors/documents',
    endpoint: '/api/masters/upload',
  })

  const canAccess = !!(user && hasPermission(user, 'masters:read'))
  const canWrite = !!(user && hasPermission(user, 'masters:write'))

  const { data, isLoading, refetch } = useMasterList(tab, search, canAccess && !authLoading)

  const { data: insuranceData } = useQuery({
    queryKey: ['masters-admin', 'insurance', 'picker'],
    enabled: canAccess && !authLoading && (dialogOpen && tab === 'hospitals'),
    queryFn: () =>
      apiGet<{ items: MasterItem[] }>('/api/masters/insurance?includeInactive=true'),
  })

  const { data: treatmentMasterData } = useQuery({
    queryKey: ['masters-admin', 'treatments', 'picker'],
    enabled: canAccess && !authLoading && dialogOpen && tab === 'doctors',
    queryFn: () =>
      apiGet<{ items: MasterItem[] }>('/api/masters/treatments?includeInactive=true'),
  })

  const { data: treatmentCategoryData } = useQuery({
    queryKey: ['masters-admin', 'treatment-categories', 'picker'],
    enabled:
      canAccess &&
      !authLoading &&
      dialogOpen &&
      (tab === 'doctors' || tab === 'treatments'),
    queryFn: () =>
      apiGet<{ items: MasterItem[] }>('/api/masters/treatment-categories?includeInactive=true'),
  })

  const treatmentCategoryOptions = useMemo(() => {
    const categories = new Set<string>()
    for (const item of treatmentCategoryData?.items ?? []) {
      const name = item.name?.trim()
      if (name) categories.add(name)
    }
    const current =
      tab === 'doctors' ? doctorForm.category.trim() : formCategory.trim()
    if (current) categories.add(current)
    return [...categories].sort((a, b) => a.localeCompare(b))
  }, [treatmentCategoryData, doctorForm.category, formCategory, tab])

  const treatmentOptions = useMemo(() => {
    const selectedCategory = doctorForm.category.trim()
    const items = (treatmentMasterData?.items ?? []).filter((item) => {
      if (!selectedCategory) return true
      return item.category?.trim() === selectedCategory
    })
    const names = new Set<string>()
    for (const item of items) {
      const name = item.name.trim()
      if (name) names.add(name)
    }
    const current = doctorForm.treatment.trim()
    if (current) names.add(current)
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [treatmentMasterData, doctorForm.category, doctorForm.treatment])

  const insuranceOptions = insuranceData?.items ?? []
  const items = data?.items ?? []

  const resetCommon = () => {
    setFormName('')
    setFormCategory('')
    setFormAtsNewDelhi('')
    setFormAtsMumbai('')
    setFormAtsPune('')
    setFormAtsHyderabad('')
    setFormAtsBangalore('')
    setFormIsActive(true)
    setDoctorForm(emptyDoctorForm())
    setHospitalForm(emptyHospitalForm())
    setDocType('DEGREE')
  }

  const openCreate = () => {
    setEditing(null)
    resetCommon()
    setDialogOpen(true)
  }

  const openEdit = (row: MasterItem) => {
    setEditing(row)
    setFormName(row.name)
    setFormCategory(row.category || '')
    setFormAtsNewDelhi(row.atsNewDelhi?.toString() || '')
    setFormAtsMumbai(row.atsMumbai?.toString() || '')
    setFormAtsPune(row.atsPune?.toString() || '')
    setFormAtsHyderabad(row.atsHyderabad?.toString() || '')
    setFormAtsBangalore(row.atsBangalore?.toString() || '')
    setFormIsActive(row.isActive)
    setHospitalForm({
      name: row.name,
      address: row.address || '',
      googleMapLink: row.googleMapLink || '',
      mouAgreementUrl: row.mouAgreementUrl || '',
      hospitalShare: row.hospitalShare != null ? String(row.hospitalShare) : '',
      mediendShare: row.mediendShare != null ? String(row.mediendShare) : '',
      details: parseHospitalDetails(row.details),
      insuranceIds: row.insuranceIds || row.insuranceProviders?.map((p) => p.id) || [],
      isActive: row.isActive,
    })
    setDoctorForm({
      name: row.name,
      category: row.category || '',
      treatment: row.treatment || '',
      age: row.age?.toString() || '',
      sex: row.sex || '',
      phoneNumber: row.phoneNumber || '',
      aadhaarNumber: row.aadhaarNumber || '',
      aadhaarCardUrl: row.aadhaarCardUrl || '',
      panNumber: row.panNumber || '',
      panCardUrl: row.panCardUrl || '',
      agreementUrl: row.agreementUrl || '',
      experienceYears: row.experienceYears?.toString() || '',
      experienceNotes: row.experienceNotes || '',
      feeStructure: row.feeStructure || '',
      ratingAverage: row.ratingAverage?.toString() || '',
      ratingCount: row.ratingCount?.toString() || '',
      documents: (row.documents as DoctorDocument[] | null) || [],
      isActive: row.isActive,
    })
    setDialogOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const base = TAB_API[tab]
      const buildPayload = (forEdit: boolean) => {
        const status =
          forEdit || tab === 'hospitals' || tab === 'doctors' ? { isActive: formIsActive } : {}
        if (tab === 'hospitals') {
          const parseShare = (raw: string) => {
            const t = raw.trim()
            if (t === '') return null
            const n = Number(t)
            return Number.isFinite(n) ? n : null
          }
          return {
            name: formName.trim() || hospitalForm.name.trim(),
            address: hospitalForm.address.trim() || null,
            googleMapLink: hospitalForm.googleMapLink.trim() || null,
            mouAgreementUrl: hospitalForm.mouAgreementUrl.trim() || null,
            hospitalShare: parseShare(hospitalForm.hospitalShare),
            mediendShare: parseShare(hospitalForm.mediendShare),
            details: hospitalForm.details,
            insuranceIds: hospitalForm.insuranceIds,
            isActive: hospitalForm.isActive,
            ...status,
          }
        }
        if (tab === 'doctors') {
          return {
            name: doctorForm.name.trim() || formName.trim(),
            category: doctorForm.category.trim() || null,
            treatment: doctorForm.treatment.trim() || null,
            age: doctorForm.age ? Number(doctorForm.age) : null,
            sex: doctorForm.sex || null,
            phoneNumber: doctorForm.phoneNumber.trim() || null,
            aadhaarNumber: doctorForm.aadhaarNumber.trim() || null,
            aadhaarCardUrl: doctorForm.aadhaarCardUrl.trim() || null,
            panNumber: doctorForm.panNumber.trim() || null,
            panCardUrl: doctorForm.panCardUrl.trim() || null,
            agreementUrl: doctorForm.agreementUrl.trim() || null,
            experienceYears: doctorForm.experienceYears
              ? Number(doctorForm.experienceYears)
              : null,
            experienceNotes: doctorForm.experienceNotes.trim() || null,
            feeStructure: doctorForm.feeStructure.trim() || null,
            ratingAverage: doctorForm.ratingAverage
              ? Number(doctorForm.ratingAverage)
              : null,
            ratingCount: doctorForm.ratingCount ? Number(doctorForm.ratingCount) : 0,
            documents: doctorForm.documents,
            isActive: doctorForm.isActive,
          }
        }
        if (tab === 'treatments') {
          return {
            name: formName.trim(),
            category: formCategory.trim(),
            atsNewDelhi: formAtsNewDelhi ? Number(formAtsNewDelhi) : null,
            atsMumbai: formAtsMumbai ? Number(formAtsMumbai) : null,
            atsPune: formAtsPune ? Number(formAtsPune) : null,
            atsHyderabad: formAtsHyderabad ? Number(formAtsHyderabad) : null,
            atsBangalore: formAtsBangalore ? Number(formAtsBangalore) : null,
            ...status,
          }
        }
        return { name: formName.trim(), ...status }
      }
      if (editing) {
        return apiPatch<{ item: MasterItem }>(`${base}/${editing.id}`, buildPayload(true))
      }
      return apiPost<{ item: MasterItem }>(base, buildPayload(false))
    },
    onSuccess: () => {
      toast.success(editing ? 'Updated' : 'Created')
      setDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['masters-admin'] })
      queryClient.invalidateQueries({ queryKey: ['masters'] })
      void refetch()
    },
    onError: (e: Error) => toast.error(e.message || 'Save failed'),
  })

  if (authLoading) {
    return (
      <AuthenticatedLayout>
        <div className="p-6">Loading…</div>
      </AuthenticatedLayout>
    )
  }

  if (!user || !canAccess) {
    return (
      <AuthenticatedLayout>
        <div className="p-6">
          <p className="text-muted-foreground">You don&apos;t have access to Master Data.</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/home">Back</Link>
          </Button>
        </div>
      </AuthenticatedLayout>
    )
  }

  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Database className="size-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Master Data</h1>
              <p className="text-muted-foreground text-sm">
                Hospitals, doctors, TPAs, insurance, anesthesia, treatments, and treatment categories
                for forms and dropdowns.
              </p>
            </div>
          </div>
          {canWrite && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 size-4" />
              Add {TAB_LABEL[tab]}
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Search current tab…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
            <TabsTrigger value="hospitals">Hospitals</TabsTrigger>
            <TabsTrigger value="doctors">Doctors</TabsTrigger>
            <TabsTrigger value="tpas">TPAs</TabsTrigger>
            <TabsTrigger value="insurance">Insurance</TabsTrigger>
            <TabsTrigger value="anesthesia">Anesthesia</TabsTrigger>
            <TabsTrigger value="treatments">Treatments</TabsTrigger>
            <TabsTrigger value="treatment-categories">Treatment Category</TabsTrigger>
          </TabsList>

          <div className="mt-4 overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  {tab === 'hospitals' && (
                    <>
                      <TableHead>Address</TableHead>
                      <TableHead className="w-[100px]">Hosp. %</TableHead>
                      <TableHead className="w-[100px]">Med. %</TableHead>
                      <TableHead>Insurance</TableHead>
                      <TableHead className="w-[80px]">MOU</TableHead>
                      <TableHead className="w-[100px]">Map</TableHead>
                    </>
                  )}
                  {tab === 'doctors' && (
                    <>
                      <TableHead>Category</TableHead>
                      <TableHead>Treatment</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Rating</TableHead>
                    </>
                  )}
                  {tab === 'treatments' && (
                    <>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Delhi</TableHead>
                      <TableHead className="text-right">Mumbai</TableHead>
                      <TableHead className="text-right">Pune</TableHead>
                      <TableHead className="text-right">Hyderabad</TableHead>
                      <TableHead className="text-right">Bangalore</TableHead>
                    </>
                  )}
                  <TableHead className="w-[100px]">Status</TableHead>
                  {(canWrite || tab === 'hospitals') && (
                    <TableHead className="w-[180px]">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={12}>Loading…</TableCell>
                  </TableRow>
                )}
                {!isLoading && items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12} className="text-muted-foreground">
                      No rows. {canWrite ? 'Add one or adjust search.' : ''}
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading &&
                  items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      {tab === 'hospitals' && (
                        <>
                          <TableCell className="max-w-md truncate text-sm text-muted-foreground">
                            {row.address || '—'}
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {row.hospitalShare != null ? `${row.hospitalShare}%` : '—'}
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {row.mediendShare != null ? `${row.mediendShare}%` : '—'}
                          </TableCell>
                          <TableCell className="max-w-[220px] text-sm text-muted-foreground">
                            {row.insuranceProviders?.length
                              ? row.insuranceProviders.map((p) => p.name).join(', ')
                              : '—'}
                          </TableCell>
                          <TableCell>
                            {row.mouAgreementUrl ? (
                              <a
                                href={row.mouAgreementUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-primary"
                              >
                                <ExternalLink className="size-3" />
                                View
                              </a>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell>
                            {row.googleMapLink ? (
                              <a
                                href={row.googleMapLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-primary"
                              >
                                <ExternalLink className="size-3" />
                                Open
                              </a>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                        </>
                      )}
                      {tab === 'doctors' && (
                        <>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.category || '—'}
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate text-sm text-muted-foreground">
                            {row.treatment || '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.phoneNumber || '—'}
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {row.ratingAverage != null
                              ? `${row.ratingAverage.toFixed(1)}${row.ratingCount ? ` (${row.ratingCount})` : ''}`
                              : '—'}
                          </TableCell>
                        </>
                      )}
                      {tab === 'treatments' && (
                        <>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.category || '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {row.atsNewDelhi != null
                              ? `₹${row.atsNewDelhi.toLocaleString('en-IN')}`
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {row.atsMumbai != null
                              ? `₹${row.atsMumbai.toLocaleString('en-IN')}`
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {row.atsPune != null ? `₹${row.atsPune.toLocaleString('en-IN')}` : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {row.atsHyderabad != null
                              ? `₹${row.atsHyderabad.toLocaleString('en-IN')}`
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {row.atsBangalore != null
                              ? `₹${row.atsBangalore.toLocaleString('en-IN')}`
                              : '—'}
                          </TableCell>
                        </>
                      )}
                      <TableCell>
                        <Badge variant={row.isActive ? 'default' : 'secondary'}>
                          {row.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      {(canWrite || tab === 'hospitals') && (
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            {tab === 'hospitals' && (
                              <Button type="button" variant="outline" size="sm" asChild>
                                <Link href={`/hospitals/${encodeURIComponent(row.name)}`}>
                                  <Eye className="size-3" />
                                  View
                                </Link>
                              </Button>
                            )}
                            {canWrite && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openEdit(row)}
                              >
                                <Pencil className="size-3" />
                                Edit
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </Tabs>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>
                {editing ? 'Edit' : 'Add'} {TAB_LABEL[tab]}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {tab !== 'doctors' && tab !== 'hospitals' && (
                <div>
                  <Label htmlFor="md-name">Name *</Label>
                  <Input
                    id="md-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Display name"
                  />
                </div>
              )}

              {tab === 'doctors' && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="doc-name">Name *</Label>
                    <Input
                      id="doc-name"
                      value={doctorForm.name}
                      onChange={(e) => setDoctorForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Doctor name"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="doc-category">Treatment category</Label>
                      <Select
                        value={doctorForm.category || 'unset'}
                        onValueChange={(v) => {
                          const category = v === 'unset' ? '' : v
                          setDoctorForm((p) => {
                            const next = { ...p, category }
                            if (!category || !p.treatment.trim()) return next
                            const match = (treatmentMasterData?.items ?? []).find(
                              (item) => item.name.trim() === p.treatment.trim(),
                            )
                            if (match?.category?.trim() && match.category.trim() !== category) {
                              next.treatment = ''
                            }
                            return next
                          })
                        }}
                      >
                        <SelectTrigger id="doc-category">
                          <SelectValue placeholder="Select treatment category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unset">—</SelectItem>
                          {treatmentCategoryOptions.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="doc-treatment">Treatment</Label>
                      <Select
                        value={doctorForm.treatment || 'unset'}
                        onValueChange={(v) =>
                          setDoctorForm((p) => ({ ...p, treatment: v === 'unset' ? '' : v }))
                        }
                      >
                        <SelectTrigger id="doc-treatment">
                          <SelectValue placeholder="Select treatment" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unset">—</SelectItem>
                          {treatmentOptions.map((treatment) => (
                            <SelectItem key={treatment} value={treatment}>
                              {treatment}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="doc-age">Age</Label>
                      <Input
                        id="doc-age"
                        type="number"
                        min={0}
                        max={120}
                        value={doctorForm.age}
                        onChange={(e) => setDoctorForm((p) => ({ ...p, age: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Sex</Label>
                      <Select
                        value={doctorForm.sex || 'unset'}
                        onValueChange={(v) =>
                          setDoctorForm((p) => ({ ...p, sex: v === 'unset' ? '' : v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unset">—</SelectItem>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="doc-phone">Phone number</Label>
                      <Input
                        id="doc-phone"
                        inputMode="tel"
                        value={doctorForm.phoneNumber}
                        onChange={(e) =>
                          setDoctorForm((p) => ({ ...p, phoneNumber: e.target.value }))
                        }
                        placeholder="10-digit mobile number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="doc-exp-years">Experience (years)</Label>
                      <Input
                        id="doc-exp-years"
                        type="number"
                        min={0}
                        max={80}
                        value={doctorForm.experienceYears}
                        onChange={(e) =>
                          setDoctorForm((p) => ({ ...p, experienceYears: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="doc-aadhaar-no">Aadhaar number</Label>
                      <Input
                        id="doc-aadhaar-no"
                        value={doctorForm.aadhaarNumber}
                        onChange={(e) =>
                          setDoctorForm((p) => ({ ...p, aadhaarNumber: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="doc-pan-no">PAN number</Label>
                      <Input
                        id="doc-pan-no"
                        value={doctorForm.panNumber}
                        onChange={(e) =>
                          setDoctorForm((p) => ({ ...p, panNumber: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="doc-rating">Rating (from feedback)</Label>
                      <div className="flex gap-2">
                        <Input
                          id="doc-rating"
                          type="number"
                          min={0}
                          max={5}
                          step={0.1}
                          placeholder="Avg 0–5"
                          value={doctorForm.ratingAverage}
                          onChange={(e) =>
                            setDoctorForm((p) => ({ ...p, ratingAverage: e.target.value }))
                          }
                        />
                        <Input
                          type="number"
                          min={0}
                          placeholder="Count"
                          value={doctorForm.ratingCount}
                          onChange={(e) =>
                            setDoctorForm((p) => ({ ...p, ratingCount: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="doc-exp-notes">Experience notes</Label>
                    <Textarea
                      id="doc-exp-notes"
                      rows={2}
                      value={doctorForm.experienceNotes}
                      onChange={(e) =>
                        setDoctorForm((p) => ({ ...p, experienceNotes: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="doc-fee">Fee structure</Label>
                    <Textarea
                      id="doc-fee"
                      rows={2}
                      value={doctorForm.feeStructure}
                      onChange={(e) =>
                        setDoctorForm((p) => ({ ...p, feeStructure: e.target.value }))
                      }
                      placeholder="Consultation / surgery fees, packages, etc."
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <MasterFileField
                      label="Aadhaar card"
                      value={doctorForm.aadhaarCardUrl}
                      folder="masters/doctors/aadhaar"
                      onChange={(url) =>
                        setDoctorForm((p) => ({ ...p, aadhaarCardUrl: url }))
                      }
                    />
                    <MasterFileField
                      label="PAN card"
                      value={doctorForm.panCardUrl}
                      folder="masters/doctors/pan"
                      onChange={(url) => setDoctorForm((p) => ({ ...p, panCardUrl: url }))}
                    />
                    <MasterFileField
                      label="Agreement"
                      value={doctorForm.agreementUrl}
                      folder="masters/doctors/agreement"
                      onChange={(url) => setDoctorForm((p) => ({ ...p, agreementUrl: url }))}
                    />
                  </div>

                  <div className="space-y-2 rounded-lg border p-3">
                    <Label>Documents (Degrees, Documentation, MOU, etc.)</Label>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="min-w-[140px]">
                        <Label className="text-xs text-muted-foreground">Type</Label>
                        <Select
                          value={docType}
                          onValueChange={(v) => setDocType(v as DoctorDocument['type'])}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DOC_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={docUploading}
                        onClick={() => {
                          const input = document.createElement('input')
                          input.type = 'file'
                          input.accept = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx'
                          input.onchange = async () => {
                            const file = input.files?.[0]
                            if (!file) return
                            const result = await uploadFile(file)
                            if (!result?.url) return
                            setDoctorForm((p) => ({
                              ...p,
                              documents: [
                                ...p.documents,
                                { name: file.name, url: result.url, type: docType },
                              ],
                            }))
                          }
                          input.click()
                        }}
                      >
                        {docUploading ? (
                          <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                        ) : (
                          <Upload className="mr-1.5 size-3.5" />
                        )}
                        Upload document
                      </Button>
                    </div>
                    {doctorForm.documents.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No documents uploaded.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {doctorForm.documents.map((doc, idx) => (
                          <li
                            key={`${doc.url}-${idx}`}
                            className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">{doc.name}</p>
                              <p className="text-xs text-muted-foreground">{doc.type}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary"
                              >
                                <ExternalLink className="size-3.5" />
                              </a>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setDoctorForm((p) => ({
                                    ...p,
                                    documents: p.documents.filter((_, i) => i !== idx),
                                  }))
                                }
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label>Status</Label>
                      <p className="text-sm text-muted-foreground">
                        {doctorForm.isActive
                          ? 'Active — shown in dropdowns and forms'
                          : 'Inactive — hidden from dropdowns'}
                      </p>
                    </div>
                    <Switch
                      checked={doctorForm.isActive}
                      onCheckedChange={(v) => {
                        setDoctorForm((p) => ({ ...p, isActive: v }))
                        setFormIsActive(v)
                      }}
                    />
                  </div>
                </div>
              )}

              {tab === 'hospitals' && (
                <HospitalMasterForm
                  form={{ ...hospitalForm, name: formName || hospitalForm.name }}
                  onChange={(next) => {
                    setHospitalForm(next)
                    setFormName(next.name)
                    setFormIsActive(next.isActive)
                  }}
                  insuranceOptions={insuranceOptions}
                  showNameField
                />
              )}

              {tab === 'treatments' && (
                <>
                  <div>
                    <Label htmlFor="md-category">Category *</Label>
                    <Select
                      value={formCategory || 'unset'}
                      onValueChange={(v) => setFormCategory(v === 'unset' ? '' : v)}
                    >
                      <SelectTrigger id="md-category">
                        <SelectValue placeholder="Select treatment category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unset">—</SelectItem>
                        {treatmentCategoryOptions.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">
                      ATS (Average Ticket Size) by City
                    </Label>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                      <div>
                        <Label htmlFor="ats-delhi" className="text-xs text-muted-foreground">
                          New Delhi (₹)
                        </Label>
                        <Input
                          id="ats-delhi"
                          type="number"
                          min={0}
                          value={formAtsNewDelhi}
                          onChange={(e) => setFormAtsNewDelhi(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="ats-mumbai" className="text-xs text-muted-foreground">
                          Mumbai (₹)
                        </Label>
                        <Input
                          id="ats-mumbai"
                          type="number"
                          min={0}
                          value={formAtsMumbai}
                          onChange={(e) => setFormAtsMumbai(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="ats-pune" className="text-xs text-muted-foreground">
                          Pune (₹)
                        </Label>
                        <Input
                          id="ats-pune"
                          type="number"
                          min={0}
                          value={formAtsPune}
                          onChange={(e) => setFormAtsPune(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="ats-hyd" className="text-xs text-muted-foreground">
                          Hyderabad (₹)
                        </Label>
                        <Input
                          id="ats-hyd"
                          type="number"
                          min={0}
                          value={formAtsHyderabad}
                          onChange={(e) => setFormAtsHyderabad(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="ats-blr" className="text-xs text-muted-foreground">
                          Bangalore (₹)
                        </Label>
                        <Input
                          id="ats-blr"
                          type="number"
                          min={0}
                          value={formAtsBangalore}
                          onChange={(e) => setFormAtsBangalore(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {tab !== 'hospitals' && tab !== 'doctors' && (
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="md-active-other">Status</Label>
                    <p className="text-sm text-muted-foreground">
                      {formIsActive
                        ? 'Active — shown in dropdowns and forms'
                        : 'Inactive — hidden from dropdowns'}
                    </p>
                  </div>
                  <Switch
                    id="md-active-other"
                    checked={formIsActive}
                    onCheckedChange={setFormIsActive}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const name =
                    tab === 'doctors' ? doctorForm.name.trim() : formName.trim()
                  if (!name) {
                    toast.error('Name is required')
                    return
                  }
                  if (tab === 'treatments' && !formCategory.trim()) {
                    toast.error('Category is required')
                    return
                  }
                  saveMutation.mutate()
                }}
                disabled={saveMutation.isPending}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AuthenticatedLayout>
  )
}
