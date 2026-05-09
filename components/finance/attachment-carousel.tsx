'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FileText, Maximize2, ExternalLink, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useSwipeable } from 'react-swipeable'

interface Attachment {
  name: string
  url: string
  type: string
}

interface AttachmentCarouselProps {
  attachments: Attachment[]
}

const OFFICE_EXTS = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']

function getExt(name: string, url: string): string {
  const fromName = name.split('.').pop()?.toLowerCase() ?? ''
  if (fromName) return fromName
  return url.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
}

function getKind(att: Attachment): 'image' | 'pdf' | 'office' | 'other' {
  if (att.type?.startsWith('image/')) return 'image'
  const ext = getExt(att.name, att.url)
  if (att.type === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (OFFICE_EXTS.includes(ext)) return 'office'
  return 'other'
}

/** URL safe to put in `target="_blank"` without triggering a browser download. */
function getOpenInTabUrl(att: Attachment): string {
  const kind = getKind(att)
  if (kind === 'office') {
    return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(att.url)}`
  }
  return att.url
}

export function AttachmentCarousel({ attachments }: AttachmentCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null)

  const handlers = useSwipeable({
    onSwipedLeft: () => setCurrentIndex((prev) => Math.min(prev + 1, attachments.length - 1)),
    onSwipedRight: () => setCurrentIndex((prev) => Math.max(prev - 1, 0)),
    trackMouse: true,
  })

  if (!attachments || attachments.length === 0) return null

  const current = attachments[currentIndex]
  const currentKind = getKind(current)
  const isImage = currentKind === 'image'
  const isPdf = currentKind === 'pdf'

  return (
    <div className="space-y-2">
      <div className="relative group bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden aspect-[4/5] sm:aspect-video flex items-center justify-center border shadow-inner">
        {/* Swipe Area */}
        <div {...handlers} className="w-full h-full flex items-center justify-center cursor-pointer overflow-hidden p-2">
           {isImage ? (
             <img
               src={current.url}
               alt={current.name}
               className="max-w-full max-h-full object-contain hover:scale-105 transition-transform duration-300"
               onClick={() => {
                 setSelectedAttachment(current)
                 setIsFullscreen(true)
               }}
             />
           ) : isPdf ? (
             <div
               className="relative w-full h-full bg-white flex flex-col items-center justify-center p-0 overflow-hidden"
               onClick={() => {
                setSelectedAttachment(current)
                setIsFullscreen(true)
               }}
             >
               <iframe
                 src={`${current.url}#toolbar=0&navpanes=0`}
                 className="w-full h-full pointer-events-none scale-110 origin-top"
                 title={current.name}
               />
               <div className="absolute inset-0 bg-black/5 hover:bg-black/0 transition-colors pointer-events-none" />
               <div className="absolute top-12 left-0 right-0 p-4 text-center bg-gradient-to-b from-white/80 to-transparent pointer-events-none">
                  <p className="font-semibold text-sm line-clamp-1 px-4">{current.name}</p>
               </div>
             </div>
           ) : (
             <div className="relative w-full h-full bg-white flex flex-col items-center justify-center gap-3 p-6">
               <div className="p-4 rounded-full bg-slate-100 border border-slate-200">
                 <FileText className="h-10 w-10 text-slate-500" />
               </div>
               <p className="font-semibold text-sm line-clamp-2 text-center px-4">{current.name}</p>
               <p className="text-xs text-muted-foreground uppercase tracking-wide">
                 {getExt(current.name, current.url) || 'document'}
               </p>
               <Button
                 variant="secondary"
                 size="sm"
                 className="rounded-full px-6 shadow-md bg-white hover:bg-slate-50 text-slate-900 border"
                 asChild
                 onClick={(e) => e.stopPropagation()}
               >
                 <a href={getOpenInTabUrl(current)} target="_blank" rel="noopener noreferrer">
                   <ExternalLink className="h-4 w-4 mr-2" />
                   Open in new tab
                 </a>
               </Button>
             </div>
           )}
        </div>

        {/* Navigation Buttons */}
        {attachments.length > 1 && (
          <>
            <button 
              onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
              disabled={currentIndex === 0}
              className={`absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 dark:bg-black/80 shadow-md transition-opacity z-10 ${currentIndex === 0 ? 'opacity-0 cursor-default' : 'opacity-0 group-hover:opacity-100'}`}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button 
              onClick={() => setCurrentIndex((prev) => Math.min(prev + 1, attachments.length - 1))}
              disabled={currentIndex === attachments.length - 1}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 dark:bg-black/80 shadow-md transition-opacity z-10 ${currentIndex === attachments.length - 1 ? 'opacity-0 cursor-default' : 'opacity-0 group-hover:opacity-100'}`}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Fullscreen Trigger */}
        <button 
          onClick={(e) => {
            e.stopPropagation()
            setSelectedAttachment(current)
            setIsFullscreen(true)
          }}
          className="absolute top-3 right-3 p-2 rounded-full bg-black/50 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <Maximize2 className="h-4 w-4" />
        </button>

        {/* Counter Overlay */}
        {attachments.length > 1 && (
          <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/50 text-white text-[10px] font-bold backdrop-blur-sm z-10">
            {currentIndex + 1} / {attachments.length}
          </div>
        )}

        {/* Pagination Dots */}
        {attachments.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 p-1.5 rounded-full bg-black/20 backdrop-blur-[2px] z-10">
            {attachments.map((_, i) => (
              <div 
                key={i} 
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === currentIndex ? 'bg-white w-4' : 'bg-white/40'}`} 
              />
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Dialog */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[98vw] w-full h-[95vh] p-0 overflow-hidden bg-zinc-950 flex flex-col items-center justify-center border-none shadow-2xl">
          <DialogHeader className="absolute top-4 left-4 right-4 z-50 flex-row items-center justify-between pointer-events-none">
            <div className="bg-black/60 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/10 max-w-[70%] shadow-xl">
               <DialogTitle className="text-white text-sm font-semibold truncate leading-none mb-0">
                  {selectedAttachment?.name}
               </DialogTitle>
            </div>
            <Button 
               variant="ghost" 
               size="icon" 
               className="rounded-full bg-black/60 hover:bg-white/10 text-white pointer-events-auto h-11 w-11 border border-white/10 backdrop-blur-md shadow-xl transition-all"
               onClick={() => setIsFullscreen(false)}
            >
               <X className="h-6 w-6" />
            </Button>
          </DialogHeader>
          
          <div className="w-full h-full flex items-center justify-center">
            {selectedAttachment && (() => {
              const kind = getKind(selectedAttachment)
              if (kind === 'image') {
                return (
                  <img
                    src={selectedAttachment.url}
                    alt={selectedAttachment.name}
                    className="max-w-full max-h-full object-contain p-4"
                  />
                )
              }
              if (kind === 'pdf') {
                return (
                  <iframe
                    src={`${selectedAttachment.url}#toolbar=0&navpanes=0`}
                    className="w-full h-full bg-zinc-100 border-none"
                    title={selectedAttachment.name}
                  />
                )
              }
              return (
                <div className="flex flex-col items-center justify-center gap-4 text-white">
                  <div className="p-6 rounded-full bg-white/10 border border-white/15">
                    <FileText className="h-14 w-14 text-white/80" />
                  </div>
                  <p className="font-semibold text-lg max-w-[80vw] text-center line-clamp-2">{selectedAttachment.name}</p>
                  <p className="text-xs text-white/60 uppercase tracking-wide">
                    {getExt(selectedAttachment.name, selectedAttachment.url) || 'document'}
                  </p>
                </div>
              )
            })()}
          </div>

          {selectedAttachment && getKind(selectedAttachment) !== 'image' && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-50">
              <a
                href={getOpenInTabUrl(selectedAttachment)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-8 py-3.5 bg-white text-black font-bold rounded-full hover:bg-slate-100 transition-all shadow-[0_0_50px_rgba(255,255,255,0.2)] active:scale-95 group"
              >
                <ExternalLink className="h-5 w-5 group-hover:scale-110 transition-transform" />
                Open in new tab
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
