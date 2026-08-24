"use client"

import { useEffect, useMemo, useState } from "react"
import { Phone, QrCode } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAuth } from "@/hooks/use-auth"

interface LeadQrPopoverProps {
  leadId: string
  phoneNumber?: string | null
  alternateNumber?: string | null
  patientName?: string
  triggerVariant?: "icon" | "button"
  buttonLabel?: string
  allowServerSidePhoneLookup?: boolean
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
    "ASSISTANT_CATEGORY_MANAGER",
    "SALES_HEAD",
    "SUPER_ADMIN",
    "ADMIN",
    "MD",
    "EXECUTIVE_ASSISTANT",
    "TESTER",
    "COMPLIANCE_HEAD",
    "INSURANCE_HEAD",
    "PL_HEAD",
  ].includes(userRole ?? "")
}

export function LeadQrPopover({
  leadId,
  phoneNumber,
  alternateNumber,
  patientName,
  triggerVariant = "icon",
  buttonLabel = "Lead QR",
  allowServerSidePhoneLookup = false,
}: LeadQrPopoverProps) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [isPreparingQr, setIsPreparingQr] = useState(false)
  const normalized = normalizePhone(phoneNumber ?? "")
  const normalizedAlt = normalizePhone(alternateNumber ?? "")
  const canInitiateCall = Boolean(normalized) || Boolean(normalizedAlt) || allowServerSidePhoneLookup
  const buttonRoute = `/api/leads/${leadId}/qr-call?source=button`
  const qrLabel = useMemo(
    () => patientName ? patientName.split(" ")[0] : "lead",
    [patientName]
  )

  useEffect(() => {
    setQrUrl(null)
    setIsPreparingQr(false)
  }, [leadId])

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
      // Audit logging should not block the QR flow.
    }
  }

  async function preparePublicQrLink() {
    if (qrUrl || isPreparingQr || !canInitiateCall) {
      return
    }

    try {
      setIsPreparingQr(true)
      const response = await fetch(`/api/leads/${leadId}/qr-call/public-link`, {
        method: "POST",
      })
      const payload = await response.json().catch(() => null)
      const nextUrl =
        payload?.data?.landingUrl && typeof payload.data.landingUrl === "string"
          ? payload.data.landingUrl
          : null
      if (response.ok && nextUrl) {
        setQrUrl(nextUrl)
      }
    } catch {
      // Leave the QR empty if public-link generation fails.
    } finally {
      setIsPreparingQr(false)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) {
          void logQrViewed()
          void preparePublicQrLink()
        }
      }}
    >
      <PopoverTrigger asChild>
        {triggerVariant === "button" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <QrCode className="h-4 w-4" />
            {buttonLabel}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Show lead QR code"
            onClick={(e) => e.stopPropagation()}
          >
            <QrCode className="h-4 w-4" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        onClick={(e) => e.stopPropagation()}
        className="w-auto p-4"
      >
        <div className="flex flex-col items-center gap-3">
          <p className="text-center text-xs font-medium text-muted-foreground">
            Scan to call {qrLabel}
          </p>
          {canInitiateCall ? (
            qrUrl ? (
              <div className="rounded-lg bg-white p-2">
                <QRCodeSVG value={qrUrl} size={168} />
              </div>
            ) : (
              <div className="flex h-[184px] w-[184px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                {isPreparingQr ? "Preparing QR..." : "QR unavailable"}
              </div>
            )
          ) : (
            <p className="text-sm text-destructive">No phone number</p>
          )}
          {canInitiateCall && (
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
