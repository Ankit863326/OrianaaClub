// Phase 5a: Stream CSV values safely, neutralizing spreadsheet formula injection.
export function safeCsvCell(value) {
  const text = value == null ? '' : String(value);
  const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function writeCsvHeader(response, filename, columns) {
  response.setHeader('Content-Type', 'text/csv; charset=utf-8');
  response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  response.write(`${columns.map(safeCsvCell).join(',')}\r\n`);
}

export function writeCsvRow(response, values) {
  response.write(`${values.map(safeCsvCell).join(',')}\r\n`);
}
