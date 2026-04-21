'use client';

import { useState, useRef } from 'react';
import { Upload, AlertCircle, CheckCircle, X, FileDown } from 'lucide-react';
import { getAuthHeaders } from '@/lib/firebase-client';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

const INVENTORY_TEMPLATE = `sku,name,category,quantity_available,pack_size,is_loaner,low_stock_threshold,msrp,description
REV-11-1271,Through Bore Encoder,Electronics,5,1,no,2,39.99,
REV-41-1600,NEO Brushless Motor,Motors,3,1,no,1,49.99,
`;

const TEAMS_TEMPLATE = `team_number,team_name,program,city,state,country
254,The Cheesy Poofs,FRC,San Jose,CA,USA
118,Robonauts,FRC,Houston,TX,USA
`;

interface CsvUploaderProps {
  endpoint: string;
  onSuccess?: (result: unknown) => void;
  label?: string;
  accept?: string;
  templateType?: 'inventory' | 'teams';
}

interface ParsedRow {
  [key: string]: string;
}

interface RowError {
  row: number;
  message: string;
}

export function CsvUploader({
  endpoint,
  onSuccess,
  label = 'Upload CSV',
  accept = '.csv',
  templateType,
}: CsvUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ParsedRow[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [success, setSuccess] = useState(false);
  const [successCount, setSuccessCount] = useState(0);

  function parseCsv(text: string): { headers: string[]; rows: ParsedRow[] } {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return { headers: [], rows: [] };
    const hdrs = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const rows: ParsedRow[] = lines.slice(1).map((line) => {
      const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      return Object.fromEntries(hdrs.map((h, i) => [h, cells[i] ?? '']));
    });
    return { headers: hdrs, rows };
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRawFile(file);
    setErrors([]);
    setSuccess(false);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers: hdrs, rows } = parseCsv(text);
      setHeaders(hdrs);
      setTotalRows(rows.length);
      setPreview(rows.slice(0, 5));
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!rawFile) return;
    setLoading(true);
    setErrors([]);

    try {
      const authHeaders = await getAuthHeaders();
      const formData = new FormData();
      formData.append('file', rawFile);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errors) {
          setErrors(data.errors);
        } else {
          setErrors([{ row: 0, message: data.error ?? 'Upload failed' }]);
        }
        return;
      }

      // Surface any per-row errors even on a 200 response
      if (data.errors?.length) {
        setErrors(data.errors);
      }

      const imported = (data.created ?? 0) + (data.updated ?? 0);
      if (imported > 0 || !data.errors?.length) {
        setSuccessCount(imported);
        setSuccess(true);
        setPreview(null);
        setRawFile(null);
        if (fileRef.current) fileRef.current.value = '';
        onSuccess?.(data);
      }
    } catch (err) {
      setErrors([{ row: 0, message: err instanceof Error ? err.message : 'Upload failed' }]);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setPreview(null);
    setRawFile(null);
    setErrors([]);
    setSuccess(false);
    setSuccessCount(0);
    if (fileRef.current) fileRef.current.value = '';
  }

  function downloadTemplate() {
    const csv = templateType === 'teams' ? TEAMS_TEMPLATE : INVENTORY_TEMPLATE;
    const filename = templateType === 'teams' ? 'teams-template.csv' : 'inventory-template.csv';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex items-center gap-1.5">
      {/* Trigger */}
      {!preview && !success && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-hover)] hover:bg-[var(--bg-hover2)] text-[var(--tx-primary)] text-sm transition-colors"
          >
            <Upload className="w-4 h-4" />
            {label}
          </button>
          {templateType && (
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--bd)] text-[var(--tx-muted)] hover:text-[var(--tx-primary)] text-sm transition-colors"
              title="Download CSV template"
            >
              <FileDown className="w-4 h-4" />
              Template
            </button>
          )}
        </>
      )}

      {/* Success state */}
      {success && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-900/30 border border-green-800/50 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4" />
          {successCount > 0 ? `Imported ${successCount} rows` : 'Import successful!'}
          <button onClick={handleReset} className="ml-auto text-[var(--tx-muted)] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Preview */}
      {preview && !success && (
        <div className="mt-3 bg-[var(--bg-deep)] border border-[var(--bg-hover)] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--bg-hover)] flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--tx-primary)]">
                {rawFile?.name} — {totalRows} rows
              </p>
              <p className="text-xs text-[var(--tx-muted)]">Preview: first 5 rows</p>
            </div>
            <button onClick={handleReset} className="text-[var(--tx-muted)] hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--bg-hover)] text-[var(--tx-muted)]">
                  {headers.map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className={cn('border-b border-[var(--bg-hover)]/50', i % 2 === 0 ? '' : 'bg-[var(--bg-card)]/50')}>
                    {headers.map((h) => (
                      <td key={h} className="px-3 py-2 text-[var(--tx-primary)] truncate max-w-[120px]">
                        {row[h] || <span className="text-[var(--tx-muted)]">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="px-4 py-3 border-t border-[var(--bg-hover)] space-y-1">
              {errors.map((err, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-red-400">
                  <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  {err.row > 0 && <span className="font-mono">Row {err.row}:</span>}
                  {err.message}
                </div>
              ))}
            </div>
          )}

          <div className="px-4 py-3 border-t border-[var(--bg-hover)] flex gap-2 justify-end">
            <button
              onClick={handleReset}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg text-sm text-[var(--tx-muted)] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[#FF6B00] hover:bg-[#e56000] text-[var(--tx-primary)] text-sm font-medium transition-colors disabled:opacity-60"
            >
              {loading && <Spinner size="sm" className="text-[var(--tx-primary)]" />}
              Import {totalRows} rows
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
