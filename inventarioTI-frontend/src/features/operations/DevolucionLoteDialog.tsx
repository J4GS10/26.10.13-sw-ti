import { useEffect, useState } from 'react';
import {
  Autocomplete, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, Radio, RadioGroup, Stack, TextField, Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { getApiErrorMessage } from '../../api/errors';
import { productividadService, type ResultadoLote } from '../../api/productividadService';
import type { Activo } from '../../types/inventory';
import type { Area } from '../../types/geo';
import { movementService } from './movementService';
import { EntregaResultado } from './EntregaResultado';

const MOTIVOS = ['renuncia', 'cambio_equipo', 'fin_prestamo', 'falla', 'reasignacion', 'otro'] as const;

interface Props {
  open: boolean;
  activos: Activo[];
  onClose: (changed: boolean) => void;
}

/** Devolución a bodega de varios equipos a la vez (todo o nada) con una sola hoja de descargo. */
export const DevolucionLoteDialog = ({ open, activos, onClose }: Props) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [areas, setAreas] = useState<Area[]>([]);
  const [area, setArea] = useState<Area | null>(null);
  const [motivo, setMotivo] = useState<typeof MOTIVOS[number] | ''>('');
  const [detalle, setDetalle] = useState('');
  const [condicion, setCondicion] = useState<'BUENO' | 'CON_DANO'>('BUENO');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoLote | null>(null);

  useEffect(() => {
    if (!open) return;
    setResultado(null); setMotivo(''); setDetalle(''); setArea(null); setCondicion('BUENO');
    movementService.getAreas().then(setAreas).catch(() => setAreas([]));
  }, [open]);

  const enviar = async () => {
    setEnviando(true);
    try {
      const texto = [motivo ? t(`returns.reasons.${motivo}`) : '', detalle.trim()].filter(Boolean).join(': ');
      setResultado(await productividadService.devolucionLote({
        activos: activos.map((a) => a.ACT_Activo), MOV_Motivo: texto || undefined,
        ARE_Area_Destino: area?.ARE_Area ?? null, condicion,
      }));
    } catch (err) {
      enqueueSnackbar(getApiErrorMessage(err, t('common.error_save')), { variant: 'error', autoHideDuration: 8000 });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => onClose(!!resultado)} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{t('returns_batch.title', { count: activos.length })}</DialogTitle>
      <DialogContent dividers>
        {resultado ? (
          <EntregaResultado resultado={resultado} tipoActa="descargo"
            mensaje={t('returns_batch.done', { count: resultado.total })} />
        ) : (
          <Stack spacing={2}>
            <Box>
              <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.5}>
                {activos.map((a) => <Chip key={a.ACT_Activo} size="small" label={a.ACT_Codigo_Interno} />)}
              </Stack>
            </Box>
            <TextField select SelectProps={{ native: true }} label={t('returns.reason')} value={motivo}
              onChange={(e) => setMotivo(e.target.value as typeof MOTIVOS[number] | '')} InputLabelProps={{ shrink: true }}>
              <option value="">{t('returns.choose_reason')}</option>
              {MOTIVOS.map((m) => <option key={m} value={m}>{t(`returns.reasons.${m}`)}</option>)}
            </TextField>
            <TextField label={t('returns.detail')} value={detalle} onChange={(e) => setDetalle(e.target.value)}
              inputProps={{ maxLength: 200 }} helperText={motivo === 'otro' ? t('returns.detail_required') : undefined} />
            <Autocomplete options={areas} value={area} onChange={(_, v) => setArea(v)}
              getOptionLabel={(a) => a.ARE_Nombre} isOptionEqualToValue={(a, b) => a.ARE_Area === b.ARE_Area}
              renderInput={(p) => <TextField {...p} label={t('returns.storage_area')} helperText={t('returns.storage_area_help')} />} />
            <Box>
              <Typography variant="body2" gutterBottom>{t('returns.condition')}</Typography>
              <RadioGroup row value={condicion} onChange={(e) => setCondicion(e.target.value as 'BUENO' | 'CON_DANO')}>
                <FormControlLabel value="BUENO" control={<Radio />} label={t('returns.condition_ok')} />
                <FormControlLabel value="CON_DANO" control={<Radio />} label={t('returns.condition_damaged')} />
              </RadioGroup>
            </Box>
            <Typography variant="caption" color="text.secondary">{t('returns_batch.all_or_nothing')}</Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        {resultado ? (
          <Button variant="contained" onClick={() => onClose(true)}>{t('common.close')}</Button>
        ) : (
          <>
            <Button color="inherit" onClick={() => onClose(false)}>{t('common.cancel')}</Button>
            <Button variant="contained" onClick={enviar} disabled={enviando || !motivo || (motivo === 'otro' && !detalle.trim())}
              startIcon={enviando ? <CircularProgress size={16} color="inherit" /> : undefined}>
              {t('returns_batch.submit', { count: activos.length })}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};
