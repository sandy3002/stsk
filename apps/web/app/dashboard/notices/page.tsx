'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Plus, Pin, Trash2, Edit3, X, AlertCircle } from 'lucide-react';
import type { NoticeCategory } from '@/lib/types';

interface NoticeItem {
  _id: string;
  title: string;
  content: string;
  category: NoticeCategory;
  pinned: boolean;
  publishedAt: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP error ${res.status}`);
  }
  return res.json();
};

export default function NoticesManagementPage() {
  const { data: rawNotices = [], error, mutate, isLoading } = useSWR<NoticeItem[]>(
    '/api/notices',
    fetcher
  );

  const notices = Array.isArray(rawNotices) ? rawNotices : [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<NoticeItem | null>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<NoticeCategory>('announcement');
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  function openCreateModal() {
    setEditingNotice(null);
    setTitle('');
    setContent('');
    setCategory('announcement');
    setPinned(false);
    setModalError('');
    setIsModalOpen(true);
  }

  function openEditModal(notice: NoticeItem) {
    setEditingNotice(notice);
    setTitle(notice.title);
    setContent(notice.content);
    setCategory(notice.category);
    setPinned(notice.pinned);
    setModalError('');
    setIsModalOpen(true);
  }

  async function handleSaveNotice(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setModalError('');

    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        category,
        pinned,
      };

      if (editingNotice) {
        const res = await fetch(`/api/notices/${editingNotice._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to update notice');
      } else {
        const res = await fetch('/api/notices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to create notice');
      }

      await mutate();
      setIsModalOpen(false);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Error saving notice');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this notice?')) return;
    try {
      const res = await fetch(`/api/notices/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete notice');
      await mutate();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error deleting');
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <div>
          <span className="eyebrow" style={{ margin: 0 }}>Public Communication</span>
          <h2 style={{ margin: 0 }}>Notices & Announcements</h2>
        </div>
        <button
          onClick={openCreateModal}
          className="primary-button"
          style={{ minHeight: '44px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={18} />
          <span>Post Notice</span>
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
          Loading announcements...
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#ef4444' }}>
          Failed to load notices.
        </div>
      ) : notices.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ color: 'var(--muted)' }}>
            No notices published yet. Tap "Post Notice" to inform students and parents about upcoming events.
          </p>
        </div>
      ) : (
        <div className="card-list">
          {notices.map((notice) => {
            const isExam = notice.category === 'exam_schedule';
            const isHoliday = notice.category === 'holiday';

            return (
              <div key={notice._id} className="touch-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span
                        style={{
                          background: isExam
                            ? 'var(--warning-soft)'
                            : isHoliday
                              ? '#fee2e2'
                              : 'var(--success-soft)',
                          color: isExam
                            ? 'var(--warning)'
                            : isHoliday
                              ? '#991b1b'
                              : 'var(--success)',
                          padding: '3px 8px',
                          borderRadius: '999px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        {notice.category.replace('_', ' ')}
                      </span>
                      {notice.pinned && (
                        <span
                          style={{
                            background: 'rgba(29, 78, 216, 0.1)',
                            color: 'var(--primary)',
                            padding: '3px 8px',
                            borderRadius: '999px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Pin size={11} /> Pinned
                        </span>
                      )}
                      <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
                        {new Date(notice.publishedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '1.2rem', margin: 0 }}>{notice.title}</h3>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => openEditModal(notice)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--line)',
                        borderRadius: '8px',
                        padding: '8px',
                        cursor: 'pointer',
                        color: 'var(--muted)',
                      }}
                      title="Edit Notice"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(notice._id)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--line)',
                        borderRadius: '8px',
                        padding: '8px',
                        cursor: 'pointer',
                        color: '#ef4444',
                      }}
                      title="Delete Notice"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <p
                  style={{
                    color: 'var(--text)',
                    fontSize: '0.92rem',
                    lineHeight: 1.5,
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {notice.content}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0 }}>
                {editingNotice ? 'Edit Notice' : 'Post New Notice'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveNotice} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', color: 'var(--muted)' }}>
                Title *
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Winter Belt Grading Schedule Announced"
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--line)' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', color: 'var(--muted)' }}>
                Category
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as NoticeCategory)}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--line)' }}
                >
                  <option value="announcement">📢 Announcement</option>
                  <option value="exam_schedule">🎖️ Exam Schedule</option>
                  <option value="holiday">🏖️ Holiday Closure</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', color: 'var(--muted)' }}>
                Content *
                <textarea
                  required
                  rows={3}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Details of the announcement, dates, requirements..."
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    font: 'inherit',
                    minHeight: '75px',
                    maxHeight: '160px',
                    resize: 'vertical',
                  }}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                />
                <span>Pin this notice to top of public homepage</span>
              </label>

              {modalError && (
                <div style={{ color: '#ef4444', fontSize: '0.9rem' }}>{modalError}</div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
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
                  {saving ? 'Publishing...' : editingNotice ? 'Update Notice' : 'Post Notice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
