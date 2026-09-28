import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, CircularProgress, Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { SectionCard } from '../../../components/ui';
import { useSnackbar } from 'notistack';
import { getApiErrorMessage } from '../../../api/errors';
import { catalogService } from '../catalogService';
import { TipoActivo } from '../../../types/inventory';
import { TipoActivoCreate } from '../../../types/catalogs';
interface Props {
    open: boolean;
    onClose: (refresh?: boolean) => void;
    typeToEdit?: TipoActivo;
}
export const AssetTypeDialog = ({ open, onClose, typeToEdit }: Props) => {
    const { t } = useTranslation();
    const { register, handleSubmit, reset } = useForm<TipoActivoCreate>();
    const [loading, setLoading] = useState(false);
    const { enqueueSnackbar } = useSnackbar();
    useEffect(() => {
        if (open) {
            if (typeToEdit) {
                reset({
                    TAC_Nombre: typeToEdit.TAC_Nombre,
                    TAC_Prefijo: typeToEdit.TAC_Prefijo ?? '',
                });
            }
            else {
                reset();
            }
        }
    }, [open, typeToEdit, reset]);
    const onSubmit = async (data: TipoActivoCreate) => {
        setLoading(true);
        try {
            // Normalizamos el prefijo a mayúsculas para mantener estándar
            const payload: TipoActivoCreate = {
                ...data,
                TAC_Prefijo: data.TAC_Prefijo ? data.TAC_Prefijo.toUpperCase() : undefined,
            };
            if (typeToEdit) {
                await catalogService.updateTipoActivo(typeToEdit.TAC_Tipo_Activo, payload);
                enqueueSnackbar(t('common.success_update'), { variant: 'success' });
            }
            else {
                await catalogService.createTipoActivo(payload);
                enqueueSnackbar(t('catalogs.types.success_create'), { variant: 'success' });
            }
            onClose(true);
        }
        catch (error: unknown) {
            console.error(error);
            enqueueSnackbar(getApiErrorMessage(error, t('common.error_create')), { variant: 'error' });
        }
        finally {
            setLoading(false);
        }
    };
    return (<Dialog open={open} onClose={() => onClose()} maxWidth="xs" fullWidth>
      <DialogTitle>{typeToEdit ? t('common.edit') : t('catalogs.types.new_title')}</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <SectionCard title={t('catalogs.sections.general')}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField autoFocus fullWidth label={t('catalogs.types.field_name')} // "Nombre del Tipo (ej: Laptop)"
     {...register('TAC_Nombre', { required: true, minLength: 2 })}/>

            <Box>
              <TextField fullWidth label={t('catalogs.types.field_prefix')} // "Prefijo (ej: LPT)"
     inputProps={{ style: { textTransform: 'uppercase' }, maxLength: 5 }} placeholder="AAA" {...register('TAC_Prefijo', { required: true, minLength: 2, maxLength: 5 })}/>
              <Typography variant="caption" color="text.secondary">
                {t('catalogs.types.prefix_help')} {/* "Usado para generar códigos automáticos" */}
              </Typography>
            </Box>
          </Box>
          </SectionCard>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onClose()} color="inherit">
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24}/> : t('common.save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>);
};
