'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { apiGet, apiPatch, apiPost } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DoctorAdminMasterRecord, DoctorAdminMasterType } from '@/components/doctor-admin/types'
import { formatCurrency, StatusBadge } from '@/components/doctor-admin/shared'

const MASTER_META: Record<
  DoctorAdminMasterType,
  {
    title: string
    description: string
    addLabel: string
  }
> = {
  implants: {
    title: 'Implant Master',
    description: 'Manage implant inventory and tracking',
    addLabel: 'Add Implant',
  },
  'surgery-remarks': {
    title: 'Surgery Remarks',
    description: 'Options when Surgery Advised = Yes (Add Remarks)',
    addLabel: 'Add',
  },
  'reason-no-surgery': {
    title: 'Reason No Surgery',
    description: 'Options when Surgery Advised = No (Reason for Surgery Not Suggested)',
    addLabel: 'Add',
  },
  'follow-up-reasons': {
    title: 'Follow-up Reasons',
    description: 'Options when Surgery Advised = Follow Up (Reason for Follow-up)',
    addLabel: 'Add',
  },
}

type ImplantFormState = {
  name: string
  code: string
  category: string
  manufacturer: string
  unitCost: string
  description: string
  isActive: boolean
}

type OptionFormState = {
  code: string
  label: string
  displayOrder: string
  isActive: boolean
}

function emptyImplantForm(): ImplantFormState {
  return {
    name: '',
    code: '',
    category: '',
    manufacturer: '',
    unitCost: '',
    description: '',
    isActive: true,
  }
}

function emptyOptionForm(): OptionFormState {
  return {
    code: '',
    label: '',
    displayOrder: '0',
    isActive: true,
  }
}

function getMasterQueryKey(type: DoctorAdminMasterType, search: string) {
  return ['doctor-admin', 'masters', type, search.trim()]
}

export function DoctorAdminMastersTab() {
  const queryClient = useQueryClient()
  const [type, setType] = useState<DoctorAdminMasterType>('implants')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<DoctorAdminMasterRecord | null>(null)
  const [implantForm, setImplantForm] = useState<ImplantFormState>(emptyImplantForm)
  const [optionForm, setOptionForm] = useState<OptionFormState>(emptyOptionForm)

  const queryKey = getMasterQueryKey(type, search)
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      apiGet<{ items: DoctorAdminMasterRecord[] }>(
        `/api/doctor-admin/masters/${type}?search=${encodeURIComponent(search)}&includeInactive=true`
      ),
  })

  const items = data?.items ?? []
  const meta = MASTER_META[type]

  const createMutation = useMutation({
    mutationFn: async () => {
      if (type === 'implants') {
        return apiPost<{ item: DoctorAdminMasterRecord }>(`/api/doctor-admin/masters/${type}`, {
          ...implantForm,
          unitCost: implantForm.unitCost.trim() ? Number(implantForm.unitCost) : null,
        })
      }

      return apiPost<{ item: DoctorAdminMasterRecord }>(`/api/doctor-admin/masters/${type}`, {
        ...optionForm,
        displayOrder: Number(optionForm.displayOrder || '0'),
      })
    },
    onSuccess: () => {
      toast.success(`${meta.title} record created`)
      setOpen(false)
      setImplantForm(emptyImplantForm())
      setOptionForm(emptyOptionForm())
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create record')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return

      if (type === 'implants') {
        return apiPatch<{ item: DoctorAdminMasterRecord }>(
          `/api/doctor-admin/masters/${type}/${editing.id}`,
          {
            ...implantForm,
            unitCost: implantForm.unitCost.trim() ? Number(implantForm.unitCost) : null,
          }
        )
      }

      return apiPatch<{ item: DoctorAdminMasterRecord }>(
        `/api/doctor-admin/masters/${type}/${editing.id}`,
        {
          ...optionForm,
          displayOrder: Number(optionForm.displayOrder || '0'),
        }
      )
    },
    onSuccess: () => {
      toast.success(`${meta.title} record updated`)
      setOpen(false)
      setEditing(null)
      setImplantForm(emptyImplantForm())
      setOptionForm(emptyOptionForm())
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update record')
    },
  })

  const columns = useMemo(() => {
    if (type === 'implants') {
      return ['Implant Name', 'Category', 'Manufacturer', 'Unit Cost', 'Usage Count', 'Status', 'Actions']
    }

    return ['Code', 'Label', 'Order', 'Status', 'Actions']
  }, [type])

  const openCreate = () => {
    setEditing(null)
    setImplantForm(emptyImplantForm())
    setOptionForm(emptyOptionForm())
    setOpen(true)
  }

  const openEdit = (item: DoctorAdminMasterRecord) => {
    setEditing(item)

    if (type === 'implants') {
      setImplantForm({
        name: item.name || '',
        code: item.code || '',
        category: item.category || '',
        manufacturer: item.manufacturer || '',
        unitCost: item.unitCost != null ? String(item.unitCost) : '',
        description: item.description || '',
        isActive: item.isActive,
      })
    } else {
      setOptionForm({
        code: item.code || '',
        label: item.label || '',
        displayOrder: String(item.displayOrder ?? 0),
        isActive: item.isActive,
      })
    }

    setOpen(true)
  }

  return (
    <div className='space-y-6'>
      <Tabs
        value={type}
        onValueChange={value => {
          setType(value as DoctorAdminMasterType)
          setSearch('')
        }}
      >
        <TabsList className='flex h-auto flex-wrap gap-2 bg-transparent p-0'>
          <TabsTrigger value='implants'>Implants</TabsTrigger>
          <TabsTrigger value='surgery-remarks'>Surgery Remarks</TabsTrigger>
          <TabsTrigger value='reason-no-surgery'>Reason No Surgery</TabsTrigger>
          <TabsTrigger value='follow-up-reasons'>Follow-up Reasons</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <h2 className='text-2xl font-semibold tracking-tight'>{meta.title}</h2>
          <p className='text-sm text-muted-foreground'>{meta.description}</p>
        </div>
        <div className='flex w-full gap-3 lg:w-auto'>
          <Input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={
              type === 'implants'
                ? 'Search implant, code, category...'
                : 'Search code or label...'
            }
            className='lg:w-80'
          />
          <Button onClick={openCreate} className='shrink-0'>
            <Plus className='mr-2 h-4 w-4' />
            {meta.addLabel}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(column => (
                  <TableHead key={column}>{column}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className='py-10 text-center text-muted-foreground'>
                    Loading...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className='py-10 text-center text-muted-foreground'>
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                items.map(item => (
                  <TableRow key={item.id}>
                    {type === 'implants' ? (
                      <>
                        <TableCell>
                          <div className='font-medium'>{item.name}</div>
                          <div className='text-xs text-muted-foreground'>{item.code || '-'}</div>
                        </TableCell>
                        <TableCell>{item.category || '-'}</TableCell>
                        <TableCell>{item.manufacturer || '-'}</TableCell>
                        <TableCell>{formatCurrency(item.unitCost)}</TableCell>
                        <TableCell>{item.usageCount ?? 0}</TableCell>
                        <TableCell>
                          <StatusBadge status={item.isActive ? 'active' : 'inactive'} />
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className='font-mono'>{item.code}</TableCell>
                        <TableCell>{item.label}</TableCell>
                        <TableCell>{item.displayOrder ?? 0}</TableCell>
                        <TableCell>
                          <StatusBadge status={item.isActive ? 'active' : 'inactive'} />
                        </TableCell>
                      </>
                    )}
                    <TableCell>
                      <Button variant='ghost' size='icon' onClick={() => openEdit(item)}>
                        <Pencil className='h-4 w-4' />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={value => {
          setOpen(value)
          if (!value) {
            setEditing(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${meta.title}` : `Create ${meta.title}`}</DialogTitle>
          </DialogHeader>

          {type === 'implants' ? (
            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2 md:col-span-2'>
                <Label>Implant Name</Label>
                <Input
                  value={implantForm.name}
                  onChange={event => setImplantForm(current => ({ ...current, name: event.target.value }))}
                />
              </div>
              <div className='space-y-2'>
                <Label>Code</Label>
                <Input
                  value={implantForm.code}
                  onChange={event => setImplantForm(current => ({ ...current, code: event.target.value }))}
                />
              </div>
              <div className='space-y-2'>
                <Label>Category</Label>
                <Input
                  value={implantForm.category}
                  onChange={event => setImplantForm(current => ({ ...current, category: event.target.value }))}
                />
              </div>
              <div className='space-y-2'>
                <Label>Manufacturer</Label>
                <Input
                  value={implantForm.manufacturer}
                  onChange={event => setImplantForm(current => ({ ...current, manufacturer: event.target.value }))}
                />
              </div>
              <div className='space-y-2'>
                <Label>Unit Cost</Label>
                <Input
                  type='number'
                  value={implantForm.unitCost}
                  onChange={event => setImplantForm(current => ({ ...current, unitCost: event.target.value }))}
                />
              </div>
              <div className='space-y-2 md:col-span-2'>
                <Label>Description</Label>
                <Input
                  value={implantForm.description}
                  onChange={event => setImplantForm(current => ({ ...current, description: event.target.value }))}
                />
              </div>
              <div className='flex items-center justify-between rounded-md border px-3 py-2 md:col-span-2'>
                <Label htmlFor='implant-active'>Active</Label>
                <Switch
                  id='implant-active'
                  checked={implantForm.isActive}
                  onCheckedChange={checked => setImplantForm(current => ({ ...current, isActive: checked }))}
                />
              </div>
            </div>
          ) : (
            <div className='grid gap-4'>
              <div className='space-y-2'>
                <Label>Code</Label>
                <Input
                  value={optionForm.code}
                  onChange={event => setOptionForm(current => ({ ...current, code: event.target.value }))}
                />
              </div>
              <div className='space-y-2'>
                <Label>Label</Label>
                <Input
                  value={optionForm.label}
                  onChange={event => setOptionForm(current => ({ ...current, label: event.target.value }))}
                />
              </div>
              <div className='space-y-2'>
                <Label>Display order</Label>
                <Input
                  type='number'
                  value={optionForm.displayOrder}
                  onChange={event => setOptionForm(current => ({ ...current, displayOrder: event.target.value }))}
                />
              </div>
              <div className='flex items-center justify-between rounded-md border px-3 py-2'>
                <Label htmlFor='option-active'>Active</Label>
                <Switch
                  id='option-active'
                  checked={optionForm.isActive}
                  onCheckedChange={checked => setOptionForm(current => ({ ...current, isActive: checked }))}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => {
                setOpen(false)
                setEditing(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editing) {
                  updateMutation.mutate()
                } else {
                  createMutation.mutate()
                }
              }}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editing ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
