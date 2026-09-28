export interface Consumible {
  CON_Consumible: number;
  CON_Nombre: string;
  CON_Descripcion?: string | null;
  CON_Categoria?: string | null;
  CON_Unidad: string;
  CON_Stock_Actual: number;
  CON_Stock_Minimo: number;
  CON_Activo: boolean;
  bajo_stock: boolean;
  /** Bodega (sede) donde se almacena. */
  SED_Sede?: number | null;
}

export interface ConsumibleCreate {
  CON_Nombre: string;
  CON_Descripcion?: string;
  CON_Categoria?: string;
  CON_Unidad: string;
  CON_Stock_Minimo: number;
  CON_Stock_Actual: number;
  SED_Sede?: number | null;
}

export interface MovimientoConsumible {
  MOC_Movimiento: number;
  MOC_Tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
  MOC_Cantidad: number;
  MOC_Stock_Resultante: number;
  MOC_Motivo?: string | null;
  MOC_Fecha: string;
  CON_Consumible: number;
  PER_Persona?: string | null;
  USU_Usuario?: string | null;
}

export interface StockMovimientoCreate {
  MOC_Cantidad: number;
  MOC_Motivo?: string;
  PER_Persona?: string;
}
