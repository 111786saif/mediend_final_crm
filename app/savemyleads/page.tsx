'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const samplePayload = `{
  "campaignId": "demo-campaign-001",
  "name": "John Doe",
  "phone": "+91-9876543210",
  "email": "john@example.com"
}`

export default function SaveMyLeadsPage() {
  const [payload, setPayload] = useState(samplePayload)
  const [responseText, setResponseText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSendTestLead = async () => {
    setIsSubmitting(true)
    setResponseText('')

    try {
      const parsedPayload = JSON.parse(payload)
      const response = await fetch('/api/savemyleads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsedPayload),
      })

      const data = await response.json()

      setResponseText(JSON.stringify(data, null, 2))
    } catch (error) {
      setResponseText(
        JSON.stringify(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Unable to send test lead',
          },
          null,
          2
        )
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-50">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-cyan-300">
            SaveMyLeads Webhook
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Local webhook receiver is ready
          </h1>
          <p className="max-w-2xl text-sm text-slate-300 sm:text-base">
            Point SaveMyLeads to <span className="font-mono text-cyan-300">http://localhost:3000/api/savemyleads</span>.
            Every `POST` request received there is audited, matched to a campaign, assigned to a
            Team Lead and BD, and then converted into a CRM lead.
          </p>
        </div>

        <Card className="border-slate-800 bg-slate-900/80 text-slate-50">
          <CardHeader>
            <CardTitle>Webhook details</CardTitle>
            <CardDescription className="text-slate-300">
              Use this exact local endpoint while testing:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-sm text-cyan-300">
              http://localhost:3000/api/savemyleads
            </div>
            <p className="text-sm text-slate-300">
              Successful requests return the matched campaign, Team Lead, BD, and final lead ID.
              Detailed processing logs are printed in the terminal running `next dev`.
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/80 text-slate-50">
          <CardHeader>
            <CardTitle>Send a test lead</CardTitle>
            <CardDescription className="text-slate-300">
              This sends a sample `POST` request to the webhook so you can confirm campaign routing
              and lead creation instantly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payload" className="text-slate-200">
                JSON payload
              </Label>
              <Textarea
                id="payload"
                value={payload}
                onChange={(event) => setPayload(event.target.value)}
                className="min-h-64 border-slate-800 bg-slate-950 font-mono text-sm text-slate-100"
              />
            </div>

            <Button
              type="button"
              onClick={handleSendTestLead}
              disabled={isSubmitting}
              className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            >
              {isSubmitting ? 'Sending...' : 'Send test lead'}
            </Button>

            <div className="space-y-2">
              <Label htmlFor="response" className="text-slate-200">
                Response
              </Label>
              <Textarea
                id="response"
                value={responseText}
                readOnly
                className="min-h-40 border-slate-800 bg-slate-950 font-mono text-sm text-slate-100"
                placeholder="Response from /api/savemyleads will appear here."
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
