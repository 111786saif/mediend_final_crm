/** Append ?returnTo= so sub-pages can navigate back to the originating list. */
export function appendReturnTo(href: string, returnTo: string): string {
  const [path, query = ''] = href.split('?')
  const params = new URLSearchParams(query)
  params.set('returnTo', returnTo)
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

/** Safe return path from query string; ignores external URLs. */
export function resolveReturnTo(
  searchParams: Pick<URLSearchParams, 'get'> | null | undefined,
): string | null {
  const raw = searchParams?.get('returnTo')
  if (typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//')) {
    return raw
  }
  return null
}

export function hrefWithReturnTo(href: string, returnTo: string | null | undefined): string {
  return returnTo ? appendReturnTo(href, returnTo) : href
}
