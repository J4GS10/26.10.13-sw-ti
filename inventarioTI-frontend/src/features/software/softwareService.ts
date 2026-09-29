import client from '../../api/axios';
import {
  Software, SoftwareCreate,
  Licencia, LicenciaCreate,
  LicenciaClave,
  TipoLicencia, TipoLicenciaCreate,
  Instalacion, InstalacionCreate, HistorialLicencia,
} from '../../types/software';

export const softwareService = {
  // --- SOFTWARE ---
  getSoftware: async (): Promise<Software[]> => {
    const response = await client.get<Software[]>('/soft/software');
    return response.data;
  },
  createSoftware: async (data: SoftwareCreate): Promise<Software> => {
    const response = await client.post<Software>('/soft/software', data);
    return response.data;
  },

  updateSoftware: async (id: number, data: Partial<SoftwareCreate>): Promise<Software> => {
    const response = await client.patch<Software>(`/soft/software/${id}`, data);
    return response.data;
  },

  deleteSoftware: async (id: number): Promise<void> => {
    await client.delete(`/soft/software/${id}`);
  },

  // --- TIPOS DE LICENCIA ---
  getTiposLicencia: async (): Promise<TipoLicencia[]> => {
    const response = await client.get<TipoLicencia[]>('/soft/tipos-licencia');
    return response.data;
  },
  createTipoLicencia: async (data: TipoLicenciaCreate): Promise<TipoLicencia> => {
    const response = await client.post<TipoLicencia>('/soft/tipos-licencia', data);
    return response.data;
  },

  updateTipoLicencia: async (id: number, data: Partial<TipoLicenciaCreate>): Promise<TipoLicencia> => {
    const response = await client.patch<TipoLicencia>(`/soft/tipos-licencia/${id}`, data);
    return response.data;
  },

  deleteTipoLicencia: async (id: number): Promise<void> => {
    await client.delete(`/soft/tipos-licencia/${id}`);
  },

  // --- LICENCIAS (INVENTARIO) ---
  getLicenciasBySoftware: async (softwareId: number): Promise<Licencia[]> => {
    const response = await client.get<Licencia[]>(`/soft/licencias?software_id=${softwareId}`);
    return response.data;
  },
  historialLicencia: async (licenciaId: number): Promise<HistorialLicencia[]> => {
    const response = await client.get<HistorialLicencia[]>(`/soft/licencias/${licenciaId}/historial`);
    return response.data;
  },
  getClavesLicencia: async (licenciaId: number): Promise<LicenciaClave[]> => {
    const response = await client.get<LicenciaClave[]>(`/soft/licencias/${licenciaId}/claves`);
    return response.data;
  },
  createLicencia: async (data: LicenciaCreate): Promise<Licencia> => {
    const response = await client.post<Licencia>('/soft/licencias', data);
    return response.data;
  },

  updateLicencia: async (id: number, data: Partial<LicenciaCreate>): Promise<Licencia> => {
    const response = await client.patch<Licencia>(`/soft/licencias/${id}`, data);
    return response.data;
  },

  deleteLicencia: async (id: number): Promise<void> => {
    await client.delete(`/soft/licencias/${id}`);
  },

  // --- INSTALACIONES (NUEVO) ---
  createInstalacion: async (data: InstalacionCreate): Promise<Instalacion> => {
    const response = await client.post<Instalacion>('/soft/instalaciones', data);
    return response.data;
  },
  desinstalarSoftware: async (data: InstalacionCreate): Promise<void> => {
    await client.post('/soft/instalaciones/desinstalar', data);
  }
};
