import client from '../../api/axios';
import { Movimiento, MovimientoCreate, TipoMovimiento } from '../../types/traceability';
import { Activo } from '../../types/inventory';
import { PersonaResumen } from '../../types/users';
import { Area } from '../../types/geo';
import type { SupportedLanguage } from '../../types/language';

export const movementService = {
  // --- LECTURA ---
  getMovements: async (): Promise<Movimiento[]> => {
    const response = await client.get<Movimiento[]>('/trazabilidad/movimientos');
    return response.data;
  },

  getTiposMovimiento: async (): Promise<TipoMovimiento[]> => {
    const response = await client.get<TipoMovimiento[]>('/trazabilidad/tipos');
    return response.data;
  },

  // --- ESCRITURA ---
  createMovement: async (data: MovimientoCreate): Promise<Movimiento> => {
    const response = await client.post<Movimiento>('/trazabilidad/movimientos', data);
    return response.data;
  },

  // --- DOCUMENTOS (Word .docx o PDF; tipo entrega o descargo/devolución) ---
  downloadActa: async (
    movimientoId: string,
    formato: 'docx' | 'pdf' = 'docx',
    tipo: 'entrega' | 'descargo' = 'entrega',
    mensajero?: string,
    lang?: SupportedLanguage,
  ): Promise<Blob> => {
    const params = new URLSearchParams({ formato, tipo });
    if (mensajero && mensajero.trim()) params.set('mensajero', mensajero.trim());
    if (lang) params.set('lang', lang);
    const response = await client.get(
      `/trazabilidad/acta/${movimientoId}?${params.toString()}`,
      { responseType: 'blob' },
    );
    return response.data;
  },

  downloadActaLote: async (
    ids: string[],
    formato: 'docx' | 'pdf' = 'docx',
    tipo: 'entrega' | 'descargo' = 'entrega',
    lang?: SupportedLanguage,
  ): Promise<Blob> => {
    const params = new URLSearchParams({ formato, tipo });
    if (lang) params.set('lang', lang);
    const response = await client.post(`/trazabilidad/acta/lote?${params.toString()}`,
      { movimientos_ids: ids },
      { responseType: 'blob' }
    );
    return response.data;
  },

  getActivosLookup: async (): Promise<Activo[]> => {
    const response = await client.get<Activo[]>('/core/activos');
    return response.data;
  },

  getPersonasLookup: async (): Promise<PersonaResumen[]> => {
    const response = await client.get<PersonaResumen[]>('/org/personas'); 
    return response.data;
  },

  getAreasLookup: async (): Promise<Array<Area & { ruta: string }>> => {
    const response = await client.get<Array<Area & { ruta: string }>>('/geo/areas/all');
    return response.data;
  },

  getAreas: async (): Promise<Array<Area & { ruta: string }>> => {
    const response = await client.get<Array<Area & { ruta: string }>>('/geo/areas/all');
    return response.data;
  },

  // Paginación de movimientos
  getMovementsPaged: async (skip = 0, limit = 50): Promise<Movimiento[]> => {
    const response = await client.get<Movimiento[]>(`/trazabilidad/movimientos?skip=${skip}&limit=${limit}`);
    return response.data;
  },
};
