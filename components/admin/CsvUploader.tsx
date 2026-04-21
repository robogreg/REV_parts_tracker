'use client';

import { useState, useRef } from 'react';
import { Upload, AlertCircle, CheckCircle, X } from 'lucide-react';
import { getAuthHeaders } from '@/lib/firebase-client';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

interface CsvUploaderProps {
  endpoint: string;
  onSuccess?: (result: unknown) => void;
  label?: string;
  accept?: string;
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
}: CsvUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ParsedRow[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [success, setSuccess] = useState(false);

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

      setSuccess(true);
      setPreview(null);
      setRawFile(null);
      if (fileRef.current) fileRef.current.value = '';
      onSuccess?.(data);
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
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div>
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
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#2E2E2E] hover:bg-[#3E3E3E] text-white text-sm transition-colors"
          >
            <Upload className="w-4 h-4" />
            {label}
          </button>
        </>
      )}

      {/* Success state */}
      {success && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-900/30 border border-green-800/50 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4" />
          Import successful!
          <button onClick={handleReset} className="ml-auto text-[#9CA3AF] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Preview */}
      {preview && !success && (
        <div className="mt-3 bg-[#141414] border border-[#2E2E2E] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2E2E2E] flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">
                {rawFile?.name} — {totalRows} rows
              </p>
              <p className="text-xs text-[#9CA3AF]">Preview: first 5 rows</p>
            </div>
            <button onClick={handleReset} className="text-[#9CA3AF] hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#2E2E2E] text-[#9CA3AF]">
                  {headers.map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className={cn('border-b border-[#2E2E2E]/50', i % 2 === 0 ? '' : 'bg-[#1A1A1A]/50')}>
                    {headers.map((h) => (
                      <td key={h} className="px-3 py-2 text-white truncate max-w-[120px]">
                        {row[h] || <span className="text-[#9CA3AF]">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="px-4 py-3 border-t border-[#2E2E2E] space-y-1">
              {errors.map((err, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-red-400">
                  <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  {err.row > 0 && <span className="font-mono">Row {err.row}:</span>}
                  {err.message}
                </div>
              ))}
            </div>
          )}

          <div className="px-4 py-3 border-t border-[#2E2E2E] flex gap-2 justify-end">
            <button
              onClick={handleReset}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg text-sm text-[#9CA3AF] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[#FF6B00] hover:bg-[#e56000] text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {loading && <Spinner size="sm" className="text-white" />}
              Import {totalRows} rows
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
