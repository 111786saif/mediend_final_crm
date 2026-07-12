"use client"

import { useMemo, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Phone, QrCode } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"

interface QRCodePopoverProps {
  leadId: string
  phoneNumber: string
  patientName?: string
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D+/g, "")
  if (!digits) return ""
  if (digits.startsWith("91") && digits.length >= 12) return `+${digits}`
  if (digits.length === 10) return `+91${digits}`
  return `+${digits}`
}

function canUseLeadQr(userRole: string | undefined) {
  return [
    "BD",
    "TEAM_LEAD",
    "CATEGORY_MANAGER",
    "SALES_HEAD",
    "SUPER_ADMIN",
    "ADMIN",
    "MD",
  ].includes(userRole ?? "")
}

export function QRCodePopover({ leadId, phoneNumber, patientName }: QRCodePopoverProps) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const normalized = normalizePhone(phoneNumber)
  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "")
  const qrRoute = `/api/leads/${leadId}/qr-call?source=qr`
  const buttonRoute = `/api/leads/${leadId}/qr-call?source=button`
  const qrUrl = useMemo(
    () => (baseUrl ? `${baseUrl}${qrRoute}` : qrRoute),
    [baseUrl, qrRoute]
  )

  if (!canUseLeadQr(user?.role)) {
    return null
  }

  async function logQrViewed() {
    try {
      await fetch(`/api/leads/${leadId}/qr-call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "QR_VIEWED",
          source: "popover",
        }),
      })
    } catch {
      // Do not interrupt the QR flow if audit logging fails.
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) {
          void logQrViewed()
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Show QR code to dial"
          onClick={(e) => e.stopPropagation()}
        >
          <QrCode className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        onClick={(e) => e.stopPropagation()}
        className="w-auto p-4"
      >
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs font-medium text-muted-foreground">
            Scan to call {patientName ? patientName.split(" ")[0] : ""}
          </p>
          {normalized ? (
            <div className="rounded-lg bg-white p-2">
              <QRCodeSVG value={qrUrl} size={168} />
            </div>
          ) : (
            <p className="text-sm text-destructive">No phone number</p>
          )}
          {normalized && (
            <a href={buttonRoute} className="w-full">
              <Button type="button" size="sm" className="w-full gap-2">
                <Phone className="h-4 w-4" />
                Call now
              </Button>
            </a>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
