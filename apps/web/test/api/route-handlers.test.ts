import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

process.env.SESSION_SECRET = 'test-secret-that-is-at-least-32-characters-long-1234567890';

import { signSession, verifySession, SESSION_COOKIE_NAME } from '@/lib/session';
import { proxy as middleware } from '@/proxy';

describe('Edge Session Auth & Middleware Integration', () => {
  const adminPayload = {
    sub: '507f1f77bcf86cd799439011',
    username: 'admin',
    role: 'admin' as const,
  };

  it('signs and verifies a valid JWT session token', async () => {
    const token = await signSession(adminPayload);
    expect(typeof token).toBe('string');

    const decoded = await verifySession(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.sub).toBe(adminPayload.sub);
    expect(decoded?.username).toBe(adminPayload.username);
    expect(decoded?.role).toBe('admin');
  });

  it('returns null when verifying an invalid or tampered token', async () => {
    const decoded = await verifySession('tampered.invalid.token');
    expect(decoded).toBeNull();
  });

  describe('Middleware Route Protection', () => {
    it('bypasses /api/auth/login unconditionally', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
      });
      const response = await middleware(request);
      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
    });

    it('bypasses GET /api/notices without authentication', async () => {
      const request = new NextRequest('http://localhost:3000/api/notices', {
        method: 'GET',
      });
      const response = await middleware(request);
      expect(response.status).toBe(200);
    });

    it('rejects unauthenticated API requests with HTTP 401 JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET',
      });
      const response = await middleware(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('redirects unauthenticated /dashboard requests to /login', async () => {
      const request = new NextRequest('http://localhost:3000/dashboard/attendance', {
        method: 'GET',
      });
      const response = await middleware(request);
      expect(response.status).toBe(307); // NextResponse.redirect
      const location = response.headers.get('location');
      expect(location).toContain('/login?redirect=%2Fdashboard%2Fattendance');
    });

    it('allows authenticated requests with valid session cookie to /dashboard', async () => {
      const token = await signSession(adminPayload);
      const request = new NextRequest('http://localhost:3000/dashboard/attendance', {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
      });
      const response = await middleware(request);
      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
    });

    it('allows authenticated requests with valid session cookie to /api/students', async () => {
      const token = await signSession(adminPayload);
      const request = new NextRequest('http://localhost:3000/api/students', {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
      });
      const response = await middleware(request);
      expect(response.status).toBe(200);
    });

    it('throws error when signing session with secret under 32 characters', async () => {
      const origSecret = process.env.SESSION_SECRET;
      process.env.SESSION_SECRET = 'short-secret';
      try {
        await expect(signSession(adminPayload)).rejects.toThrow('FATAL: SESSION_SECRET or JWT_SECRET must be configured with at least 32 characters');
      } finally {
        process.env.SESSION_SECRET = origSecret;
      }
    });
  });
});
