'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Eye } from 'lucide-react'

interface OutstandingCase {
  id: string
  leadId: number
  srNo: number | null
  month: string | null
  dos: string | null
  status: string | null
  paymentReceived: boolean
  managerName: string | null
  bdmName: string | null
  patientName: string | null
  treatment: string | null
  hospitalName: string | null
  billAmount: number
  settlementAmount: number
  cashPaidByPatient: number
  overallAmount: number
  implantCost: number
  dciCost: number
  hospitalSharePct: number | null
  hospitalShareAmount: number
  mediendSharePct: number | null
  mediendShareAmount: number
  outstandingDays: number | null
  remarks: string | null
  remark2: string | null
  lead: {
    id: number
    leadRef: string
    patientName: string
  }
}

interface OutstandingListProps {
  filters?: {
    paymentReceived?: boolean
    month?: string
    status?: string
  }
}

export function OutstandingList({ filters }: OutstandingListProps) {
  const queryParams = new URLSearchParams()
  if (filters?.paymentReceived !== undefined) {
    queryParams.append('paymentReceived', filters.paymentReceived.toString())
  }
  if (filters?.month) {
    queryParams.append('month', filters.month)
  }
  if (filters?.status) {
    queryParams.append('status', filters.status)
  }

  const { data: outstandingCases, isLoading } = useQuery<OutstandingCase[]>({
    queryKey: ['outstanding-cases', filters],
    queryFn: () => apiGet<OutstandingCase[]>(`/api/outstanding?${queryParams.toString()}`),
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading outstanding cases...
        </CardContent>
      </Card>
    )
  }

  if (!outstandingCases || outstandingCases.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No outstanding cases found
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Outstanding Cases</CardTitle>
        <CardDescription>Cases with pending payments</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SR No</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Treatment</TableHead>
              <TableHead>Hospital</TableHead>
              <TableHead>Bill Amount</TableHead>
              <TableHead>Outstanding Days</TableHead>
              <TableHead>Payment Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {outstandingCases.map((case_) => (
              <TableRow key={case_.id}>
                <TableCell>{case_.srNo || '-'}</TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{case_.patientName || case_.lead.patientName}</p>
                    <p className="text-xs text-muted-foreground">{case_.lead.leadRef}</p>
                  </div>
                </TableCell>
                <TableCell>{case_.treatment || '-'}</TableCell>
                <TableCell>{case_.hospitalName || '-'}</TableCell>
                <TableCell>₹{case_.billAmount?.toLocaleString() || '0'}</TableCell>
                <TableCell>
                  {case_.outstandingDays !== null ? (
                    <Badge variant={case_.outstandingDays > 30 ? 'destructive' : 'secondary'}>
                      {case_.outstandingDays} days
                    </Badge>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={case_.paymentReceived ? 'default' : 'destructive'}>
                    {case_.paymentReceived ? 'Received' : 'Pending'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link href={`/patient/${case_.leadId}`}>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
