/**
 * Generic CSV export utilities — reusable across any export feature.
 * Pattern: client-side blob generation + anchor-tag download
 * (same approach as AdminAuditLogsPage JSON export)
 */

/**
 * Escape a single CSV field per RFC 4180:
 * - Wrap in double-quotes if it contains comma, quote, or newline
 * - Double any existing double-quotes
 */
export function escapeCSVField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert an array of field values into a single CSV row string.
 */
export function arrayToCSVRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(escapeCSVField).join(',');
}

/**
 * Trigger a file download in the browser via blob + anchor tag.
 */
export function downloadFile(content: string, filename: string, mimeType = 'text/csv'): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
