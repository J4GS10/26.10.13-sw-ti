import client from './axios';
import i18n from '../i18n';
import { normalizeLanguage, type SupportedLanguage } from '../types/language';

/**
 * Descarga autenticada de un CSV del backend. El interceptor de axios inyecta
 * el token; pedimos el blob y disparamos la descarga en el navegador.
 */
export const downloadCsv = async (path: string, filename: string, language?: SupportedLanguage): Promise<void> => {
  const lang = normalizeLanguage(language ?? i18n.resolvedLanguage ?? i18n.language);
  const separator = path.includes('?') ? '&' : '?';
  const r = await client.get(`${path}${separator}lang=${lang}`, { responseType: 'blob' });
  const url = URL.createObjectURL(r.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
