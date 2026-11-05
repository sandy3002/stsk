'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { Download, Upload, CheckCircle2, AlertTriangle, FileSpreadsheet, Shield } from 'lucide-react';
import type { RawStudentInput } from '@/lib/services/importer';

interface BatchSummaryResponse {
  success: boolean;
  summary: {
    totalProcessed: number;
    insertedCount: number;
    skippedDuplicates: number;
    errors: Array<{ row: number; field?: string; message: string }>;
  };
  validationErrors?: Array<{ row: number; field?: string; message: string }>;
}

export default function SettingsPage() {
  // Backup state
  const [downloadingBackup, setDownloadingBackup] = useState(false);

  // CSV Import state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRecords, setParsedRecords] = useState<RawStudentInput[]>([]);
  const [allowSiblings, setAllowSiblings] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<BatchSummaryResponse | null>(null);
  const [parseError, setParseError] = useState('');

  // Trigger manual one-tap JSON export
  async function handleDownloadBackup() {
    setDownloadingBackup(true);
    try {
      const response = await fetch('/api/backup');
      if (!response.ok) throw new Error('Backup request failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().split('T')[0];
      a.download = `stsk-backup-${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error generating backup');
    } finally {
      setDownloadingBackup(false);
    }
  }

  // Parse CSV file in browser using PapaParse
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setParseError('');
    setImportResult(null);

    if (!file) {
      setCsvFile(null);
      setParsedRecords([]);
      return;
    }

    setCsvFile(file);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          setParseError(`CSV parsing warning: ${results.errors[0].message}`);
        }

        const rawRows = results.data as Record<string, string>[];
        if (rawRows.length === 0) {
          setParseError('The selected CSV file contains no data rows.');
          return;
        }

        // Map and normalize various header names
        const normalized = rawRows.map((row) => {
          const keys = Object.keys(row);
          const findVal = (patterns: string[]) => {
            const key = keys.find((k) =>
              patterns.some((p) => k.trim().toLowerCase() === p.toLowerCase())
            );
            return key ? row[key] : undefined;
          };

          return {
            name: findVal(['name', 'student name', 'full name', 'student']),
            phone: findVal(['phone', 'phone number', 'contact', 'mobile']),
            guardianName: findVal(['guardian', 'guardian name', 'parent', 'parent name']),
            beltRank: findVal(['belt', 'belt rank', 'rank']),
            classesRequired: findVal(['classes required', 'required classes', 'classes']),
            nextExamDate: findVal(['next exam date', 'exam date', 'grading date']),
            examStatus: findVal(['exam status', 'status']),
          };
        });

        setParsedRecords(normalized);
      },
      error: (err) => {
        setParseError(`Failed to parse CSV: ${err.message}`);
      },
    });
  }

  // Submit batch to POST /api/students/batch
  async function handleCommitImport() {
    if (parsedRecords.length === 0) return;
    setImporting(true);
    setImportResult(null);

    try {
      const response = await fetch('/api/students/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: parsedRecords,
          allowSiblings,
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || 'Batch import failed');
      }

      setImportResult(json);
      setCsvFile(null);
      setParsedRecords([]);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <span className="eyebrow" style={{ margin: 0 }}>System Administration</span>
        <h2 style={{ margin: 0 }}>Academy Settings & Operations</h2>
      </div>

      {/* Backup and Disaster Recovery Card */}
      <section className="panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <Shield size={22} color="var(--primary)" />
          <h3 style={{ margin: 0 }}>Disaster Recovery & Data Export</h3>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
          MongoDB Atlas M0 Free Tier does not include automated cloud snapshot restores. Use the one-tap export below to download an unencrypted, complete JSON backup containing all students, attendance records, tuition ledger history, and notices.
        </p>

        <div style={{ marginTop: '16px' }}>
          <button
            type="button"
            onClick={handleDownloadBackup}
            disabled={downloadingBackup}
            className="primary-button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              minHeight: '48px',
            }}
          >
            <Download size={18} />
            <span>{downloadingBackup ? 'Generating Backup...' : 'Export Complete Database (JSON)'}</span>
          </button>
        </div>
      </section>

      {/* Student CSV Batch Onboarding Card */}
      <section className="panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <FileSpreadsheet size={22} color="var(--primary)" />
          <h3 style={{ margin: 0 }}>Bulk Student Onboarding via CSV</h3>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Quickly onboard 150–200 students in one atomic operation. Only the <strong>Name</strong> column is strictly required. Standard defaults (White Belt, 10 required classes, pending status) are applied to missing fields.
        </p>

        <div
          style={{
            border: '2px dashed var(--line)',
            borderRadius: '12px',
            padding: '24px',
            textAlign: 'center',
            marginTop: '16px',
            background: '#f8fafc',
          }}
        >
          <Upload size={32} color="var(--muted)" style={{ margin: '0 auto 8px' }} />
          <p style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 600 }}>
            {csvFile ? `Selected: ${csvFile.name}` : 'Select student roster CSV file'}
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            id="csv-file-input"
            style={{ display: 'none' }}
          />
          <label htmlFor="csv-file-input" className="secondary-button" style={{ cursor: 'pointer' }}>
            Choose CSV File
          </label>
        </div>

        {parseError && (
          <div
            style={{
              background: '#fee2e2',
              color: '#991b1b',
              padding: '12px',
              borderRadius: '8px',
              marginTop: '16px',
              fontSize: '0.9rem',
            }}
          >
            {parseError}
          </div>
        )}

        {/* Preview and Commit Section */}
        {parsedRecords.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <strong>Found {parsedRecords.length} records in spreadsheet</strong>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}>
                <input
                  type="checkbox"
                  checked={allowSiblings}
                  onChange={(e) => setAllowSiblings(e.target.checked)}
                />
                <span>Allow siblings sharing same phone number</span>
              </label>
            </div>

            {/* Quick 5-row preview */}
            <div className="table-scroll" style={{ border: '1px solid var(--line)', borderRadius: '8px' }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Belt</th>
                    <th>Phone</th>
                    <th>Guardian</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRecords.slice(0, 5).map((r, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td><strong>{String(r.name || '—')}</strong></td>
                      <td>{String(r.beltRank || 'White (Default)')}</td>
                      <td>{String(r.phone || '—')}</td>
                      <td>{String(r.guardianName || '—')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedRecords.length > 5 && (
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '4px' }}>
                Showing first 5 of {parsedRecords.length} total rows.
              </p>
            )}

            <div style={{ marginTop: '16px' }}>
              <button
                type="button"
                onClick={handleCommitImport}
                disabled={importing}
                className="primary-button"
                style={{ minHeight: '48px' }}
              >
                {importing ? 'Importing Batch...' : `Confirm & Import ${parsedRecords.length} Students`}
              </button>
            </div>
          </div>
        )}

        {/* Result summary */}
        {importResult && (
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#166534',
              borderRadius: '10px',
              padding: '16px',
              marginTop: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
              <CheckCircle2 size={20} />
              <span>Import Completed Successfully!</span>
            </div>
            <ul style={{ marginTop: '8px', paddingLeft: '20px', fontSize: '0.9rem' }}>
              <li>Total processed: {importResult.summary.totalProcessed}</li>
              <li>Successfully inserted: {importResult.summary.insertedCount}</li>
              <li>Skipped duplicates: {importResult.summary.skippedDuplicates}</li>
            </ul>

            {importResult.summary.errors.length > 0 && (
              <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#991b1b' }}>
                <strong>Skipped rows / warnings:</strong>
                <ul style={{ paddingLeft: '20px', marginTop: '4px' }}>
                  {importResult.summary.errors.slice(0, 10).map((err, i) => (
                    <li key={i}>
                      Row {err.row}: {err.message}
                    </li>
                  ))}
                  {importResult.summary.errors.length > 10 && (
                    <li>...and {importResult.summary.errors.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
