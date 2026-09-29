'use client';

const students = [
  {
    id: 1,
    name: 'Aarav Singh',
    status: 'Passed',
    nextExam: '2026-10-20',
    classesLeft: 3,
  },
  {
    id: 2,
    name: 'Maya Patel',
    status: 'Failed',
    nextExam: '2026-10-27',
    classesLeft: 8,
  },
  {
    id: 3,
    name: 'Daniel Kim',
    status: 'Passed',
    nextExam: '2026-11-03',
    classesLeft: 2,
  },
];

export default function DashboardPage() {
  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Karate exam dashboard</p>
          <h1>Student progress dashboard</h1>
        </div>
        <button className="primary-button">Admin controls</button>
      </header>

      <section className="stats-grid">
        <article className="stat-card">
          <span>Total students</span>
          <strong>128</strong>
        </article>
        <article className="stat-card">
          <span>Passed</span>
          <strong>76</strong>
        </article>
        <article className="stat-card">
          <span>Failed</span>
          <strong>24</strong>
        </article>
        <article className="stat-card">
          <span>Next exam</span>
          <strong>Oct 20</strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Exam status</h2>
          <span>Role-aware summary</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Status</th>
              <th>Next exam</th>
              <th>Classes left</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id}>
                <td>{student.name}</td>
                <td>
                  <span
                    className={
                      student.status === 'Passed'
                        ? 'chip success'
                        : 'chip warning'
                    }
                  >
                    {student.status}
                  </span>
                </td>
                <td>{student.nextExam}</td>
                <td>{student.classesLeft}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
