// Client-side file download helpers (CSV exports, authorized blob downloads).

export function downloadTextFile(filename, text, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob([text], { type: mime });
  downloadBlob(filename, blob);
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Quote a CSV cell only when needed.
export function csvCell(value) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
