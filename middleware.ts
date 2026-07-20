import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE, getUserFromToken } from '@/lib/auth-session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith('/auth');
  const isAuthApi = pathname.startsWith('/api/auth');

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
