import client from './axios';
import { downloadCsv, downloadFile } from './downloadCsv';
import type { SupportedLanguage } from '../types/language';
import { hoyLocal } from '../utils/dates';
import type {
  BajaPayload, ComponentesActivo, CustodiaItem, DevolucionPayload, DevolucionResultado, ItemAtencion,
  KardexFiltros, KardexPagina, LecturaResultado, ResumenEntradasSalidas, Toma, TomaDetalle,
} from '../types/kardex';

/** Convierte los filtros a query string (los arreglos se repiten: tipos=A&tipos=B). */
function params(filtros: KardexFiltros & Record<string, unknown>): URLSearchParams {
  const p = new URLSearchParams();
  Object.entries(filtros).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    if (Array.isArray(v)) v.forEach((x) => p.append(k, String(x)));
    else p.set(k, String(v));
  });
  return p;
}

export const inventarioService = {
  kardex: async (filtros: KardexFiltros, limite = 50, desplazamiento = 0): Promise<KardexPagina> =>
    (await client.get<KardexPagina>(`/inventario/kardex?${params({ ...filtros, limite, desplazamiento })}`)).data,
  kardexCsv: (filtros: KardexFiltros, lang: SupportedLanguage) =>
    downloadCsv(`/inventario/kardex.csv?${params({ ...filtros })}`, `kardex_${hoyLocal()}.csv`, lang),

  custodia: async (filtros: { fecha?: string; persona_id?: string; area_id?: number; sede_id?: number }) =>
    (await client.get<CustodiaItem[]>(`/inventario/custodia?${params(filtros)}`)).data,
  custodiaCsv: (filtros: { fecha?: string; sede_id?: number }, lang: SupportedLanguage) =>
    downloadCsv(`/inventario/custodia.csv?${params(filtros)}`, 'custodia.csv', lang),

  entradasSalidas: async (filtros: { desde?: string; hasta?: string; sede_id?: number }) =>
    (await client.get<ResumenEntradasSalidas>(`/inventario/entradas-salidas?${params(filtros)}`)).data,

  atencion: async () => (await client.get<{ items: ItemAtencion[] }>('/inventario/atencion')).data.items,

  hojaDeVida: (activoId: string, lang: SupportedLanguage) =>
    downloadFile(`/inventario/activos/${activoId}/hoja-de-vida.pdf`, 'hoja_de_vida.pdf', { lang }),
  licenciasCsv: (lang: SupportedLanguage) => downloadCsv('/inventario/licencias.csv', 'licencias.csv', lang),

  // --- Toma de inventario ---
  tomas: async () => (await client.get<Toma[]>('/inventario/tomas')).data,
  crearToma: async (data: { SED_Sede: number; ARE_Area?: number | null; TOM_Observacion?: string }) =>
    (await client.post<Toma>('/inventario/tomas', data)).data,
  toma: async (id: number) => (await client.get<TomaDetalle>(`/inventario/tomas/${id}`)).data,
  leer: async (id: number, codigo: string, areaId?: number | null) =>
    (await client.post<LecturaResultado>(`/inventario/tomas/${id}/lecturas`, { codigo, ARE_Area: areaId ?? null })).data,
  cerrarToma: async (id: number, actualizarUbicacion: boolean) =>
    (await client.post<TomaDetalle>(`/inventario/tomas/${id}/cerrar`, null,
      { params: { actualizar_ubicacion: actualizarUbicacion } })).data,
  anularToma: async (id: number) => (await client.post<Toma>(`/inventario/tomas/${id}/anular`)).data,
  reporteToma: (id: number, lang: SupportedLanguage) =>
    downloadCsv(`/inventario/tomas/${id}/reporte.csv`, `toma_${id}.csv`, lang),

  // --- Activo: componentes, baja y devolución ---
  componentes: async (activoId: string) =>
    (await client.get<ComponentesActivo>(`/core/activos/${activoId}/componentes`)).data,
  instalarComponente: async (activoId: string, componenteId: string, motivo?: string) =>
    (await client.post<ComponentesActivo>(`/core/activos/${activoId}/componentes`,
      { ACT_Componente: componenteId, motivo: motivo || undefined })).data,
  retirarComponente: async (activoId: string, componenteId: string, motivo: string | undefined,
    estadoDestino: 'Disponible' | 'En Bodega') =>
    (await client.post<ComponentesActivo>(`/core/activos/${activoId}/componentes/${componenteId}/retirar`,
      { motivo: motivo || undefined, estado_destino: estadoDestino })).data,
  darDeBaja: async (activoId: string, data: BajaPayload) =>
    (await client.post(`/core/activos/${activoId}/baja`, data)).data,
  devolver: async (data: DevolucionPayload) =>
    (await client.post<DevolucionResultado>('/trazabilidad/devolucion', data)).data,
};
