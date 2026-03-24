import { useState } from 'react'
import { apiPost } from '@/lib/api-client'
import { KYP_UPLOAD_MAX_BYTES } from '@/lib/upload-limits'
import { toast } from 'sonner'

interface UploadFileResult {
  url: string
  key: string
}

interface UseFileUploadOptions {
  folder?: string
  /** Custom upload endpoint. Use for home-banners (any user) instead of default kyp/upload (leads:write). */
  endpoint?: string
  /** Reject files larger than this (bytes). Default 20 MB. */
  maxFileSizeBytes?: number
  onSuccess?: (result: UploadFileResult) => void
  onError?: (error: Error) => void
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const uploadFile = async (file: File): Promise<UploadFileResult | null> => {
    if (!file) {
      toast.error('No file selected')
      return null
    }

    const maxBytes = options.maxFileSizeBytes ?? KYP_UPLOAD_MAX_BYTES
    if (file.size > maxBytes) {
      const mb = maxBytes / (1024 * 1024)
      const mbLabel = Number.isInteger(mb) ? String(mb) : mb.toFixed(1).replace(/\.0$/, '')
      toast.error(`File too large (max ${mbLabel} MB): ${file.name}`)
      return null
    }

    setUploading(true)
    setProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (options.folder) {
        formData.append('folder', options.folder)
      }

      const uploadEndpoint = options.endpoint ?? '/api/kyp/upload'
      const result = await apiPost<UploadFileResult>(uploadEndpoint, formData)

      setProgress(100)
      options.onSuccess?.(result)
      toast.success('File uploaded successfully')
      return result
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to upload file')
      options.onError?.(err)
      toast.error(err.message || 'Failed to upload file')
      return null
    } finally {
      setUploading(false)
      setTimeout(() => setProgress(0), 1000)
    }
  }

  const uploadMultipleFiles = async (
    files: File[]
  ): Promise<(UploadFileResult | null)[]> => {
    const results = await Promise.all(files.map((file) => uploadFile(file)))
    return results
  }

  return {
    uploadFile,
    uploadMultipleFiles,
    uploading,
    progress,
  }
}
