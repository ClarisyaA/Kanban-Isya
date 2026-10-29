import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Cheap cookie check only; the page itself validates the session against the DB.
export function middleware(request: NextRequest) {
  const hasSession = !!getSessionCookie(request);
  const { pathname } = request.nextUrl;

  if (!hasSession && pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/"] };
