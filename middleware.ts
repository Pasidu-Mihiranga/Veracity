import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE, getUserFromToken } from '@/lib/auth-session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith('/auth');
  const isAuthApi = pathname.startsWith('/api/auth');
  const isApiRoute = pathname.startsWith('/api/');

  // CSRF Protection: Validate Origin/Referer header for unsafe methods on API endpoints
  if (isApiRoute && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return new NextResponse(JSON.stringify({ success: false, error: { code: 'CSRF_BLOCKED', message: 'Cross-origin request blocked' } }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch {
        // Invalid origin header
        return new NextResponse(JSON.stringify({ success: false, error: { code: 'CSRF_BLOCKED', message: 'Invalid origin header' } }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
  }

  if (isAuthApi) {
    return NextResponse.next();
  }

  const user = await getUserFromToken(request.cookies.get(AUTH_COOKIE)?.value);

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth';
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip static assets — avif must be listed or /logo-text.avif redirects to /auth
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)',
  ],
};
