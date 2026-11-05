import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectDB } from '@/lib/db';
import { User } from '@/lib/models/user';
import { verifyPassword, hashPassword } from '@/lib/auth';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/session';

// SWARM-SEC-006: In-memory sliding window rate limiter
interface RateLimitEntry {
  attempts: number;
  resetAt: number;
}
const loginRateLimit = new Map<string, RateLimitEntry>();
const MAX_FAILED_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginRateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    return true; // allowed
  }
  return entry.attempts < MAX_FAILED_ATTEMPTS;
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const entry = loginRateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    loginRateLimit.set(ip, { attempts: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else {
    entry.attempts += 1;
  }
}

function resetRateLimit(ip: string): void {
  loginRateLimit.delete(ip);
}

export async function POST(request: Request) {
  try {
    const forwardedFor = request.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';

    // Rate limiting check
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        { error: 'Too many failed login attempts. Please wait 1 minute before trying again.' },
        { status: 429 }
      );
    }

    await connectDB();

    const body = await request.json().catch(() => null);
    if (!body || !body.username || !body.password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const username = String(body.username).trim().toLowerCase();
    const password = String(body.password);

    // SWARM-SEC-002: Load admin credentials without hardcoded insecure fallbacks
    const envAdminUser = process.env.ADMIN_USERNAME?.trim().toLowerCase();
    const envAdminPass = process.env.ADMIN_PASSWORD;

    let user = await User.findOne({ username });

    // Initial provision only if the users collection is empty and valid credentials are in .env
    if (!user) {
      const userCount = await User.countDocuments();
      if (
        userCount === 0 &&
        envAdminUser &&
        envAdminPass &&
        username === envAdminUser &&
        password === envAdminPass
      ) {
        const hash = await hashPassword(envAdminPass);
        try {
          user = await User.create({
            username: envAdminUser,
            passwordHash: hash,
            role: 'admin',
          });
        } catch (err: any) {
          // SWARM-CONC-002: Catch concurrent auto-seed race condition (E11000) and query created user
          if (err?.code === 11000) {
            user = await User.findOne({ username });
          } else {
            throw err;
          }
        }
      } else {
        recordFailedAttempt(clientIp);
        return NextResponse.json(
          { error: 'Invalid username or password' },
          { status: 401 }
        );
      }
    }

    if (!user) {
      recordFailedAttempt(clientIp);
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Verify password via bcrypt against the database record
    const passwordMatch = await verifyPassword(password, user.passwordHash);

    if (!passwordMatch) {
      recordFailedAttempt(clientIp);
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Successful login: reset rate limit for this IP
    resetRateLimit(clientIp);

    // Sign session token (7 days)
    const token = await signSession({
      sub: user._id.toString(),
      username: user.username,
      role: 'admin',
    });

    const isHttps = request.url.startsWith('https://');

    // Set cookie via Next.js cookies context
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Set cookie on outgoing NextResponse object
    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error('Error during login:', error);
    return NextResponse.json(
      { error: 'Internal server error during authentication' },
      { status: 500 }
    );
  }
}
