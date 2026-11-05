'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  CheckCircle2,
  CreditCard,
  Bell,
  Settings,
  LogOut,
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.replace('/login');
      router.refresh();
    } catch {
      router.replace('/login');
    }
  }

  const navItems = [
    {
      label: 'Students',
      href: '/dashboard/students',
      icon: Users,
      active: pathname.startsWith('/dashboard/students'),
    },
    {
      label: 'Roll-Call',
      href: '/dashboard/attendance',
      icon: CheckCircle2,
      active: pathname.startsWith('/dashboard/attendance'),
    },
    {
      label: 'Fees',
      href: '/dashboard/fees',
      icon: CreditCard,
      active: pathname.startsWith('/dashboard/fees'),
    },
    {
      label: 'Notices',
      href: '/dashboard/notices',
      icon: Bell,
      active: pathname.startsWith('/dashboard/notices'),
    },
    {
      label: 'Settings',
      href: '/dashboard/settings',
      icon: Settings,
      active: pathname.startsWith('/dashboard/settings'),
    },
  ];

  return (
    <div className="dashboard-shell">
      {/* Top Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          paddingBottom: '16px',
          marginBottom: '16px',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <span className="eyebrow" style={{ margin: 0 }}>Instructor Portal</span>
            <h1 style={{ fontSize: '1.3rem', margin: 0 }}>STSK Academy</h1>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="desktop-nav" aria-label="Desktop instructor navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`desktop-nav-item ${item.active ? 'active' : ''}`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link
            href="/"
            target="_blank"
            style={{
              color: 'var(--muted)',
              fontSize: '0.85rem',
              textDecoration: 'none',
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid var(--line)',
            }}
          >
            Public Notice Board ↗
          </Link>
          <button
            onClick={handleLogout}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'transparent',
              border: '1px solid var(--line)',
              borderRadius: '8px',
              padding: '6px 12px',
              cursor: 'pointer',
              color: 'var(--muted)',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
            title="Sign out"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main View Area */}
      <main className="dashboard-main">{children}</main>

      {/* Bottom Thumb Navigation Dock for Mobile Devices */}
      <nav className="dock-nav" aria-label="Instructor navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`dock-item ${item.active ? 'active' : ''}`}
            >
              <Icon />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
