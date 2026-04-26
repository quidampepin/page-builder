/**
 * Basic-auth gate for Vercel deployments.
 *
 * Middleware runs on every request before any route. If
 * BASIC_AUTH_USER and BASIC_AUTH_PASS are set in env, the request must
 * carry a valid `Authorization: Basic <base64>` header — browsers
 * provide this automatically after the user fills in the native HTTP
 * auth dialog, and they cache it for the session.
 *
 * If the env vars are NOT set, the middleware is a no-op. That keeps
 * local dev frictionless: `npm run dev` works without auth, and you
 * choose whether to enable the gate on Vercel by setting the vars in
 * the project's environment variables.
 *
 * Edge runtime: the file uses `atob` (built-in) and avoids Node-only
 * APIs, so it runs on Vercel Edge — same place as Next's default
 * middleware execution. No extra config needed.
 *
 * Why HTTP Basic and not a login form?
 *   • One file, ~25 lines. No UI to build, no session cookie to mint.
 *   • Browsers handle the dialog and re-send creds on every request.
 *   • Good enough to keep a private prototype off Google's index and
 *     stop random URL-finders from burning your Anthropic credits.
 *   • Not good enough for sensitive data — creds travel base64'd in
 *     headers, only safe over HTTPS (Vercel terminates HTTPS, so OK).
 */

import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPass = process.env.BASIC_AUTH_PASS;

  // No creds configured → no gate. This is the explicit opt-in: you
  // only enable the gate by setting both env vars on Vercel.
  if (!expectedUser || !expectedPass) {
    return NextResponse.next();
  }

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    // The header is "Basic <base64(user:pass)>". Decode and split on
    // the FIRST colon — passwords are allowed to contain colons.
    const decoded = atob(header.slice(6));
    const colonIdx = decoded.indexOf(":");
    if (colonIdx !== -1) {
      const user = decoded.slice(0, colonIdx);
      const pass = decoded.slice(colonIdx + 1);
      if (user === expectedUser && pass === expectedPass) {
        return NextResponse.next();
      }
    }
  }

  // No / wrong creds → 401 with WWW-Authenticate triggers the browser's
  // native login dialog. The realm string is what shows in the prompt
  // ("Sign in to <realm>"); pick something the user will recognize.
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="GC Page Builder", charset="UTF-8"',
    },
  });
}

/**
 * Restrict middleware to actual app routes. Skipping `_next/*` and
 * static assets means:
 *   • Faster — no middleware overhead on every CSS/JS chunk.
 *   • Saves Vercel function invocations on the free tier.
 *
 * The browser still sends the auth header on those requests once the
 * user has signed in, so security is unchanged: an unauthenticated
 * visitor can't reach any app route, and the app routes are what
 * matter (the JS bundles by themselves are useless without API access).
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
