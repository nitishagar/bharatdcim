/**
 * Simple RFC 4180-compliant CSV parser.
 * Handles: quoted fields, embedded commas, BOM, mixed line endings,
 * semicolon delimiter auto-detection.
 */

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
  delimiter: string;
}

/**
 * Strip UTF-8 BOM if present.
 */
function stripBOM(content: string): string {
  return content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
}

/**
 * Detect delimiter: if first line has more semicolons than commas, use semicolon.
 */
function detectDelimiter(firstLine: string): string {
  const commas = (firstLine.match(/,/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

/**
 * Parse a CSV line respecting quoted fields.
 */
function parseLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parse CSV content into headers + rows.
 */
export function parseCSV(content: string): ParsedCSV {
  const cleaned = stripBOM(content);

  // Normalize line endings to \n
  const normalized = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split into lines, remove trailing empty line
  const lines = normalized.split('\n');
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  if (lines.length === 0) {
    return { headers: [], rows: [], delimiter: ',' };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseLine(lines[0], delimiter);

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    const values = parseLine(lines[i], delimiter);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? '';
    }
    rows.push(row);
  }

  return { headers, rows, delimiter };
}
