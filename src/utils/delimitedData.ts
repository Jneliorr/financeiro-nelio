function detectDelimiter(text: string): string {
  const candidates = ['\t', ';', ','];
  const found = new Set<string>();
  let quoted = false;
  for (const character of text) {
    if (character === '"') quoted = !quoted;
    if (quoted) continue;
    if (character === '\r' || character === '\n') break;
    if (candidates.includes(character)) found.add(character);
  }
  return candidates.find((candidate) => found.has(candidate)) ?? ';';
}

export function parseDelimitedRows(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '').trimStart();
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const finishRow = () => {
    row.push(field.trim());
    if (row.some(Boolean)) rows.push(row);
    row = [];
    field = '';
  };

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character !== '"') field += character;
      else if (text[index + 1] === '"') {
        field += '"';
        index++;
      } else quoted = false;
    } else if (character === '"' && !field.trim()) {
      field = '';
      quoted = true;
    } else if (character === delimiter) {
      row.push(field.trim());
      field = '';
    } else if (character === '\r' || character === '\n') {
      finishRow();
      if (character === '\r' && text[index + 1] === '\n') index++;
    } else field += character;
  }
  if (quoted) throw new Error('Há uma célula com aspas sem fechamento.');
  finishRow();
  return rows;
}

export function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

export function parseFinancialAmount(raw: string): number | null {
  let value = raw.replace(/R\$|\s/gi, '');
  if (/^\(.*\)$/.test(value)) value = `-${value.slice(1, -1)}`;
  if (value.endsWith('-')) value = `-${value.slice(0, -1)}`;
  if (/^[+-]?\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(value)) {
    value = value.replace(/\./g, '').replace(',', '.');
  } else if (/^[+-]?\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(value)) {
    value = value.replace(/,/g, '');
  } else if (/^[+-]?\d+([,.]\d{1,2})?$/.test(value)) {
    value = value.replace(',', '.');
  } else return null;
  const amount = Number(value);
  return Number.isSafeInteger(Math.round(amount * 100)) ? amount : null;
}

export function parseFinancialDate(raw: string): string | null {
  const value = raw.trim();
  const iso = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  const brazilian = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2}|\d{4})$/);
  const year = iso?.[1] ?? brazilian?.[3];
  if (!year) return null;
  const fullYear = year.length === 2 ? `20${year}` : year;
  const month = (iso?.[2] ?? brazilian![2]).padStart(2, '0');
  const day = (iso?.[3] ?? brazilian![1]).padStart(2, '0');
  const formatted = `${fullYear}-${month}-${day}`;
  const date = new Date(`${formatted}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === formatted ? formatted : null;
}

export function quoteSpreadsheetCell(value: string, delimiter: string): string {
  const safe = /^[\s\uFEFF]*[=+\-@]/.test(value) && value !== '-' ? `'${value}` : value;
  return safe.includes(delimiter) || /["\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function readSpreadsheetText(value: string): string {
  return value.replace(/^'(?=[\s\uFEFF]*[=+\-@])/, '');
}
