'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Search, ChevronLeft, ChevronRight, Check, History, X, DollarSign } from 'lucide-react';
import type { TuitionStatus, PaymentMethod } from '@/lib/types';

interface StudentTuitionItem {
  studentId: string;
  name: string;
  beltRank: string;
  phone?: string;
  billingMonth: string;
  status: TuitionStatus;
  amount?: number;
  paymentMethod?: PaymentMethod;
  paidAt?: string;
  recordId?: string;
}

interface TuitionResponse {
  billingMonth: string;
  roster: StudentTuitionItem[];
}

interface PaymentHistoryItem {
  _id: string;
  billingMonth: string;
  status: TuitionStatus;
  amount?: number;
  paymentMethod?: PaymentMethod;
  paidAt?: string;
  notes?: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP error ${res.status}`);
  }
  return res.json();
};

export default function FeesPage() {
  // Current month in 'YYYY-MM' format
  const [currentMonth, setCurrentMonth] = useState(() => {
    return new Date().toISOString().substring(0, 7);
  });
  const [search, setSearch] = useState('');

  // Payment history modal state
  const [historyStudent, setHistoryStudent] = useState<StudentTuitionItem | null>(null);
  const [historyData, setHistoryData] = useState<PaymentHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Fetch tuition roster for currentMonth
  const { data, error, mutate, isLoading } = useSWR<TuitionResponse>(
    `/api/tuition?month=${currentMonth}`,
    fetcher
  );

  const roster = data?.roster || [];

  // Navigate months
  function changeMonth(delta: number) {
    const [yStr, mStr] = currentMonth.split('-');
    let year = parseInt(yStr, 10);
    let month = parseInt(mStr, 10) + delta;

    if (month > 12) {
      year += 1;
      month = 1;
    } else if (month < 1) {
      year -= 1;
      month = 12;
    }

    const nextMonth = `${year}-${String(month).padStart(2, '0')}`;
    setCurrentMonth(nextMonth);
  }

  // Format month for display
  const monthDisplayName = useMemo(() => {
    const [year, month] = currentMonth.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [currentMonth]);

  // Toggle paid/unpaid status
  async function handleToggleStatus(item: StudentTuitionItem) {
    const nextStatus: TuitionStatus = item.status === 'paid' ? 'unpaid' : 'paid';

    // Optimistic update
    mutate(
      (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          roster: prev.roster.map((s) =>
            s.studentId === item.studentId ? { ...s, status: nextStatus } : s
          ),
        };
      },
      false
    );

    try {
      const response = await fetch('/api/tuition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: item.studentId,
          billingMonth: currentMonth,
          status: nextStatus,
          paymentMethod: nextStatus === 'paid' ? 'cash' : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update tuition status');
      }

      await mutate();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error toggling tuition');
      await mutate();
    }
  }

  // View payment history
  async function openHistory(item: StudentTuitionItem) {
    setHistoryStudent(item);
    setLoadingHistory(true);
    setHistoryData([]);

    try {
      const res = await fetch(`/api/tuition/${item.studentId}`);
      if (res.ok) {
        const json = await res.json();
        setHistoryData(json);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }

  // Instant client-side search filtering (<5ms)
  const filteredRoster = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter((item) => item.name.toLowerCase().includes(q));
  }, [roster, search]);

  // Tally counts
  const stats = useMemo(() => {
    let paid = 0;
    let unpaid = 0;
    for (const item of roster) {
      if (item.status === 'paid') paid++;
      else unpaid++;
    }
    return { paid, unpaid, total: roster.length };
  }, [roster]);

  return (
    <div>
      {/* Global Month Switcher */}
      <div className="month-switcher">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          className="month-nav-btn"
          aria-label="Previous Month"
        >
          <ChevronLeft size={20} />
        </button>

        <div style={{ textAlign: 'center' }}>
          <span className="eyebrow" style={{ margin: 0 }}>Tuition Cycle</span>
          <div className="month-label">{monthDisplayName}</div>
        </div>

        <button
          type="button"
          onClick={() => changeMonth(1)}
          className="month-nav-btn"
          aria-label="Next Month"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Quick Summary Pill Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            background: 'var(--success-soft)',
            color: 'var(--success)',
            borderRadius: '10px',
            padding: '10px',
            textAlign: 'center',
            fontWeight: 700,
          }}
        >
          Paid: {stats.paid} of {stats.total}
        </div>
        <div
          style={{
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: '10px',
            padding: '10px',
            textAlign: 'center',
            fontWeight: 700,
          }}
        >
          Unpaid: {stats.unpaid}
        </div>
      </div>

      {/* Sticky Top Instant Search Header */}
      <div className="sticky-header">
        <div className="search-input-wrapper">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            className="search-input"
            placeholder="Search students in tuition ledger (<5ms)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tuition Roster */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
          Loading tuition ledger for {monthDisplayName}...
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#ef4444' }}>
          Failed to load tuition records.
        </div>
      ) : filteredRoster.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '48px 24px', marginTop: '16px' }}>
          <p style={{ color: 'var(--muted)' }}>No student records for this month.</p>
        </div>
      ) : (
        <div className="card-list">
          {filteredRoster.map((item) => {
            const isPaid = item.status === 'paid';

            return (
              <div key={item.studentId} className="touch-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                      {item.name}
                    </h3>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '2px' }}>
                      🥋 {item.beltRank} Belt
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(item)}
                      className={`btn-fee-toggle ${isPaid ? 'paid' : 'unpaid'}`}
                      aria-label={`Toggle tuition for ${item.name}`}
                    >
                      {isPaid ? (
                        <>
                          <Check size={18} />
                          <span>PAID</span>
                        </>
                      ) : (
                        <span>UNPAID</span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => openHistory(item)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--line)',
                        borderRadius: '8px',
                        padding: '12px',
                        cursor: 'pointer',
                        color: 'var(--muted)',
                        minHeight: '48px',
                      }}
                      title="View payment history"
                      aria-label={`View history for ${item.name}`}
                    >
                      <History size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Payment History Modal */}
      {historyStudent && (
        <div className="modal-backdrop" onClick={() => setHistoryStudent(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <span className="eyebrow" style={{ margin: 0 }}>Ledger History</span>
                <h2 style={{ margin: 0 }}>{historyStudent.name}</h2>
              </div>
              <button
                onClick={() => setHistoryStudent(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {loadingHistory ? (
              <p style={{ color: 'var(--muted)', padding: '24px 0', textAlign: 'center' }}>
                Loading ledger records...
              </p>
            ) : historyData.length === 0 ? (
              <p style={{ color: 'var(--muted)', padding: '24px 0', textAlign: 'center' }}>
                No prior monthly payments recorded in the ledger yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '60vh', overflowY: 'auto' }}>
                {historyData.map((h) => {
                  const paid = h.status === 'paid';
                  return (
                    <div
                      key={h._id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: '#f8fafc',
                        border: '1px solid var(--line)',
                      }}
                    >
                      <div>
                        <strong>{h.billingMonth}</strong>
                        {h.paidAt && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                            Paid on: {new Date(h.paidAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: paid ? 'var(--success-soft)' : '#fee2e2',
                          color: paid ? 'var(--success)' : '#991b1b',
                          textTransform: 'uppercase',
                        }}
                      >
                        {h.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
