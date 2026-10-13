// A1-адреси: «C5», «J5». Рядки й колонки нумеруються з 1.

const A1_RE = /^([A-Za-z]{1,3})([1-9][0-9]{0,4})$/;

export type CellPos = { row: number; col: number };

export function colToLetters(col: number): string {
  let n = col;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export function lettersToCol(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

export function parseA1(ref: string): CellPos | null {
  const m = A1_RE.exec(ref.trim());
  if (!m) return null;
  return { col: lettersToCol(m[1]), row: Number(m[2]) };
}

export function toA1(row: number, col: number): string {
  return `${colToLetters(col)}${row}`;
}

export function normalizeA1(ref: string): string | null {
  const p = parseA1(ref);
  return p ? toA1(p.row, p.col) : null;
}
