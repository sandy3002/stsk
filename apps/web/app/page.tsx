'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
).replace(/\/$/, '');

type StudentStatus = 'passed' | 'failed' | 'pending';

type StudentRecord = {
  _id?: string;
  id?: string;
  name: string;
  beltRank?: string;
  nextExamDate?: string;
  classesRequired: number;
  classesAttended: number;
  classesRemaining?: number;
  status: StudentStatus;
};

const initialStudents: StudentRecord[] = [
  {
    name: 'Aarav Singh',
    beltRank: 'Yellow Belt',
    status: 'passed',
    nextExamDate: '2026-10-20',
    classesRequired: 10,
    classesAttended: 7,
  },
  {
    name: 'Maya Patel',
    beltRank: 'Orange Belt',
    status: 'failed',
    nextExamDate: '2026-10-27',
    classesRequired: 12,
    classesAttended: 4,
  },
  {
    name: 'Daniel Kim',
    beltRank: 'Green Belt',
    status: 'passed',
    nextExamDate: '2026-11-03',
    classesRequired: 8,
    classesAttended: 6,
  },
];

const emptyStudentForm = {
  name: '',
  beltRank: '',
  nextExamDate: '',
  classesRequired: '10',
  classesAttended: '0',
  status: 'pending' as StudentStatus,
};

export default function Home() {
  const [students, setStudents] = useState(initialStudents);
  const [role, setRole] = useState<'admin' | 'viewer' | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyStudentForm);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('stsk-token');

    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAuthChecked(true);
      return () => {
        cancelled = true;
      };
    }

    async function loadAuthenticatedDashboard() {
      let authenticated = false;

      try {
        const response = await fetch(`${apiUrl}/auth/me`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error('Your session has expired. Please sign in again.');
        }

        const user = await response.json();
        if (cancelled) return;
        setRole(user.role);
        authenticated = true;
      } catch (error) {
        if (cancelled) return;
        localStorage.removeItem('stsk-token');
        setRole(null);
        setMessage(error instanceof Error ? error.message : 'Could not verify your session.');
      }

      if (authenticated) {
        try {
          const response = await fetch(`${apiUrl}/students`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!response.ok) {
            throw new Error('Could not load student records.');
          }

          const records: StudentRecord[] = await response.json();
          if (!cancelled) setStudents(records);
        } catch (error) {
          if (!cancelled) {
            setMessage(error instanceof Error ? error.message : 'Could not load student records.');
          }
        }
      }

      if (!cancelled) setAuthChecked(true);
    }

    void loadAuthenticatedDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreateStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = localStorage.getItem('stsk-token');

    if (!token) {
      setMessage('Please sign in again before adding a student.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const response = await fetch(`${apiUrl}/students`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name.trim(),
          beltRank: form.beltRank.trim() || undefined,
          nextExamDate: form.nextExamDate || undefined,
          classesRequired: Number(form.classesRequired),
          classesAttended: Number(form.classesAttended),
          status: form.status,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Could not add student.');
      }

      setStudents((current) => [result, ...current]);
      setForm(emptyStudentForm);
      setFormOpen(false);
      setMessage(`${result.name} was added.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add student.');
    } finally {
      setSaving(false);
    }
  }

  const passedCount = students.filter((student) => student.status === 'passed').length;
  const failedCount = students.filter((student) => student.status === 'failed').length;
  const nextExamDate = students
    .map((student) => student.nextExamDate)
    .filter((date): date is string => Boolean(date))
    .sort()[0];

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Karate exam dashboard</p>
          <h1>Student progress overview</h1>
        </div>
        {authChecked && role === 'admin' ? (
          <button
            aria-expanded={formOpen}
            className="primary-button student-add-button"
            onClick={() => {
              setFormOpen((open) => !open);
              setMessage('');
            }}
            type="button"
          >
            <span aria-hidden="true" className="plus-icon">+</span>
            Add student details
          </button>
        ) : authChecked && role === 'viewer' ? (
          <span className="role-label">Viewer access</span>
        ) : authChecked ? (
          <Link className="primary-button" href="/login">
            Admin login
          </Link>
        ) : null}
      </header>

      <section className="stats-grid">
        <article className="stat-card">
          <span>Total students</span>
          <strong>{students.length}</strong>
        </article>
        <article className="stat-card">
          <span>Passed</span>
          <strong>{passedCount}</strong>
        </article>
        <article className="stat-card">
          <span>Failed</span>
          <strong>{failedCount}</strong>
        </article>
        <article className="stat-card">
          <span>Next exam</span>
          <strong>{nextExamDate ?? '—'}</strong>
        </article>
      </section>

      {formOpen && role === 'admin' ? (
        <section aria-labelledby="student-form-title" className="student-entry">
          <div className="student-entry-header">
            <h2 id="student-form-title">Add student details</h2>
            <button
              className="secondary-button"
              onClick={() => setFormOpen(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
          <form className="student-form" onSubmit={handleCreateStudent}>
            <label>
              Student name
              <input
                autoComplete="name"
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                value={form.name}
              />
            </label>
            <label>
              Belt rank
              <input
                onChange={(event) => setForm({ ...form, beltRank: event.target.value })}
                placeholder="e.g. Yellow Belt"
                value={form.beltRank}
              />
            </label>
            <label>
              Next exam date
              <input
                onChange={(event) => setForm({ ...form, nextExamDate: event.target.value })}
                type="date"
                value={form.nextExamDate}
              />
            </label>
            <label>
              Classes required
              <input
                min="0"
                onChange={(event) => setForm({ ...form, classesRequired: event.target.value })}
                required
                type="number"
                value={form.classesRequired}
              />
            </label>
            <label>
              Classes attended
              <input
                min="0"
                onChange={(event) => setForm({ ...form, classesAttended: event.target.value })}
                required
                type="number"
                value={form.classesAttended}
              />
            </label>
            <label>
              Exam result
              <select
                onChange={(event) => setForm({ ...form, status: event.target.value as StudentStatus })}
                value={form.status}
              >
                <option value="pending">Pending</option>
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
              </select>
            </label>
            <div className="student-form-actions">
              <p>
                Classes remaining: {Math.max(0, Number(form.classesRequired) - Number(form.classesAttended))}
              </p>
              <button className="primary-button" disabled={saving} type="submit">
                {saving ? 'Adding...' : 'Add student'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {message ? <p aria-live="polite" className="status-message">{message}</p> : null}

      <section className="panel">
        <div className="panel-header">
          <h2>Upcoming exam list</h2>
          <span>{role ?? 'Overview'}</span>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Belt rank</th>
                <th>Status</th>
                <th>Next exam</th>
                <th>Classes left</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student._id ?? student.id ?? student.name}>
                  <td>{student.name}</td>
                  <td>{student.beltRank || '—'}</td>
                  <td>
                    <span className={`chip ${student.status === 'passed' ? 'success' : 'warning'}`}>
                      {student.status}
                    </span>
                  </td>
                  <td>{student.nextExamDate || '—'}</td>
                  <td>{student.classesRemaining ?? Math.max(0, student.classesRequired - student.classesAttended)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
