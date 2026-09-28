import client from '../../api/axios';
import {
  Consumible, ConsumibleCreate, MovimientoConsumible, StockMovimientoCreate,
} from '../../types/consumables';

export const consumableService = {
  list: async (bajoStock = false): Promise<Consumible[]> => {
    const q = bajoStock ? '?bajo_stock=true' : '';
    const r = await client.get<Consumible[]>(`/consumibles${q}`);
    return r.data;
  },

  create: async (data: ConsumibleCreate): Promise<Consumible> => {
    const r = await client.post<Consumible>('/consumibles', data);
    return r.data;
  },

  update: async (id: number, data: Partial<ConsumibleCreate> & { CON_Activo?: boolean }): Promise<Consumible> => {
    const r = await client.patch<Consumible>(`/consumibles/${id}`, data);
    return r.data;
  },

  remove: async (id: number): Promise<void> => {
    await client.delete(`/consumibles/${id}`);
  },

  entrada: async (id: number, data: StockMovimientoCreate): Promise<MovimientoConsumible> => {
    const r = await client.post<MovimientoConsumible>(`/consumibles/${id}/entrada`, data);
    return r.data;
  },

  salida: async (id: number, data: StockMovimientoCreate): Promise<MovimientoConsumible> => {
    const r = await client.post<MovimientoConsumible>(`/consumibles/${id}/salida`, data);
    return r.data;
  },

  movimientos: async (id: number): Promise<MovimientoConsumible[]> => {
    const r = await client.get<MovimientoConsumible[]>(`/consumibles/${id}/movimientos`);
    return r.data;
  },
};
