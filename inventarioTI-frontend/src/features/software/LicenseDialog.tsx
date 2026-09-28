import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, CircularProgress, Box, Stack, } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { getApiErrorMessage } from '../../api/errors';
import { softwareService } from './softwareService';
import { Licencia, LicenciaCreate, Software, TipoLicencia } from '../../types/software';
import { SectionCard } from '../../components/ui';
interface Props {
    open: boolean;
    softwarePreseleccionado?: Software | null;
    licenciaToEdit?: Licencia | null;
    onClose: (refresh?: boolean) => void;
}
interface FormValues {
    TLI_Tipo_Licencia: number | '';
    LIC_Clave_Activacion: string;
    LIC_Claves_Texto: string;
    LIC_Cantidad_Total: string;
    LIC_Fecha_Vencimiento: string;
}
const empty: FormValues = {
    TLI_Tipo_Licencia: '',
    LIC_Clave_Activacion: '',
    LIC_Claves_Texto: '',
    LIC_Cantidad_Total: '1',
    LIC_Fecha_Vencimiento: '',
};
export const LicenseDialog = ({ open, softwarePreseleccionado, licenciaToEdit, onClose }: Props) => {
    const { t } = useTranslation();
    const { enqueueSnackbar } = useSnackbar();
    const isEdit = !!licenciaToEdit;
    const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ defaultValues: empty });
    const [loading, setLoading] = useState(false);
    const [tipos, setTipos] = useState<TipoLicencia[]>([]);
    useEffect(() => {
        if (open) {
            softwareService.getTiposLicencia().then(setTipos);
        }
    }, [open]);
    useEffect(() => {
        if (!open)
            return;
        if (licenciaToEdit) {
            reset({
                TLI_Tipo_Licencia: licenciaToEdit.TLI_Tipo_Licencia,
                LIC_Clave_Activacion: licenciaToEdit.LIC_Clave_Activacion ?? '',
                LIC_Claves_Texto: '',
                LIC_Cantidad_Total: String(licenciaToEdit.LIC_Cantidad_Total ?? 1),
                LIC_Fecha_Vencimiento: licenciaToEdit.LIC_Fecha_Vencimiento ?? '',
            });
        }
        else {
            reset(empty);
        }
    }, [open, licenciaToEdit, reset]);
    const onSubmit = async (data: FormValues) => {
        setLoading(true);
        try {
            const claves = data.LIC_Claves_Texto
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean);
            const payload: Omit<LicenciaCreate, 'SOF_Software'> = {
                TLI_Tipo_Licencia: Number(data.TLI_Tipo_Licencia),
                LIC_Cantidad_Total: claves.length > 0 ? claves.length : Number(data.LIC_Cantidad_Total),
            };
            if (data.LIC_Clave_Activacion)
                payload.LIC_Clave_Activacion = data.LIC_Clave_Activacion;
            if (claves.length > 0) {
                payload.LIC_Claves = claves.map((clave) => ({ LCL_Clave_Activacion: clave }));
            }
            if (data.LIC_Fecha_Vencimiento)
                payload.LIC_Fecha_Vencimiento = data.LIC_Fecha_Vencimiento;
            if (isEdit && licenciaToEdit) {
                await softwareService.updateLicencia(licenciaToEdit.LIC_Licencia, payload);
                enqueueSnackbar(t('common.success_update'), { variant: 'success' });
            }
            else {
                if (!softwarePreseleccionado)
                    return;
                await softwareService.createLicencia({
                    ...payload,
                    SOF_Software: softwarePreseleccionado.SOF_Software,
                });
                enqueueSnackbar(t('software.license_added'), { variant: 'success' });
            }
            onClose(true);
        }
        catch (err: unknown) {
            enqueueSnackbar(getApiErrorMessage(err, t('common.error_save')), { variant: 'error' });
        }
        finally {
            setLoading(false);
        }
    };
    return (<Dialog open={open} onClose={() => onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>
        {isEdit
            ? t('software.edit_license')
            : t('software.add_license_for', { name: softwarePreseleccionado?.SOF_Nombre ?? '' })}
      </DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <SectionCard title={t('software.sections.licensing')}>
              <Controller name="TLI_Tipo_Licencia" control={control} rules={{ required: true }} render={({ field }) => (<TextField {...field} select fullWidth label={t('software.license_type')} error={!!errors.TLI_Tipo_Licencia} required>
                    {tipos.map((tl) => (<MenuItem key={tl.TLI_Tipo_Licencia} value={tl.TLI_Tipo_Licencia}>
                        {tl.TLI_Nombre}
                      </MenuItem>))}
                  </TextField>)}/>
            </SectionCard>
            <SectionCard title={t('software.sections.keys')}>
              <Stack spacing={2}>
                <Controller name="LIC_Clave_Activacion" control={control} render={({ field }) => (<TextField {...field} fullWidth label={t('software.activation_key')}/>)}/>

                {!isEdit && (<Controller name="LIC_Claves_Texto" control={control} render={({ field }) => (<TextField {...field} fullWidth multiline minRows={4} label={t('software.individual_keys')} helperText={t('software.individual_keys_help')}/>)}/>)}
              </Stack>
            </SectionCard>
            <SectionCard title={t('software.sections.validity')}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Controller name="LIC_Cantidad_Total" control={control} rules={{ required: true, min: 1 }} render={({ field }) => (<TextField {...field} fullWidth type="number" label={t('software.seats')} error={!!errors.LIC_Cantidad_Total} required/>)}/>
                <Controller name="LIC_Fecha_Vencimiento" control={control} render={({ field }) => (<TextField {...field} fullWidth type="date" label={t('software.expiry')} InputLabelProps={{ shrink: true }}/>)}/>
              </Box>
            </SectionCard>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onClose()} color="inherit">{t('common.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24}/> : t('common.save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>);
};
