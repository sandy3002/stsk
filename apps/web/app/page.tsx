import Link from 'next/link';
import { connectDB } from '@/lib/db';
import { Notice } from '@/lib/models/notice';

// Edge ISR revalidation interval: 300 seconds (5 minutes)
export const revalidate = 300;

interface NoticeItem {
  _id: string;
  title: string;
  content: string;
  category: 'announcement' | 'exam_schedule' | 'holiday';
  pinned: boolean;
  publishedAt: string;
}

async function getNotices(): Promise<NoticeItem[]> {
  try {
    await connectDB();
    const notices = await Notice.find()
      .sort({ pinned: -1, publishedAt: -1 })
      .lean();

    return notices.map((n) => ({
      _id: n._id.toString(),
      title: n.title,
      content: n.content,
      category: n.category,
      pinned: Boolean(n.pinned),
      publishedAt: n.publishedAt ? new Date(n.publishedAt).toISOString() : new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Error fetching public notices in ISR:', error);
    return [];
  }
}

export default async function PublicNoticeBoardPage() {
  const notices = await getNotices();

  return (
    <main className="dashboard-shell notice-page-shell">
      <header className="topbar" style={{ marginBottom: '24px' }}>
        <div>
          <p className="eyebrow">Shotokan Karate Academy</p>
          <h1>Academy Notices & Schedule</h1>
          <p style={{ color: 'var(--muted)', marginTop: '4px' }}>
            Official announcements, belt grading dates, and holiday schedules.
          </p>
        </div>
        <div>
          <Link href="/dashboard" className="primary-button" style={{ fontSize: '0.9rem' }}>
            Instructor Portal &rarr;
          </Link>
        </div>
      </header>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {notices.length === 0 ? (
          <div className="panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <p style={{ color: 'var(--muted)', fontSize: '1.1rem' }}>
              No current notices posted. Check back soon for upcoming belt exams and holiday dates.
            </p>
          </div>
        ) : (
          notices.map((notice) => {
            const isExam = notice.category === 'exam_schedule';
            const isHoliday = notice.category === 'holiday';

            const badgeBg = isExam
              ? 'var(--warning-soft)'
              : isHoliday
              ? '#fee2e2'
              : 'var(--success-soft)';
            const badgeColor = isExam
              ? 'var(--warning)'
              : isHoliday
              ? '#991b1b'
              : 'var(--success)';
            const categoryLabel = isExam
              ? 'Belt Exam'
              : isHoliday
              ? 'Holiday Closure'
              : 'Announcement';

            return (
              <article
                key={notice._id}
                className="panel"
                style={{
                  borderLeft: notice.pinned ? '5px solid var(--primary)' : '1px solid var(--line)',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '12px',
                    marginBottom: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        background: badgeBg,
                        color: badgeColor,
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {categoryLabel}
                    </span>
                    {notice.pinned && (
                      <span
                        style={{
                          background: 'rgba(29, 78, 216, 0.1)',
                          color: 'var(--primary)',
                          padding: '4px 10px',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        📌 Pinned
                      </span>
                    )}
                  </div>
                  <time
                    dateTime={notice.publishedAt}
                    style={{ color: 'var(--muted)', fontSize: '0.85rem' }}
                  >
                    {new Date(notice.publishedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </time>
                </div>

                <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>{notice.title}</h2>
                <div
                  style={{
                    color: 'var(--text)',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    fontSize: '0.98rem',
                  }}
                >
                  {notice.content}
                </div>
              </article>
            );
          })
        )}
      </section>

      {/* Fixed Bottom Footer */}
      <footer className="notice-fixed-footer">
        <div className="notice-fixed-footer-inner">
          <p>&copy; {new Date().getFullYear()} Shotokan Karate Academy. All rights reserved.</p>
          <p style={{ marginTop: '4px' }}>
            Instructor access:{' '}
            <Link href="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>
              Sign in here
            </Link>
          </p>
        </div>
      </footer>
    </main>
  );
}
