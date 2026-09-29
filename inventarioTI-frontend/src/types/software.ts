// --- 1. TIPO DE LICENCIA ---
export interface TipoLicencia {
  TLI_Tipo_Licencia: number;
  TLI_Nombre: string;
  TLI_Descripcion?: string | null;
}

export interface TipoLicenciaCreate {
  TLI_Nombre: string;
  TLI_Descripcion?: string;
}

// --- 2. SOFTWARE ---
export interface Software {
  SOF_Software: number;
  SOF_Nombre: string;
  SOF_Version?: string | null;
  SOF_Fabricante: string;
}

export interface SoftwareCreate {
  SOF_Nombre: string;
  SOF_Version?: string;
  SOF_Fabricante: string;
}

// --- 3. LICENCIA (INVENTARIO) ---
export interface Licencia {
  LIC_Licencia: number;
  LIC_Clave_Activacion?: string | null;
  LIC_Fecha_Vencimiento?: string | null;
  LIC_Cantidad_Total: number;
  LIC_Cantidad_Usada: number;
  LIC_Claves_Total?: number;
  LIC_Claves_Disponibles?: number;
  LIC_Claves_Asignadas?: number;
  /** Costo de la licencia y su moneda (GTQ/USD/CHF). */
  LIC_Costo?: string | number | null;
  LIC_Moneda?: string | null;
  
  // FKs y Relaciones
  SOF_Software: number;
  TLI_Tipo_Licencia: number;
  
  // Objetos anidados (si el backend los envía para mostrar nombres en tablas)
  software?: Software;
  tipo_licencia?: TipoLicencia;
}

export interface LicenciaClaveCreate {
  LCL_Clave_Activacion: string;
  LCL_Referencia?: string | null;
}

export interface LicenciaClave {
  LCL_Licencia_Clave: number;
  LIC_Licencia: number;
  LCL_Clave_Activacion: string;
  LCL_Referencia?: string | null;
  LCL_Estado: 'DISPONIBLE' | 'ASIGNADA' | 'RETIRADA';
  LCL_Creado_En?: string | null;
  LCL_Asignada_En?: string | null;
  LCL_Destino_Tipo?: 'ACTIVO' | 'PERSONA' | null;
  LCL_Destino_Id?: string | null;
  LCL_Destino_Nombre?: string | null;
  LCL_Destino_Detalle?: string | null;
}

export interface LicenciaCreate {
  LIC_Clave_Activacion?: string;
  LIC_Fecha_Vencimiento?: string;
  LIC_Cantidad_Total: number;
  SOF_Software: number;
  TLI_Tipo_Licencia: number;
  LIC_Claves?: LicenciaClaveCreate[];
  LIC_Costo?: string | null;
  LIC_Moneda?: string | null;
}

/** Una asignación de la licencia (vigente o retirada). */
export interface HistorialLicencia {
  INS_Instalacion: number;
  destino: 'ACTIVO' | 'PERSONA';
  ACT_Activo?: string | null;
  activo_codigo?: string | null;
  PER_Persona?: string | null;
  persona_nombre?: string | null;
  LCL_Licencia_Clave?: number | null;
  INS_Fecha_Instalacion: string;
  INS_Estado: boolean;
  INS_Fecha_Retiro?: string | null;
  INS_Motivo_Retiro?: string | null;
}

// --- 4. INSTALACIÓN (NUEVO) ---
export interface Instalacion {
  INS_Instalacion: number;
  INS_Fecha_Instalacion: string;
  INS_Estado: boolean;
  ACT_Activo: string; // ID del activo (Vinculación)
  LIC_Licencia: number; // ID de la licencia consumida
  LCL_Licencia_Clave?: number | null;
}

export interface InstalacionCreate {
  ACT_Activo: string;
  LIC_Licencia: number;
  LCL_Licencia_Clave?: number | null;
  INS_Fecha_Instalacion?: string;
}
