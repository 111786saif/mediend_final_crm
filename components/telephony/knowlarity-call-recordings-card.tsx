'use client'

import { useQuery } from '@tanstack/react-query'
import { Download, ExternalLink, Mic, PhoneCall } from 'lucide-react'
import { format } from 'date-fns'
import { apiGet } from '@/lib/api-client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type CallRecordingItem = {
  id: string
  recordingUrl: string
  createdAt: string
  agentName?: string | null
  agentRole?: string | null
  summary?: string | null
}

type CallRecordingsResponse = {
  recordings: CallRecordingItem[]
}

function formatCallDate(value: string) {
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return format(date, 'dd MMM yyyy · hh:mm a')
  } catch {
    return value
  }
}

export function KnowlarityCallRecordingsCard({
  leadId,
  className,
}: {
  leadId: number
  className?: string
}) {
  const { data, isLoading, error } = useQuery<CallRecordingsResponse, Error>({
    queryKey: ['lead-call-recordings', leadId],
    queryFn: () => apiGet<CallRecordingsResponse>(`/api/leads/${leadId}/call-recordings`),
    enabled: Boolean(leadId),
    retry: false,
  })

  // Do not render call recordings card for roles below/equal to BD (returns 403 Forbidden)
  if (error) {
    return null
  }

  const recordings = data?.recordings ?? []

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Mic className="h-4 w-4 text-emerald-500" />
            Knowlarity Call Recordings
          </CardTitle>
          <CardDescription className="text-xs">
            Audio recordings of conversation bridge calls for this lead
          </CardDescription>
        </div>
        <Badge variant="secondary" className="font-mono text-xs">
          {recordings.length} {recordings.length === 1 ? 'recording' : 'recordings'}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Loading call recordings...
          </p>
        ) : recordings.length === 0 ? (
          <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground space-y-1">
            <PhoneCall className="mx-auto h-5 w-5 opacity-40 mb-1" />
            <p className="font-medium">No call recordings found</p>
            <p className="text-[11px] opacity-75">
              Call recordings will automatically appear here once Knowlarity bridge calls complete.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
            {recordings.map((recording) => (
              <div
                key={recording.id}
                className="rounded-xl border bg-card p-3 space-y-2 text-xs transition-colors hover:border-emerald-500/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-foreground">
                      {formatCallDate(recording.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      asChild
                      title="Open recording audio in new tab"
                    >
                      <a href={recording.recordingUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      asChild
                      title="Download audio recording"
                    >
                      <a href={recording.recordingUrl} download target="_blank" rel="noopener noreferrer">
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                </div>

                {recording.agentName ? (
                  <div className="text-[11px] text-muted-foreground">
                    <span>Agent: {recording.agentName}</span>
                  </div>
                ) : null}

                {/* HTML5 Audio Player */}
                <div className="pt-1">
                  <audio
                    controls
                    preload="none"
                    src={recording.recordingUrl}
                    className="w-full h-9 rounded-lg"
                  >
                    Your browser does not support playing audio recordings directly.
                  </audio>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
