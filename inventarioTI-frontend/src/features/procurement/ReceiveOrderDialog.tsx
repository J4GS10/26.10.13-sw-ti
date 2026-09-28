import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, CircularProgress, Stack, MenuItem, Typography, Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import client from '../../api/axios';
import { getApiErrorMessage } from '../../api/errors';
import { procurementService, RecibirOrdenActivoPayload, RecibirOrdenConsumiblePayload, RecibirOrdenLicenciaPayload, } from './procurementService';
import { consumableService } from '../consumables/consumableService';
import { assetService } from '../assets/assetService';
import { softwareService } from '../software/softwareService';
import { OrdenCompra, LineaOrden } from '../../types/procurement';
import { Consumible } from '../../types/consumables';
import { TipoActivo } from '../../types/inventory';
import { Software, TipoLicencia } from '../../types/software';
import { MoneyField, SectionCard } from '../../components/ui';
type Modo = 'ignorar' | 'consumible' | 'activo' | 'licencia';
interface LineConfig {
    modo: Modo;
    con_id?: number | '';
    cantidad?: number;
    series?: string;
    hostnames?: string;
    tipo?: number | '';
    modelo?: number | '';
    fecha?: string;
    garantia?: string;
    costo?: string;
    software?: number | '';
    tipoLicencia?: number | '';
    vencimientoLicencia?: string;
    clavesLicencia?: string;
    referenciasLicencia?: string;
}
interface ModeloFlat {
    MOD_Modelo: number;
    MOD_Nombre: string;
    MAR_Nombre?: string | null;
    TAC_Tipo_Activo?: number | null;
}
interface Props {
    open: boolean;
    orden: OrdenCompra | null;
    onClose: (refresh?: boolean) => void;
}
export const ReceiveOrderDialog = ({ open, orden, onClose }: Props) => {
    const { t } = useTranslation();
    const { enqueueSnackbar } = useSnackbar();
    const [consumibles, setConsumibles] = useState<Consumible[]>([]);
    const [tipos, setTipos] = useState<TipoActivo[]>([]);
    const [modelos, setModelos] = useState<ModeloFlat[]>([]);
    const [software, setSoftware] = useState<Software[]>([]);
    const [tiposLicencia, setTiposLicencia] = useState<TipoLicencia[]>([]);
    const [cfg, setCfg] = useState<Record<number, LineConfig>>({});
    const [loading, setLoading] = useState(false);
    const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
    useEffect(() => {
        if (!open || !orden)
            return;
        consumableService.list().then(setConsumibles).catch(() => setConsumibles([]));
        assetService.getTipos().then(setTipos).catch(() => setTipos([]));
        client.get<ModeloFlat[]>('/cat/modelos-flat').then((r) => setModelos(r.data)).catch(() => setModelos([]));
        softwareService.getSoftware().then(setSoftware).catch(() => setSoftware([]));
        softwareService.getTiposLicencia().then(setTiposLicencia).catch(() => setTiposLicencia([]));
        const initial: Record<number, LineConfig> = {};
        (orden.lineas ?? []).forEach((l) => {
            // Costo por unidad prellenado con el precio unitario de la línea (editable).
            const precio = Number(l.OCL_Precio_Unitario);
            initial[l.OCL_Linea as number] = { modo: 'ignorar', cantidad: l.OCL_Cantidad, fecha: today, costo: precio > 0 ? String(l.OCL_Precio_Unitario) : undefined };
        });
        setCfg(initial);
    }, [open, orden, today]);
    const upd = (linea: number, patch: Partial<LineConfig>) => setCfg((p) => ({ ...p, [linea]: { ...p[linea], ...patch } }));
    const modelosDeTipo = (tipo?: number | '') => !tipo ? modelos : modelos.filter((m) => m.TAC_Tipo_Activo == null || m.TAC_Tipo_Activo === Number(tipo));
    const splitLines = (value?: string) => (value ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const handleSubmit = async () => {
        if (!orden)
            return;
        const consumiblesPayload: RecibirOrdenConsumiblePayload[] = [];
        const activosPayload: RecibirOrdenActivoPayload[] = [];
        const licenciasPayload: RecibirOrdenLicenciaPayload[] = [];
        for (const l of orden.lineas ?? []) {
            const c = cfg[l.OCL_Linea as number];
            if (!c || c.modo === 'ignorar')
                continue;
            if (c.modo === 'consumible') {
                if (!c.con_id || !c.cantidad) {
                    enqueueSnackbar(t('procurement.recv_err_consumible'), { variant: 'warning' });
                    return;
                }
                consumiblesPayload.push({ OCL_Linea: l.OCL_Linea, CON_Consumible: Number(c.con_id), cantidad: Number(c.cantidad) });
            }
            else if (c.modo === 'activo') {
                const series = splitLines(c.series);
                const hostnames = splitLines(c.hostnames);
                if (series.length !== Number(l.OCL_Cantidad)) {
                    enqueueSnackbar(t('procurement.recv_err_asset_count'), { variant: 'warning' });
                    return;
                }
                if (!c.tipo || !c.modelo || !c.fecha) {
                    enqueueSnackbar(t('procurement.recv_err_activo'), { variant: 'warning' });
                    return;
                }
                series.forEach((serie, index) => {
                    activosPayload.push({
                        OCL_Linea: l.OCL_Linea,
                        ACT_Serie_Fabricante: serie,
                        MOD_Modelo: Number(c.modelo),
                        TAC_Tipo_Activo: Number(c.tipo),
                        ACT_Hostname: hostnames[index] || null,
                        ACT_Fecha_Compra: c.fecha as string,
                        ACT_Fin_Garantia: c.garantia || null,
                        ACT_Costo: c.costo ? Number(c.costo) : null,
                    });
                });
            }
            else if (c.modo === 'licencia') {
                const claves = splitLines(c.clavesLicencia);
                const referencias = splitLines(c.referenciasLicencia);
                if (!c.software || !c.tipoLicencia) {
                    enqueueSnackbar(t('procurement.recv_err_license_catalog'), { variant: 'warning' });
                    return;
                }
                if (claves.length !== Number(l.OCL_Cantidad)) {
                    enqueueSnackbar(t('procurement.recv_err_license_count'), { variant: 'warning' });
                    return;
                }
                licenciasPayload.push({
                    OCL_Linea: l.OCL_Linea,
                    SOF_Software: Number(c.software),
                    TLI_Tipo_Licencia: Number(c.tipoLicencia),
                    cantidad: claves.length,
                    LIC_Fecha_Vencimiento: c.vencimientoLicencia || null,
                    claves: claves.map((clave, index) => ({
                        LCL_Clave_Activacion: clave,
                        LCL_Referencia: referencias[index] || null,
                    })),
                });
            }
        }
        setLoading(true);
        try {
            const res = await procurementService.recibir(orden.OCO_Orden, {
                consumibles: consumiblesPayload, activos: activosPayload, licencias: licenciasPayload,
            });
            enqueueSnackbar(`${t('procurement.recv_ok')}: ${t('procurement.recv_restocked', { count: res.consumibles_reabastecidos })}, ${t('procurement.recv_created', { count: res.activos_creados })}, ${t('procurement.recv_license_keys', { count: res.licencias_claves_creadas ?? 0 })}`, { variant: 'success' });
            onClose(true);
        }
        catch (err: unknown) {
            enqueueSnackbar(getApiErrorMessage(err, t('common.error_generic')), { variant: 'error' });
        }
        finally {
            setLoading(false);
        }
    };
    if (!orden)
        return null;
    return (<Dialog open={open} onClose={() => onClose()} maxWidth="md" fullWidth>
      <DialogTitle>{t('procurement.receive_title')} {orden.OCO_Numero}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('procurement.receive_help')}</Typography>
        <Stack spacing={2}>
        {(orden.lineas ?? []).map((l: LineaOrden) => {
            const c = cfg[l.OCL_Linea as number] ?? { modo: 'ignorar' };
            return (<SectionCard key={l.OCL_Linea} title={l.OCL_Descripcion} subtitle={`${t('procurement.line_qty')}: ${l.OCL_Cantidad}`} noPadding={c.modo === 'ignorar'} actions={(<TextField select size="small" label={t('procurement.recv_action')} value={c.modo} onChange={(e) => upd(l.OCL_Linea as number, { modo: e.target.value as Modo })} sx={{ minWidth: 170 }}>
                  <MenuItem value="ignorar">{t('procurement.recv_ignore')}</MenuItem>
                  <MenuItem value="consumible">{t('procurement.recv_consumible')}</MenuItem>
                  <MenuItem value="activo">{t('procurement.recv_asset')}</MenuItem>
                  <MenuItem value="licencia">{t('procurement.recv_license')}</MenuItem>
                </TextField>)}>

              {c.modo === 'consumible' && (<Stack direction="row" spacing={2}>
                  <TextField select size="small" fullWidth label={t('menu.consumables')} value={c.con_id ?? ''} onChange={(e) => upd(l.OCL_Linea as number, { con_id: Number(e.target.value) })}>
                    {consumibles.map((cn) => (<MenuItem key={cn.CON_Consumible} value={cn.CON_Consumible}>{cn.CON_Nombre}</MenuItem>))}
                  </TextField>
                  <TextField size="small" type="number" label={t('consumables.quantity')} value={c.cantidad ?? l.OCL_Cantidad} onChange={(e) => upd(l.OCL_Linea as number, { cantidad: Number(e.target.value) })} sx={{ width: 130 }}/>
                </Stack>)}

              {c.modo === 'activo' && (<Stack spacing={1.5}>
                  <TextField size="small" fullWidth multiline minRows={3} label={t('procurement.serials_one_per_unit')} helperText={t('procurement.expected_units', { count: l.OCL_Cantidad })} value={c.series ?? ''} onChange={(e) => upd(l.OCL_Linea as number, { series: e.target.value })}/>
                  <TextField size="small" fullWidth multiline minRows={2} label={t('procurement.hostnames_optional')} value={c.hostnames ?? ''} onChange={(e) => upd(l.OCL_Linea as number, { hostnames: e.target.value })}/>
                  <Stack direction="row" spacing={2}>
                    <TextField select size="small" fullWidth label={t('assets.dialog.type')} value={c.tipo ?? ''} onChange={(e) => upd(l.OCL_Linea as number, { tipo: Number(e.target.value), modelo: '' })}>
                      {tipos.map((tp) => (<MenuItem key={tp.TAC_Tipo_Activo} value={tp.TAC_Tipo_Activo}>
                          {tp.TAC_Nombre}{tp.TAC_Prefijo ? ` (${tp.TAC_Prefijo})` : ''}
                        </MenuItem>))}
                    </TextField>
                    <TextField select size="small" fullWidth label={t('assets.dialog.model')} value={c.modelo ?? ''} disabled={!c.tipo} onChange={(e) => upd(l.OCL_Linea as number, { modelo: Number(e.target.value) })}>
                      {modelosDeTipo(c.tipo).map((m) => (<MenuItem key={m.MOD_Modelo} value={m.MOD_Modelo}>
                          {m.MAR_Nombre ? `${m.MAR_Nombre} ` : ''}{m.MOD_Nombre}
                        </MenuItem>))}
                    </TextField>
                  </Stack>
                  <Stack direction="row" spacing={2}>
                    <TextField size="small" type="date" label={t('procurement.date')} value={c.fecha ?? today} onChange={(e) => upd(l.OCL_Linea as number, { fecha: e.target.value })} InputLabelProps={{ shrink: true }}/>
                    <TextField size="small" type="date" label={t('procurement.warranty_end')} value={c.garantia ?? ''} onChange={(e) => upd(l.OCL_Linea as number, { garantia: e.target.value })} InputLabelProps={{ shrink: true }}/>
                    <MoneyField size="small" label={t('assets.dialog.cost')} value={c.costo ?? ''} onChange={(value) => upd(l.OCL_Linea as number, { costo: value })} currency={orden.OCO_Moneda}/>
                  </Stack>
                  {Number(l.OCL_Cantidad) > 1 && (<Chip size="small" color="info" variant="outlined" label={t('procurement.assets_bulk_hint')}/>)}
                </Stack>)}

              {c.modo === 'licencia' && (<Stack spacing={1.5}>
                  <Stack direction="row" spacing={2}>
                    <TextField select size="small" fullWidth label={t('software.col_software')} value={c.software ?? ''} onChange={(e) => upd(l.OCL_Linea as number, { software: Number(e.target.value) })}>
                      {software.map((sw) => (<MenuItem key={sw.SOF_Software} value={sw.SOF_Software}>
                          {sw.SOF_Nombre}{sw.SOF_Version ? ` ${sw.SOF_Version}` : ''}
                        </MenuItem>))}
                    </TextField>
                    <TextField select size="small" fullWidth label={t('software.license_type')} value={c.tipoLicencia ?? ''} onChange={(e) => upd(l.OCL_Linea as number, { tipoLicencia: Number(e.target.value) })}>
                      {tiposLicencia.map((tl) => (<MenuItem key={tl.TLI_Tipo_Licencia} value={tl.TLI_Tipo_Licencia}>{tl.TLI_Nombre}</MenuItem>))}
                    </TextField>
                  </Stack>
                  <TextField size="small" fullWidth multiline minRows={4} label={t('procurement.license_keys_one_per_unit')} helperText={t('procurement.expected_units', { count: l.OCL_Cantidad })} value={c.clavesLicencia ?? ''} onChange={(e) => upd(l.OCL_Linea as number, { clavesLicencia: e.target.value })}/>
                  <TextField size="small" fullWidth multiline minRows={2} label={t('procurement.license_refs_optional')} value={c.referenciasLicencia ?? ''} onChange={(e) => upd(l.OCL_Linea as number, { referenciasLicencia: e.target.value })}/>
                  <TextField size="small" type="date" label={t('software.expiry')} value={c.vencimientoLicencia ?? ''} onChange={(e) => upd(l.OCL_Linea as number, { vencimientoLicencia: e.target.value })} InputLabelProps={{ shrink: true }} sx={{ maxWidth: 220 }}/>
                </Stack>)}
            </SectionCard>);
        })}
        </Stack>
        {(orden.lineas ?? []).length === 0 && (<Typography color="text.secondary">
            {t('procurement.recv_no_lines')}
          </Typography>)}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()} color="inherit">{t('common.cancel')}</Button>
        <Button variant="contained" color="success" onClick={handleSubmit} disabled={loading}>
          {loading ? <CircularProgress size={24}/> : t('procurement.confirm_receive')}
        </Button>
      </DialogActions>
    </Dialog>);
};
