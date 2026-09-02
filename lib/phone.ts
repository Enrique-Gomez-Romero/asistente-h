const DEFAULT_COUNTRY_CODE = '52';

export function normalizePhone(
  value: string,
  defaultCountryCode = DEFAULT_COUNTRY_CODE,
): string | null {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);

  // Meta normaliza números móviles mexicanos como 52 + 10 dígitos. Algunas
  // fuentes antiguas todavía incluyen el prefijo móvil 1 (521...).
  if (digits.length === 13 && digits.startsWith('521'))
    digits = `52${digits.slice(3)}`;
  if (digits.length === 10) digits = `${defaultCountryCode}${digits}`;

  return digits.length >= 11 && digits.length <= 15 ? digits : null;
}

export function phoneForDisplay(value: string): string {
  const normalized = normalizePhone(value);
  return normalized ? `+${normalized}` : value.trim();
}
