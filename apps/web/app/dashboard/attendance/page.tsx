'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { Search, Calendar, Check, X, RotateCcw, WifiOff } from 'lucide-react';
import type { AttendanceStatus, SessionType } from '@/lib/types';

interface Student {
  _id: string;
  id: string;
  name: string;
  beltRank: string;
  classesAttended: number;
  classesRequired: number;
}

interface AttendanceRosterResponse {
  date: string;
  roster: Record<string, { status: AttendanceStatus; sessionType: SessionType }>;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP error ${res.status}`);
  }
  return res.json();
};

export default function AttendancePage() {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [search, setSearch] = useState('');
  const [sessionType, setSessionType] = useState<SessionType>('regular');

  // Load students
  const { data: rawStudents = [], mutate: mutateStudents } = useSWR<Student[]>(
    '/api/students',
    fetcher
  );

  const students = useMemo(
    () => (Array.isArray(rawStudents) ? rawStudents : []),
    [rawStudents]
  );

  // Load daily attendance roster (SWARM-LOGIC-006: scoped to sessionType)
  const { data: attendanceData, mutate: mutateAttendance } = useSWR<AttendanceRosterResponse>(
    `/api/attendance?date=${selectedDate}&sessionType=${sessionType}`,
    fetcher
  );

  // Local optimistic map of attendance status: studentId -> 'present' | 'absent'
  const [optimisticMarks, setOptimisticMarks] = useState<Record<string, AttendanceStatus>>({});

  // SWARM-CONC-003 & SWARM-CONC-006: AbortControllers and Sequence Tracking per student
  const abortControllersRef = useRef<Record<string, AbortController>>({});
  const requestSeqRef = useRef<Record<string, number>>({});

  // Sync server data into optimistic marks when date or server data changes
  useEffect(() => {
    if (attendanceData?.roster) {
      const serverMap: Record<string, AttendanceStatus> = {};
      for (const [sId, info] of Object.entries(attendanceData.roster)) {
        serverMap[sId] = info.status;
      }
      setOptimisticMarks(serverMap);
    } else {
      setOptimisticMarks({});
    }
  }, [attendanceData]);

  // Undo Toast state
  const [undoToast, setUndoToast] = useState<{
    studentId: string;
    studentName: string;
    status: AttendanceStatus;
    previousStatus?: AttendanceStatus;
    timerId: NodeJS.Timeout;
  } | null>(null);

  // Offline mutation queue
  const [offlineQueue, setOfflineQueue] = useState<
    Array<{
      studentId: string;
      date: string;
      status: AttendanceStatus;
      sessionType: SessionType;
    }>
  >([]);

  // Trigger brief haptic feedback (safe no-op on iOS Safari / desktop)
  function triggerHaptic() {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(40);
      } catch {
        // no-op
      }
    }
  }

  // Handle Mark Attendance
  async function handleMark(student: Student, targetStatus: AttendanceStatus) {
    const studentId = student.id || student._id;
    const previousStatus = optimisticMarks[studentId];

    // Trigger haptic vibration
    triggerHaptic();

    // 1. Optimistic UI update
    setOptimisticMarks((prev) => ({
      ...prev,
      [studentId]: targetStatus,
    }));

    // Clear any previous undo toast timer
    if (undoToast?.timerId) {
      clearTimeout(undoToast.timerId);
    }

    // 2. Set interactive 5-second Undo toast
    const timerId = setTimeout(() => {
      setUndoToast(null);
    }, 5000);

    setUndoToast({
      studentId,
      studentName: student.name,
      status: targetStatus,
      previousStatus,
      timerId,
    });

    // SWARM-CONC-003: Abort any in-flight requests for this student
    if (abortControllersRef.current[studentId]) {
      abortControllersRef.current[studentId].abort();
    }
    const controller = new AbortController();
    abortControllersRef.current[studentId] = controller;

    // SWARM-CONC-006: Sequence tracking to eliminate out-of-order counter updates
    const currentSeq = (requestSeqRef.current[studentId] || 0) + 1;
    requestSeqRef.current[studentId] = currentSeq;

    // 3. Submit mutation
    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          studentId,
          date: selectedDate,
          status: targetStatus,
          sessionType,
        }),
      });

      if (!response.ok) {
        throw new Error('Network response not ok');
      }

      const result = await response.json();
      if (requestSeqRef.current[studentId] === currentSeq && result.classesAttended !== undefined) {
        mutateStudents(
          (prevStudents) =>
            prevStudents?.map((s) =>
              (s.id || s._id) === studentId
                ? { ...s, classesAttended: result.classesAttended }
                : s
            ),
          false
        );
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // Aborted cleanly by undo or superseding mark; do not queue
        return;
      }
      // Add to offline queue for automatic retry
      console.warn('Network error marking attendance; queueing offline:', err);
      setOfflineQueue((q) => [
        ...q,
        {
          studentId,
          date: selectedDate,
          status: targetStatus,
          sessionType,
        },
      ]);
    }
  }

  // Handle 5-second Undo action
  async function handleUndo() {
    if (!undoToast) return;

    clearTimeout(undoToast.timerId);
    const { studentId, previousStatus } = undoToast;

    triggerHaptic();

    // SWARM-CONC-003: Abort any pending POST for this student immediately
    if (abortControllersRef.current[studentId]) {
      abortControllersRef.current[studentId].abort();
      delete abortControllersRef.current[studentId];
    }
    // SWARM-CONC-006: Invalidate any responses from pending mark requests
    requestSeqRef.current[studentId] = (requestSeqRef.current[studentId] || 0) + 1;

    // Revert optimistic mark
    setOptimisticMarks((prev) => {
      const updated = { ...prev };
      if (previousStatus) {
        updated[studentId] = previousStatus;
      } else {
        delete updated[studentId];
      }
      return updated;
    });

    setUndoToast(null);

    try {
      if (previousStatus) {
        // Re-apply previous status
        await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId,
            date: selectedDate,
            status: previousStatus,
            sessionType,
          }),
        });
      } else {
        // Delete record completely
        await fetch('/api/attendance', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId,
            date: selectedDate,
            sessionType,
          }),
        });
      }

      await mutateAttendance();
      await mutateStudents();
    } catch (err) {
      console.error('Error undoing attendance:', err);
    }
  }

  // Periodic processor for offline queue when connection is restored
  useEffect(() => {
    if (offlineQueue.length === 0) return;

    const interval = setInterval(async () => {
      if (navigator.onLine && offlineQueue.length > 0) {
        const item = offlineQueue[0];
        try {
          const res = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
          });
          if (res.ok) {
            setOfflineQueue((q) => q.slice(1));
            mutateAttendance();
          }
        } catch {
          // Still offline, will retry next tick
        }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [offlineQueue, mutateAttendance]);

  // Instant in-memory search filter (<5ms)
  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.name.toLowerCase().includes(q));
  }, [students, search]);

  // Aggregate stats for current date
  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    for (const s of students) {
      const id = s.id || s._id;
      const status = optimisticMarks[id];
      if (status === 'present') present++;
      if (status === 'absent') absent++;
    }
    return { present, absent, total: students.length };
  }, [students, optimisticMarks]);

  return (
    <div>
      {/* Offline banner if queue has items */}
      {offlineQueue.length > 0 && (
        <div className="offline-banner">
          <WifiOff size={18} />
          <span>
            You are offline or have slow connection. {offlineQueue.length} marks queued and will sync automatically.
          </span>
        </div>
      )}

      {/* Date & Session Selector Bar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={18} color="var(--primary)" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              fontSize: '1rem',
              fontWeight: 700,
              background: 'white',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Session:</span>
          <select
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value as SessionType)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              background: 'white',
              fontSize: '0.9rem',
              fontWeight: 600,
            }}
          >
            <option value="regular">🥋 Regular Class</option>
            <option value="sparring">🥊 Sparring</option>
            <option value="grading">🎖️ Belt Grading</option>
          </select>
        </div>
      </div>

      {/* Quick summary tally pills */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
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
            fontSize: '0.9rem',
          }}
        >
          Present: {counts.present}
        </div>
        <div
          style={{
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: '10px',
            padding: '10px',
            textAlign: 'center',
            fontWeight: 700,
            fontSize: '0.9rem',
          }}
        >
          Absent: {counts.absent}
        </div>
        <div
          style={{
            background: '#f1f5f9',
            color: 'var(--text)',
            borderRadius: '10px',
            padding: '10px',
            textAlign: 'center',
            fontWeight: 700,
            fontSize: '0.9rem',
          }}
        >
          Total: {counts.total}
        </div>
      </div>

      {/* Sticky Top Instant Search */}
      <div className="sticky-header">
        <div className="search-input-wrapper">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            className="search-input"
            placeholder="Type student name for instant roll-call (<5ms)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Student roll-call list */}
      <div className="card-list">
        {filteredStudents.length === 0 ? (
          <div className="panel" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ color: 'var(--muted)' }}>No students match "{search}".</p>
          </div>
        ) : (
          filteredStudents.map((student) => {
            const studentId = student.id || student._id;
            const status = optimisticMarks[studentId];
            const isPresent = status === 'present';
            const isAbsent = status === 'absent';

            let cardHighlight = '';
            if (isPresent) cardHighlight = 'highlight-present';
            if (isAbsent) cardHighlight = 'highlight-absent';

            return (
              <div key={studentId} className={`touch-card ${cardHighlight}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                      {student.name}
                    </h3>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '2px' }}>
                      🥋 {student.beltRank} Belt • {student.classesAttended} attended
                    </div>
                  </div>

                  {status && (
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: isPresent ? 'var(--success-soft)' : '#fee2e2',
                        color: isPresent ? 'var(--success)' : '#991b1b',
                      }}
                    >
                      {isPresent ? '✓ Present' : '✗ Absent'}
                    </span>
                  )}
                </div>

                {/* Side-by-side large touch targets (min 48px height) */}
                <div className="attendance-actions">
                  <button
                    type="button"
                    onClick={() => handleMark(student, 'present')}
                    className={`btn-touch btn-present ${isPresent ? 'selected' : ''}`}
                    aria-label={`Mark ${student.name} Present`}
                  >
                    <Check size={20} />
                    <span>Present</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMark(student, 'absent')}
                    className={`btn-touch btn-absent ${isAbsent ? 'selected' : ''}`}
                    aria-label={`Mark ${student.name} Absent`}
                  >
                    <X size={20} />
                    <span>Absent</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5-Second Interactive Undo Toast */}
      {undoToast && (
        <aside className="undo-toast" role="status" aria-live="polite">
          <span>
            Marked <strong>{undoToast.studentName}</strong> as{' '}
            <span style={{ textTransform: 'capitalize' }}>{undoToast.status}</span>
          </span>
          <button
            type="button"
            onClick={handleUndo}
            className="undo-button"
            aria-label="Undo attendance mark"
          >
            <RotateCcw size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-2px' }} />
            Undo
          </button>
        </aside>
      )}
    </div>
  );
}
