'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Search, UserPlus, Phone, Award, Edit2, X, Check } from 'lucide-react';
import { BELT_RANKS, type BeltRank } from '@/lib/types';

interface Student {
  _id: string;
  id: string;
  name: string;
  phone?: string;
  guardianName?: string;
  beltRank: BeltRank;
  classesRequired: number;
  classesAttended: number;
  classesRemaining: number;
  nextExamDate?: string;
  examStatus: 'passed' | 'failed' | 'pending';
  active: boolean;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP error ${res.status}`);
  }
  return res.json();
};

export default function StudentsPage() {
  const { data: rawStudents = [], error, mutate, isLoading } = useSWR<Student[]>(
    '/api/students',
    fetcher,
    { revalidateOnFocus: true }
  );

  const students = useMemo(
    () => (Array.isArray(rawStudents) ? rawStudents : []),
    [rawStudents]
  );

  const [search, setSearch] = useState('');
  const [selectedBelt, setSelectedBelt] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [beltRank, setBeltRank] = useState<BeltRank>('White');
  const [classesRequired, setClassesRequired] = useState(10);
  const [nextExamDate, setNextExamDate] = useState('');
  const [examStatus, setExamStatus] = useState<'pending' | 'passed' | 'failed'>('pending');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // Client-side in-memory substring filtering (<5ms performance budget)
  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.phone && s.phone.includes(q)) ||
        (s.guardianName && s.guardianName.toLowerCase().includes(q));

      const matchesBelt = selectedBelt === 'All' || s.beltRank === selectedBelt;

      return matchesSearch && matchesBelt;
    });
  }, [students, search, selectedBelt]);

  function openCreateModal() {
    setEditingStudent(null);
    setName('');
    setPhone('');
    setGuardianName('');
    setBeltRank('White');
    setClassesRequired(10);
    setNextExamDate('');
    setExamStatus('pending');
    setModalError('');
    setIsModalOpen(true);
  }

  function openEditModal(student: Student) {
    setEditingStudent(student);
    setName(student.name);
    setPhone(student.phone || '');
    setGuardianName(student.guardianName || '');
    setBeltRank(student.beltRank);
    setClassesRequired(student.classesRequired ?? 10);
    setNextExamDate(student.nextExamDate || '');
    setExamStatus(student.examStatus || 'pending');
    setModalError('');
    setIsModalOpen(true);
  }

  async function handleSaveStudent(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setModalError('');

    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        guardianName: guardianName.trim(),
        beltRank,
        classesRequired: Number(classesRequired),
        nextExamDate: nextExamDate.trim(),
        examStatus,
      };

      if (editingStudent) {
        const res = await fetch(`/api/students/${editingStudent.id || editingStudent._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to update student');
        }
      } else {
        const res = await fetch('/api/students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to create student');
        }
      }

      await mutate();
      setIsModalOpen(false);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Error saving student');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm('Are you sure you want to deactivate this student?')) return;
    try {
      const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to deactivate');
      await mutate();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error deactivating');
    }
  }

  return (
    <div>
      {/* Top sticky search and action header */}
      <div className="sticky-header">
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div className="search-input-wrapper">
            <Search className="search-icon" size={20} />
            <input
              type="text"
              className="search-input"
              placeholder="Search students by name, phone, or guardian..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={openCreateModal}
            className="primary-button"
            style={{
              minHeight: '48px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
            }}
          >
            <UserPlus size={18} />
            <span>Add Student</span>
          </button>
        </div>

        {/* Belt filter chips */}
        <div className="belt-chips-scroll">
          {['All', ...BELT_RANKS].map((b) => (
            <button
              key={b}
              onClick={() => setSelectedBelt(b)}
              style={{
                border: '1px solid var(--line)',
                borderRadius: '999px',
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: selectedBelt === b ? 'var(--primary)' : 'white',
                color: selectedBelt === b ? 'white' : 'var(--text)',
                whiteSpace: 'nowrap',
              }}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Roster list */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
          Loading student roster...
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#ef4444' }}>
          Failed to load students. Please refresh or sign in again.
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', marginTop: '24px', padding: '48px 24px' }}>
          <p style={{ color: 'var(--muted)', fontSize: '1rem' }}>
            No students found matching "{search}".
          </p>
        </div>
      ) : (
        <div className="card-list">
          <div style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '4px' }}>
            Showing {filteredStudents.length} {filteredStudents.length === 1 ? 'student' : 'students'}
          </div>
          {filteredStudents.map((student) => {
            const id = student.id || student._id;
            const isReadyForExam = student.classesRemaining <= 0;

            return (
              <div key={id} className="touch-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                      {student.name}
                    </h3>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginTop: '4px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        🥋 {student.beltRank} Belt
                      </span>
                      {student.phone && (
                        <span
                          style={{
                            color: 'var(--muted)',
                            fontSize: '0.8rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Phone size={13} /> {student.phone}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => openEditModal(student)}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--line)',
                      borderRadius: '8px',
                      padding: '8px',
                      cursor: 'pointer',
                      color: 'var(--muted)',
                    }}
                    title="Edit profile"
                  >
                    <Edit2 size={16} />
                  </button>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '8px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '0.85rem',
                  }}
                >
                  <div>
                    <div style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>Attended</div>
                    <strong>{student.classesAttended}</strong>
                  </div>
                  <div>
                    <div style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>Required</div>
                    <strong>{student.classesRequired}</strong>
                  </div>
                  <div>
                    <div style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>Remaining</div>
                    <strong style={{ color: isReadyForExam ? 'var(--success)' : 'inherit' }}>
                      {student.classesRemaining} {isReadyForExam && '★'}
                    </strong>
                  </div>
                </div>

                {student.guardianName && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                    Guardian: {student.guardianName}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Student Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0 }}>
                {editingStudent ? 'Edit Student Profile' : 'Add New Student'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', color: 'var(--muted)' }}>
                Full Name *
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Aarav Singh"
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--line)' }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', color: 'var(--muted)' }}>
                  Phone
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--line)' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', color: 'var(--muted)' }}>
                  Guardian Name
                  <input
                    type="text"
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    placeholder="e.g. Priya Singh"
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--line)' }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', color: 'var(--muted)' }}>
                  Belt Rank
                  <select
                    value={beltRank}
                    onChange={(e) => setBeltRank(e.target.value as BeltRank)}
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--line)' }}
                  >
                    {BELT_RANKS.map((b) => (
                      <option key={b} value={b}>
                        {b} Belt
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', color: 'var(--muted)' }}>
                  Classes Required
                  <input
                    type="number"
                    min="0"
                    value={classesRequired}
                    onChange={(e) => setClassesRequired(Number(e.target.value))}
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--line)' }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', color: 'var(--muted)' }}>
                  Next Exam Date
                  <input
                    type="date"
                    value={nextExamDate}
                    onChange={(e) => setNextExamDate(e.target.value)}
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--line)' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', color: 'var(--muted)' }}>
                  Exam Status
                  <select
                    value={examStatus}
                    onChange={(e) => setExamStatus(e.target.value as any)}
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--line)' }}
                  >
                    <option value="pending">Pending</option>
                    <option value="passed">Passed</option>
                    <option value="failed">Failed</option>
                  </select>
                </label>
              </div>

              {modalError && (
                <div style={{ color: '#ef4444', fontSize: '0.9rem' }}>{modalError}</div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                {editingStudent ? (
                  <button
                    type="button"
                    onClick={() => handleDeactivate(editingStudent.id || editingStudent._id)}
                    style={{
                      background: '#fee2e2',
                      color: '#991b1b',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                    }}
                  >
                    Deactivate
                  </button>
                ) : <span />}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="secondary-button"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : editingStudent ? 'Update Profile' : 'Create Student'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
