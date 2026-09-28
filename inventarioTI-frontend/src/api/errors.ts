import { isAxiosError } from 'axios';

import i18n from '../i18n';

interface ApiErrorBody {
  detail?: unknown;
}

/** Los códigos de error del backend se traducen con las claves `api_errors.<CÓDIGO>` de los locales. */
const API_ERROR_CODE = /^[A-Z0-9_]+$/;

export function getApiErrorDetail(error: unknown): string | undefined {
  if (!isAxiosError<ApiErrorBody>(error)) return undefined;
  const detail = error.response?.data?.detail;
  return typeof detail === 'string' ? detail : undefined;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const detail = getApiErrorDetail(error);
  if (!detail) return fallback;
  // Algunos códigos traen parámetros: `PASSWORD_POLICY_VIOLATION:min_length:12,require_symbol`.
  const code = detail.split(':')[0];
  const key = `api_errors.${code}`;
  if (code === 'PASSWORD_POLICY_VIOLATION' && i18n.exists(key)) {
    // Motivos concretos (palabra común, datos personales, secuencias…).
    const reasons = detail.slice(code.length + 1).split(',')
      .map((part) => part.split(':')[0])
      .filter((rule) => i18n.exists(`password_violations.${rule}`))
      .map((rule) => i18n.t(`password_violations.${rule}`));
    return [i18n.t(key), ...reasons].join(' ');
  }
  if (code === 'PASSWORD_REUSED' && i18n.exists(key)) {
    return i18n.t(key, { count: Number(detail.split(':')[1]) || 5 });
  }
  if (API_ERROR_CODE.test(code) && i18n.exists(key)) return i18n.t(key);
  // Un código técnico sin traducción no debe mostrarse al usuario.
  return API_ERROR_CODE.test(code) ? fallback : detail;
}
