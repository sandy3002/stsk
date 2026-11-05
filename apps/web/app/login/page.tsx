'use client';

import { useState, useEffect, Suspense, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function sanitizeRedirect(param: string | null): string {
  if (!param) return '/dashboard/students';
  // SWARM-SEC-008: Validate safe relative URL, preventing open redirect exploits
  if (
    !param.startsWith('/') ||
    param.startsWith('//') ||
    param.startsWith('/\\') ||
    param.includes('://')
  ) {
    return '/dashboard/students';
  }
  // Prevent circular loops
  if (param.startsWith('/login') || param === '/dashboard' || param === '/dashboard/') {
    return '/dashboard/students';
  }
  return param;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const targetPath = sanitizeRedirect(searchParams.get('redirect'));

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // If already authenticated, skip login and jump straight to the dashboard
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (res.ok) {
          window.location.href = targetPath;
        }
      })
      .catch(() => {});
  }, [targetPath]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || 'Invalid username or password');
      }

      // Perform a full browser location update so the mobile browser guarantees cookie persistence
      // and transmits it on the initial GET request to /dashboard/students.
      window.location.href = targetPath;
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Login failed');
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="eyebrow" style={{ margin: 0 }}>Shotokan Karate</p>
        <Link href="/" style={{ color: 'var(--muted)', fontSize: '0.85rem', textDecoration: 'none' }}>
          &larr; Public Notices
        </Link>
      </div>
      <h1 style={{ marginTop: '12px' }}>Instructor Login</h1>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '4px' }}>
        Sign in to manage roll-call attendance, tuition records, and student profiles.
      </p>

      <form onSubmit={handleSubmit} className="auth-form">
        <label>
          Username
          <input
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
            disabled={loading}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            disabled={loading}
          />
        </label>

        {errorMessage && (
          <div
            style={{
              background: '#fee2e2',
              color: '#991b1b',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.9rem',
              border: '1px solid #fecaca',
            }}
          >
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          className="primary-button"
          style={{ width: '100%', minHeight: '48px', fontSize: '1rem', marginTop: '8px' }}
          disabled={loading}
        >
          {loading ? 'Authenticating & Opening Dashboard...' : 'Sign In to Dashboard'}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <Suspense fallback={<div className="auth-card"><p>Loading...</p></div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
