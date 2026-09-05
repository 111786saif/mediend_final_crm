import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params: _params }: { params: Promise<{ token: string }> }
) {
  // Legacy gateway URLs are deliberately invalidated. QR codes now contain a
  // direct, three-minute contact URL and an expired link must never mint another.
  void _params
  return NextResponse.redirect(new URL('/lead-contact/expired', request.url))
}
