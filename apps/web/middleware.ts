import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') || '';
  const isMobile = /mobile|android|iphone|ipad|phone/i.test(userAgent);

  console.log('📱 Middleware userAgent:', userAgent);
  
  const { pathname } = request.nextUrl;
  
  // Skip middleware for static files, API routes, and _next
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') // static files
  ) {
    return NextResponse.next();
  }

  console.log('🔍 Middleware:', { pathname, isMobile, userAgent: userAgent.substring(0, 50) });

  // If mobile device and not on /mobile route, redirect to mobile
  if (isMobile && !pathname.startsWith('/mobile')) {
    const url = request.nextUrl.clone();
    url.pathname = `/mobile${pathname}`;
    console.log('📱 Redirecting to mobile:', url.pathname);
    return NextResponse.redirect(url);
  }

  // If desktop device and on /mobile route, redirect to desktop
  if (!isMobile && pathname.startsWith('/mobile')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace('/mobile', '') || '/';
    console.log('💻 Redirecting to desktop:', url.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * 1. /api (API routes)
     * 2. /_next (Next.js internals)
     * 3. /static (static files)
     * 4. all root files inside /public (e.g. /favicon.ico)
     */
    '/((?!api|_next|static|.*\\..*|favicon.ico).*)',
  ],
};
