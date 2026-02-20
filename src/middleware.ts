import { NextRequest, NextResponse } from "next/server";

// Routes that don't require session authentication
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/trigger"];

function isPublicPath(pathname: string): boolean {
  // Exact matches for known public paths
  if (PUBLIC_PATHS.includes(pathname)) return true;

  // /read/[chunkId] routes use token auth from emails
  if (pathname.startsWith("/read/")) return true;

  // Chunk audio API uses its own token validation
  if (/^\/api\/chunks\/[^/]+\/audio$/.test(pathname)) return true;

  // API auth routes
  if (pathname === "/api/auth/logout") return true;

  return false;
}

async function computeHmac(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message)
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths through
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) {
    // If AUTH_SECRET isn't set, allow through (dev convenience)
    return NextResponse.next();
  }

  const session = request.cookies.get("session")?.value;

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const expected = await computeHmac(authSecret, "authenticated");
  if (session !== expected) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - Public assets
     */
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt).*)",
  ],
};
