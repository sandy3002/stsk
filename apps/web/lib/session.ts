import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export const SESSION_COOKIE_NAME = 'stsk_session';

export interface SessionPayload extends JWTPayload {
  sub: string;
  username: string;
  role: 'admin';
}

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new Error(
      'FATAL: SESSION_SECRET or JWT_SECRET must be configured with at least 32 characters.'
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Signs an Edge-compatible JWT session token.
 * Defaults to 7-day expiration.
 */
export async function signSession(
  payload: Omit<SessionPayload, 'iat' | 'exp'>,
  expiresIn: string = '7d'
): Promise<string> {
  const key = getSecretKey();
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

/**
 * Verifies an Edge-compatible JWT session token.
 * Returns decoded payload if valid, null otherwise.
 */
export async function verifySession(token: string): Promise<SessionPayload | null> {
  if (!token || typeof token !== 'string') return null;

  try {
    const key = getSecretKey();
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
    });
    return payload as SessionPayload;
  } catch (err) {
    console.warn('[Session] Token verification failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
