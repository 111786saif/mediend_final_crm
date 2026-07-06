import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import fs from 'fs/promises'
import path from 'path'

const PLACEHOLDER_CREDENTIALS = new Set(['...', 'your-access-key', 'your-secret-key', ''])

function isS3Configured(): boolean {
  const bucket = process.env.AWS_S3_BUCKET_NAME?.trim()
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim()
  if (!bucket || !accessKeyId || !secretAccessKey) return false
  if (PLACEHOLDER_CREDENTIALS.has(accessKeyId) || PLACEHOLDER_CREDENTIALS.has(secretAccessKey)) {
    return false
  }
  return true
}

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || ''

export interface UploadFileResult {
  url: string
  key: string
}

function buildObjectKey(folder: string, fileName: string): string {
  const timestamp = Date.now()
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
  return `${folder}/${timestamp}-${sanitizedFileName}`
}

async function uploadFileLocally(
  file: Buffer,
  fileName: string,
  folder: string
): Promise<UploadFileResult> {
  const key = buildObjectKey(folder, fileName)
  const relativePath = key.replace(/\//g, path.sep)
  const absoluteDir = path.join(process.cwd(), 'public', 'uploads', folder)
  const absolutePath = path.join(process.cwd(), 'public', 'uploads', relativePath)

  await fs.mkdir(absoluteDir, { recursive: true })
  await fs.writeFile(absolutePath, file)

  return {
    url: `/uploads/${key.replace(/\\/g, '/')}`,
    key,
  }
}

/**
 * Upload a file to S3
 */
export async function uploadFileToS3(
  file: Buffer,
  fileName: string,
  folder: string = 'kyp'
): Promise<UploadFileResult> {
  if (!isS3Configured()) {
    if (process.env.NODE_ENV === 'development') {
      return uploadFileLocally(file, fileName, folder)
    }
    throw new Error(
      'File upload is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET_NAME, and AWS_REGION in .env'
    )
  }

  const key = buildObjectKey(folder, fileName)

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: getContentType(fileName),
  })

  await s3Client.send(command)

  const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`

  return { url, key }
}

/**
 * Get a presigned URL for downloading a file
 */
export async function getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  return await getSignedUrl(s3Client, command, { expiresIn })
}

/**
 * Get content type from file extension
 */
function getContentType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase()
  const contentTypes: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }
  return contentTypes[ext || ''] || 'application/octet-stream'
}
