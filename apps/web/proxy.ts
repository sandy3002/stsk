import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE_NAME } from '@/lib/session';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow public authentication endpoints
  if (pathname === '/api/auth/login') {
    return NextResponse.next();
  }

  // 2. Allow public notices GET requests
  if (pathname === '/api/notices' && request.method === 'GET') {
    return NextResponse.next();
  }

  // 3. Extract session token from cookie (or Authorization header as fallback)
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : null;
  const token = cookie || bearerToken;

  const session = token ? await verifySession(token) : null;

  // 4. If already authenticated and visiting /login, redirect directly to dashboard
  if (pathname === '/login') {
    if (session) {
      return NextResponse.redirect(new URL('/dashboard/students', request.url));
    }
    return NextResponse.next();
  }

  // 5. Handle API routes
  if (pathname.startsWith('/api/')) {
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized: Valid session required' },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // 6. Handle protected dashboard pages
  if (pathname.startsWith('/dashboard')) {
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*', '/login'],
};
