const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  return `${year}-${month}-${day}`;
}

export function normalizeDateInput(input: unknown): string {
  if (input instanceof Date) {
    return formatDateOnly(input);
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    const match = DATE_ONLY_PATTERN.exec(trimmed);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.valueOf())) {
      return formatDateOnly(parsed);
    }
  }
  return formatDateOnly(new Date());
}
