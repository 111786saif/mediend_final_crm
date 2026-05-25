/**
 * Resolve the base URL for cron routes that need to fetch a sibling API endpoint
 * from inside the running app.
 *
 * Why: in production we sit behind Nginx with an IP allowlist. If the app makes
 * an outbound HTTP request to its own public hostname, the request egresses
 * through the container's NAT'd IP — which isn't on the allowlist — and Nginx
 * returns an HTML 403 page. The receiving cron route then trips on `.json()`.
 *
 * Set `INTERNAL_API_URL=http://localhost:3000` in the prod env so internal
 * fetches stay on loopback inside the container. Falls back to public URL /
 * request origin / localhost in that order for dev and Vercel.
 */
export function getInternalBaseUrl(request: { url: string }): string {
  if (process.env.INTERNAL_API_URL) return process.env.INTERNAL_API_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  try {
    return new URL(request.url).origin
  } catch {
    return 'http://localhost:3000'
  }
}
