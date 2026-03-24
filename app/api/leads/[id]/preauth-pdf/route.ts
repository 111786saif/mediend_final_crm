import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, unauthorizedResponse } from '@/lib/api-utils'

function isImageUrl(url: string): boolean {
  const u = url.toLowerCase().split('?')[0]
  return (
    u.endsWith('.png') ||
    u.endsWith('.jpg') ||
    u.endsWith('.jpeg') ||
    u.endsWith('.gif') ||
    u.endsWith('.webp')
  )
}

function isPdfUrl(url: string): boolean {
  const u = url.toLowerCase().split('?')[0]
  return u.endsWith('.pdf')
}

async function fetchUrlAsBase64(url: string): Promise<{ data: string; mime: string } | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const base64 = buf.toString('base64')
    const contentType = res.headers.get('content-type') || 'application/octet-stream'
    const mime = contentType.split(';')[0].trim().toLowerCase()
    return { data: base64, mime }
  } catch {
    return null
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

type FileEntry = { name?: string; url?: string }

function pushJsonFileUrls(arr: unknown, out: string[]) {
  if (!Array.isArray(arr)) return
  for (const item of arr) {
    const u = item && typeof item === 'object' && 'url' in item ? (item as FileEntry).url : null
    if (typeof u === 'string' && u.trim()) out.push(u.trim())
  }
}

function classifyFetched(url: string, mime: string): 'pdf' | 'image' | 'skip' {
  const m = mime.split(';')[0].trim().toLowerCase()
  if (m === 'application/pdf' || m.includes('pdf')) return 'pdf'
  if (m.startsWith('image/')) return 'image'
  if (isPdfUrl(url)) return 'pdf'
  if (isImageUrl(url)) return 'image'
  return 'skip'
}

type SuggestedHospital = {
  hospitalName: string
  requestedRoomType?: string | null
  roomRentSingle?: number | null
  roomRentSemiPrivate?: number | null
  roomRentDeluxe?: number | null
  roomRentGeneral?: number | null
}

function getSelectedHospitalRoomRent(
  suggestedHospitals: SuggestedHospital[] | null | undefined,
  requestedHospitalName: string | null | undefined,
  requestedRoomType: string | null | undefined
): string | null {
  if (!requestedHospitalName?.trim() || !suggestedHospitals?.length) return null
  const selected = suggestedHospitals.find(
    (h) => h.hospitalName?.trim() === requestedHospitalName.trim()
  )
  if (!selected) return null
  const rt = (requestedRoomType || '').toLowerCase().replace(/\s+/g, ' ')
  if (rt.includes('single') && selected.roomRentSingle != null) return String(selected.roomRentSingle)
  if ((rt.includes('semi') || rt.includes('private')) && selected.roomRentSemiPrivate != null)
    return String(selected.roomRentSemiPrivate)
  if (rt.includes('deluxe') && selected.roomRentDeluxe != null) return String(selected.roomRentDeluxe)
  if (rt.includes('general') && selected.roomRentGeneral != null) return String(selected.roomRentGeneral)
  return selected.roomRentSingle != null
    ? String(selected.roomRentSingle)
    : selected.roomRentSemiPrivate != null
      ? String(selected.roomRentSemiPrivate)
      : selected.roomRentDeluxe != null
        ? String(selected.roomRentDeluxe)
        : selected.roomRentGeneral != null
          ? String(selected.roomRentGeneral)
          : null
}

function buildPreAuthHtml(params: {
  patientName: string
  preAuth: {
    insurance: string | null
    tpa: string | null
    sumInsured: string | null
    roomRent: string | null
    capping: string | null
    copay: string | null
    icu: string | null
    requestedHospitalName: string | null
    requestedRoomType: string | null
    diseaseDescription: string | null
  }
  imageDataUrls: Array<{ data: string; mime: string }>
  pdfBase64List: string[]
}): string {
  const { patientName, preAuth, imageDataUrls, pdfBase64List } = params
  const v = (s: string | null | undefined) => (s && String(s).trim()) || '—'
  const diseaseText = (preAuth.diseaseDescription && String(preAuth.diseaseDescription).trim()) || '—'
  const diseaseDisplay = escapeHtml(diseaseText.slice(0, 2000))

  const cards: Array<{ label: string; value: string; fullWidth?: boolean }> = [
    { label: 'Insurance', value: escapeHtml(v(preAuth.insurance)) },
    { label: 'TPA', value: escapeHtml(v(preAuth.tpa)) },
    { label: 'Sum Insured', value: escapeHtml(v(preAuth.sumInsured)) },
    { label: 'Room Rent', value: escapeHtml(v(preAuth.roomRent)) },
    { label: 'Capping', value: escapeHtml(v(preAuth.capping)) },
    { label: 'Copay', value: escapeHtml(v(preAuth.copay)) },
    { label: 'ICU', value: escapeHtml(v(preAuth.icu)) },
    { label: 'Requested Hospital', value: escapeHtml(v(preAuth.requestedHospitalName)) },
    { label: 'Requested Room Type', value: escapeHtml(v(preAuth.requestedRoomType)) },
    { label: 'Disease Description', value: diseaseDisplay, fullWidth: true },
  ]

  const cardHtml = cards
    .map(
      (c) =>
        `<div class="card${c.fullWidth ? ' card-full' : ''}"><div class="card-label">${escapeHtml(c.label)}</div><div class="card-value">${c.value}</div></div>`
    )
    .join('')

  const imagePages = imageDataUrls
    .map(
      (img) =>
        `<div class="page-break"><img src="data:${img.mime};base64,${img.data}" alt="Document" class="doc-image" /></div>`
    )
    .join('')

  const hasDocs = imageDataUrls.length > 0 || pdfBase64List.length > 0
  // Raw JSON in script[type=application/json]: pdfs are base64 from our fetch (no </script> in alphabet)
  const pdfJson = JSON.stringify({
    pdfs: pdfBase64List,
    imageDocCount: imageDataUrls.length,
  })

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Pre-Authorization Summary</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; font-size: 14px; line-height: 1.45; color: #1a1a1a; margin: 0; padding: 0; }
    .header-strip { background: #2563eb; padding: 18px 24px; margin: 0 0 0 0; }
    .header-title { font-size: 26px; font-weight: 700; color: #fff; margin: 0; }
    .patient-name { font-size: 28px; font-weight: 700; margin: 24px 24px 20px 24px; color: #0f172a; line-height: 1.2; }
    h2 { font-size: 17px; font-weight: 600; margin: 24px 24px 12px 24px; color: #334155; }
    .content { padding: 0 0 24px 0; }
    .preauth-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 0 24px; margin-bottom: 8px; }
    .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; background: #f8fafc; }
    .card-full { grid-column: 1 / -1; }
    .card-label { font-size: 12px; color: #64748b; margin-bottom: 6px; font-weight: 500; }
    .card-value { font-size: 15px; font-weight: 600; color: #0f172a; word-break: break-word; white-space: pre-wrap; }
    .page-break { page-break-before: always; padding-top: 24px; }
    .doc-image { max-width: 100%; height: auto; display: block; }
    .pdf-host canvas { max-width: 100%; height: auto; display: block; margin: 0 auto 16px auto; border: 1px solid #e2e8f0; }
    .print-button-container { padding: 16px 24px; text-align: center; }
    .print-button { padding: 12px 24px; font-size: 16px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
    .print-button:hover:not(:disabled) { background: #1d4ed8; }
    .print-button:disabled { opacity: 0.65; cursor: not-allowed; }
    .pdf-status { padding: 8px 24px; text-align: center; font-size: 14px; color: #475569; }
    @media print {
      body { padding: 0; }
      .header-strip { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page-break { page-break-before: always; }
      .print-button-container, .pdf-status { display: none; }
    }
  </style>
</head>
<body>
  <div class="header-strip">
    <p class="header-title">Pre-Authorization Summary</p>
  </div>
  <div class="content">
    <h1 class="patient-name">${escapeHtml(patientName)}</h1>
    <div class="preauth-grid">${cardHtml}</div>

    ${hasDocs ? '<h2>Documents &amp; Images</h2>' : ''}
    ${imagePages}
    <div id="pdf-pages-root" class="pdf-host"></div>
  </div>
  <p id="pdf-load-status" class="pdf-status" ${pdfBase64List.length === 0 ? 'style="display:none"' : ''}>Loading PDF documents…</p>
  <div class="print-button-container">
    <button type="button" class="print-button" id="print-btn" ${pdfBase64List.length > 0 ? 'disabled' : ''} onclick="window.print()">Print / Save as PDF</button>
  </div>
  <script id="preauth-pdf-data" type="application/json">${pdfJson}</script>
  <script type="module">
    (async function () {
      const dataEl = document.getElementById('preauth-pdf-data');
      const root = document.getElementById('pdf-pages-root');
      const statusEl = document.getElementById('pdf-load-status');
      const printBtn = document.getElementById('print-btn');
      if (!dataEl || !root) return;
      let pdfList = [];
      let imageDocCount = 0;
      try {
        const parsed = JSON.parse(dataEl.textContent || '{}');
        pdfList = parsed.pdfs || [];
        imageDocCount = parsed.imageDocCount || 0;
      } catch (e) {
        console.error(e);
      }
      if (pdfList.length === 0) {
        if (statusEl) statusEl.style.display = 'none';
        if (printBtn) printBtn.disabled = false;
        return;
      }
      function base64ToUint8Array(base64) {
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
      }
      try {
        const pdfjsLib = await import('https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.mjs');
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.mjs';
        const scale = 150 / 72;
        let pdfCanvasIndex = 0;
        for (let p = 0; p < pdfList.length; p++) {
          const data = base64ToUint8Array(pdfList[p]);
          const loadingTask = pdfjsLib.getDocument({ data });
          const pdf = await loadingTask.promise;
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const renderTask = page.render({ canvasContext: ctx, viewport });
            await renderTask.promise;
            const wrap = document.createElement('div');
            const needBreakBefore = imageDocCount > 0 || pdfCanvasIndex > 0;
            wrap.className = needBreakBefore ? 'page-break' : '';
            pdfCanvasIndex += 1;
            wrap.appendChild(canvas);
            root.appendChild(wrap);
          }
        }
      } catch (err) {
        console.error('PDF render failed', err);
        if (statusEl) {
          statusEl.textContent = 'Some PDFs could not be loaded for preview. Try refreshing.';
          statusEl.style.color = '#b91c1c';
        }
      } finally {
        if (statusEl) statusEl.style.display = 'none';
        if (printBtn) printBtn.disabled = false;
      }
    })();
  </script>
</body>
</html>`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!['INSURANCE', 'INSURANCE_HEAD', 'ADMIN', 'TESTER'].includes(user.role)) {
      return errorResponse('Forbidden: Only Insurance can view pre-auth print', 403)
    }

    const { id: leadId } = await params

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        kypSubmission: {
          include: {
            preAuthData: { include: { suggestedHospitals: true } },
          },
        },
      },
    })

    if (!lead || !lead.kypSubmission || !lead.kypSubmission.preAuthData) {
      return errorResponse('Pre-authorization not found', 404)
    }

    const kyp = lead.kypSubmission
    const preAuth = kyp.preAuthData!

    const docUrls: string[] = []
    if (kyp.insuranceCardFileUrl) docUrls.push(kyp.insuranceCardFileUrl)
    if (kyp.aadharFileUrl) docUrls.push(kyp.aadharFileUrl)
    if (kyp.panFileUrl) docUrls.push(kyp.panFileUrl)
    if (kyp.prescriptionFileUrl) docUrls.push(kyp.prescriptionFileUrl)
    pushJsonFileUrls(kyp.aadharFiles, docUrls)
    pushJsonFileUrls(kyp.panFiles, docUrls)
    pushJsonFileUrls(kyp.diseasePhotos, docUrls)
    pushJsonFileUrls(kyp.otherFiles, docUrls)
    pushJsonFileUrls(preAuth.diseaseImages, docUrls)
    pushJsonFileUrls(preAuth.investigationFileUrls, docUrls)
    pushJsonFileUrls(preAuth.prescriptionFiles, docUrls)

    const seen = new Set<string>()
    const uniqueUrls = docUrls.filter((u) => {
      if (!u || seen.has(u)) return false
      seen.add(u)
      return true
    })

    const imageDataUrls: Array<{ data: string; mime: string }> = []
    const pdfBase64List: string[] = []

    for (const url of uniqueUrls) {
      const fetched = await fetchUrlAsBase64(url)
      if (!fetched) continue
      const kind = classifyFetched(url, fetched.mime)
      if (kind === 'pdf') {
        pdfBase64List.push(fetched.data)
      } else if (kind === 'image') {
        imageDataUrls.push({ data: fetched.data, mime: fetched.mime })
      }
    }

    const suggestedHospitals = preAuth.suggestedHospitals ?? []
    const selectedRoomRent = getSelectedHospitalRoomRent(
      suggestedHospitals,
      preAuth.requestedHospitalName,
      preAuth.requestedRoomType
    )
    const roomRentDisplay =
      selectedRoomRent != null
        ? `₹${Number(selectedRoomRent).toLocaleString('en-IN')}`
        : preAuth.roomRent != null && preAuth.roomRent !== ''
          ? Number.isNaN(Number(preAuth.roomRent))
            ? String(preAuth.roomRent)
            : `₹${Number(preAuth.roomRent).toLocaleString('en-IN')}`
          : null
    const insuranceDisplay =
      (preAuth.insurance || lead.insuranceName || kyp.insuranceCard || null) ?? null

    const html = buildPreAuthHtml({
      patientName: lead.patientName || '—',
      preAuth: {
        insurance: insuranceDisplay,
        tpa: preAuth.tpa ?? null,
        sumInsured: preAuth.sumInsured ?? null,
        roomRent: roomRentDisplay,
        capping: preAuth.capping ? String(preAuth.capping) : null,
        copay: preAuth.copay ?? null,
        icu: preAuth.icu ?? null,
        requestedHospitalName: preAuth.requestedHospitalName ?? null,
        requestedRoomType: preAuth.requestedRoomType ?? null,
        diseaseDescription: preAuth.diseaseDescription ?? null,
      },
      imageDataUrls,
      pdfBase64List,
    })

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('Error generating pre-auth print view:', error)
    return errorResponse('Failed to generate pre-auth print view', 500)
  }
}
