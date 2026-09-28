// Catálogo de Tipos (Asignación, Préstamo, etc.)
export interface TipoMovimiento {
  TMO_Tipo_Movimiento: number;
  TMO_Nombre: string;
}

// Estructura de un Movimiento (Lectura)
export interface Movimiento {
  MOV_Movimiento: string; // UUID
  MOV_Fecha_Asignacion: string;
  MOV_Fecha_Devolucion: string | null;
  MOV_Observacion: string | null;
  
  // Relaciones (IDs)
  ACT_Activo: string; 
  PER_Persona: string;
  ARE_Area: number;
  TMO_Tipo_Movimiento: number;
  
  // Objetos anidados (Para mostrar nombres en la tabla)
  activo?: {
    ACT_Codigo_Interno: string;
    ACT_Hostname: string | null;
  };
  persona?: {
    PER_Primer_Nombre: string;
    PER_Primer_Apellido: string;
    PER_Email_Corporativo: string;
  };
  tipo_movimiento?: {
    TMO_Nombre: string;
  };
  area?: {
    ARE_Nombre: string;
  };
}

// DTO para Crear
export interface MovimientoCreate {
  ACT_Activo: string;
  PER_Persona: string;
  ARE_Area: number;
  TMO_Tipo_Movimiento: number;
  MOV_Observacion?: string;
  ACT_Hostname?: string | null;
}
