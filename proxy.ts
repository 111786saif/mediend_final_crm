import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { corsHeaders, resolveCorsOrigin } from "@/lib/cors";

export function proxy(request: NextRequest) {
  const origin = resolveCorsOrigin(request);
  const headers = corsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        ...headers,
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
