export const INVOICE_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024

export const INVOICE_ATTACHMENT_ACCEPT =
  'application/pdf,.pdf,image/jpeg,image/jpg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif'

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])

export function isAllowedInvoiceAttachment(file: Pick<File, 'name' | 'type'>): boolean {
  const lowerName = file.name.toLowerCase()
  if (file.type && ALLOWED_MIME_TYPES.has(file.type)) return true
  if (lowerName.endsWith('.pdf')) return true
  return Array.from(IMAGE_EXTENSIONS).some((ext) => lowerName.endsWith(ext))
}

export function isInvoiceImageUrl(urlOrName: string | null | undefined): boolean {
  if (!urlOrName) return false
  const lower = urlOrName.toLowerCase()
  return IMAGE_EXTENSIONS.has(lower.slice(lower.lastIndexOf('.'))) || lower.includes('image/')
}
