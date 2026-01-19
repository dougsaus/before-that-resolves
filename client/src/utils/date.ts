const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

export function parseLocalDate(input: string): Date {
  const match = DATE_ONLY_PATTERN.exec(input.trim());
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(input);
}
