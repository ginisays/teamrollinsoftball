export function normalizeSmsPhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

export function isValidSmsPhone(phone: string): boolean {
  return /^\+?[\d\s().-]+$/.test(phone.trim()) && /^\+?\d{7,15}$/.test(normalizeSmsPhone(phone));
}
