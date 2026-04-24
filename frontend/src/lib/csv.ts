export type CsvRow = Record<string, string>;

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

export function parseCsv(text: string): CsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return [];
  }

  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce<CsvRow>((acc, header, idx) => {
      acc[header] = values[idx] ?? '';
      return acc;
    }, {});
  });
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function getCsvValue(row: CsvRow, candidates: string[]): string {
  const keyMap = Object.keys(row).reduce<Record<string, string>>((acc, key) => {
    acc[normalizeHeader(key)] = key;
    return acc;
  }, {});

  for (const candidate of candidates) {
    const foundKey = keyMap[normalizeHeader(candidate)];
    if (foundKey) {
      return (row[foundKey] ?? '').trim();
    }
  }

  return '';
}
