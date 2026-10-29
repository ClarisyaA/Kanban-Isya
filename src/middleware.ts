import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// On Vercel production, the app may also be reachable via per-deployment URLs
// (kanban-isya-abc123.vercel.app). Auth cookies and the Google callback live on the
// production domain, so send everyone there first.
const productionHost =
  process.env.VERCEL_ENV === "production" ? process.env.VERCEL_PROJECT_PRODUCTION_URL : undefined;

// Cheap cookie check only; the page itself validates the session against the DB.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (productionHost && request.nextUrl.host !== productionHost) {
    const url = request.nextUrl.clone();
    url.host = productionHost;
    url.protocol = "https:";
    url.port = "";
    return NextResponse.redirect(url);
  }

  const hasSession = !!getSessionCookie(request);
  if (!hasSession && pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/", "/login"] };
