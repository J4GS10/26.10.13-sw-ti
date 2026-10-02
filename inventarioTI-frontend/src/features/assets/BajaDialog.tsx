import { useEffect, useState } from 'react';
import {
  Alert, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  MenuItem, Stack, TextField,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { inventarioService } from '../../api/inventarioService';
import { getApiErrorCode, getApiErrorMessage, getApiErrorParams } from '../../api/errors';
import { DESTINOS_BAJA, MOTIVOS_BAJA, type BajaPayload } from '../../types/kardex';
import { hoyLocal } from '../../utils/dates';

interface Props {
  open: boolean;
  activo: { ACT_Activo: string; ACT_Codigo_Interno: string } | null;
  onClose: (changed: boolean) => void;
}

/**
 * Baja formal: motivo, destino, fecha y documento de respaldo. Es una SALIDA
 * del inventario que queda en el kardex; libera las licencias del equipo y,
 * si tiene componentes instalados, pide confirmación para retirarlos.
 */
export const BajaDialog = ({ open, activo, onClose }: Props) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [motivo, setMotivo] = useState<BajaPayload['motivo'] | ''>('');
  const [destino, setDestino] = useState<BajaPayload['destino'] | ''>('');
  const [fecha, setFecha] = useState(hoyLocal());
  const [documento, setDocumento] = useState('');
  const [observacion, setObservacion] = useState('');
  const [componentes, setComponentes] = useState<number | null>(null);
  const [retirar, setRetirar] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMotivo('');
    setDestino('');
    setFecha(hoyLocal());
    setDocumento('');
    setObservacion('');
    setComponentes(null);
    setRetirar(false);
  }, [open]);

  const requiereDetalle = motivo === 'OTRO' || destino === 'OTRO';
  const valido = !!motivo && !!destino && (!requiereDetalle || !!observacion.trim()) && (componentes == null || retirar);

  const confirmar = async () => {
    if (!activo || !motivo || !destino) return;
    setEnviando(true);
    try {
      await inventarioService.darDeBaja(activo.ACT_Activo, {
        motivo, destino, fecha, documento: documento.trim() || undefined,
        observacion: observacion.trim() || undefined, retirar_componentes: retirar,
      });
      // Separación de funciones: la baja la ejecuta el Jefe de TI al aprobarla.
      enqueueSnackbar(t('decommission.requested', { code: activo.ACT_Codigo_Interno }), { variant: 'success' });
      onClose(true);
    } catch (err) {
      if (getApiErrorCode(err) === 'ASSET_HAS_COMPONENTS') {
        // Diálogo: se explica por qué no se pudo y se ofrece la solución.
        setComponentes(Number(getApiErrorParams(err)[0]) || 1);
      } else {
        enqueueSnackbar(getApiErrorMessage(err, t('common.error_save')), { variant: 'error' });
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => onClose(false)} maxWidth="sm" fullWidth>
      <DialogTitle>{t('decommission.title', { code: activo?.ACT_Codigo_Interno ?? '' })}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="warning">{t('decommission.warning')}</Alert>
          <Alert severity="info">{t('decommission.approval_note')}</Alert>
          <TextField select required label={t('decommission.reason')} value={motivo}
            onChange={(e) => setMotivo(e.target.value as BajaPayload['motivo'])}>
            {MOTIVOS_BAJA.map((m) => <MenuItem key={m} value={m}>{t(`decommission.reasons.${m}`)}</MenuItem>)}
          </TextField>
          <TextField select required label={t('decommission.destination')} value={destino}
            onChange={(e) => setDestino(e.target.value as BajaPayload['destino'])}>
            {DESTINOS_BAJA.map((d) => <MenuItem key={d} value={d}>{t(`decommission.destinations.${d}`)}</MenuItem>)}
          </TextField>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField type="date" label={t('decommission.date')} value={fecha} onChange={(e) => setFecha(e.target.value)}
              InputLabelProps={{ shrink: true }} inputProps={{ max: hoyLocal() }} fullWidth />
            <TextField label={t('decommission.document')} value={documento} onChange={(e) => setDocumento(e.target.value)}
              helperText={t('decommission.document_help')} inputProps={{ maxLength: 120 }} fullWidth />
          </Stack>
          <TextField label={t('decommission.note')} value={observacion} onChange={(e) => setObservacion(e.target.value)}
            multiline minRows={2} inputProps={{ maxLength: 500 }} required={requiereDetalle}
            error={requiereDetalle && !observacion.trim()}
            helperText={requiereDetalle ? t('decommission.note_required') : undefined} />
          {componentes != null && (
            <Alert severity="info">
              {t('decommission.has_components', { count: componentes })}
              <FormControlLabel sx={{ display: 'block', mt: 1 }}
                control={<Checkbox checked={retirar} onChange={(e) => setRetirar(e.target.checked)} />}
                label={t('decommission.remove_components')} />
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button color="inherit" onClick={() => onClose(false)}>{t('common.cancel')}</Button>
        <Button variant="contained" color="error" onClick={confirmar} disabled={!valido || enviando}>
          {enviando ? <CircularProgress size={22} /> : t('decommission.request')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
