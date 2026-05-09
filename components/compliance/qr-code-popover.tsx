"use client"

import { QRCodeSVG } from "qrcode.react"
import { Phone, QrCode } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"

interface QRCodePopoverProps {
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

export function QRCodePopover({ phoneNumber, patientName }: QRCodePopoverProps) {
  const normalized = normalizePhone(phoneNumber)
  const telUri = normalized ? `tel:${normalized}` : ""

  return (
    <Popover>
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
          {telUri ? (
            <div className="rounded-lg bg-white p-2">
              <QRCodeSVG value={telUri} size={168} />
            </div>
          ) : (
            <p className="text-sm text-destructive">No phone number</p>
          )}
          {telUri && (
            <a href={telUri} className="w-full">
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
