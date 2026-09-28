import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, CircularProgress, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { getApiErrorMessage } from '../../api/errors';
import { softwareService } from './softwareService';
import { Software, SoftwareCreate } from '../../types/software';
import { SectionCard } from '../../components/ui';
interface Props {
    open: boolean;
    onClose: (refresh?: boolean) => void;
    softwareToEdit?: Software;
}
export const SoftwareDialog = ({ open, onClose, softwareToEdit }: Props) => {
    const { t } = useTranslation();
    const { register, handleSubmit, reset } = useForm<SoftwareCreate>();
    const [loading, setLoading] = useState(false);
    const { enqueueSnackbar } = useSnackbar();
    useEffect(() => {
        if (open) {
            if (softwareToEdit) {
                reset({
                    SOF_Nombre: softwareToEdit.SOF_Nombre,
                    SOF_Fabricante: softwareToEdit.SOF_Fabricante,
                    SOF_Version: softwareToEdit.SOF_Version ?? '',
                });
            }
            else {
                reset({ SOF_Nombre: '', SOF_Fabricante: '', SOF_Version: '' });
            }
        }
    }, [open, softwareToEdit, reset]);
    const onSubmit = async (data: SoftwareCreate) => {
        setLoading(true);
        try {
            if (softwareToEdit) {
                await softwareService.updateSoftware(softwareToEdit.SOF_Software, data);
                enqueueSnackbar(t('common.success_update'), { variant: 'success' });
            }
            else {
                await softwareService.createSoftware(data);
                enqueueSnackbar(t('software.created_ok'), { variant: 'success' });
            }
            onClose(true);
        }
        catch (error: unknown) {
            enqueueSnackbar(getApiErrorMessage(error, t('common.error_create')), { variant: 'error' });
        }
        finally {
            setLoading(false);
        }
    };
    return (<Dialog open={open} onClose={() => onClose()} maxWidth="xs" fullWidth>
      <DialogTitle>{softwareToEdit ? t('common.edit') : t('software.register_title')}</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <SectionCard title={t('software.sections.general')}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField fullWidth label={t('common.name')} placeholder="Microsoft 365, Adobe Acrobat..." {...register('SOF_Nombre', { required: true })}/>
                <TextField fullWidth label={t('common.manufacturer')} placeholder="Microsoft, Adobe..." {...register('SOF_Fabricante', { required: true })}/>
                <TextField fullWidth label={`${t('common.version')} (${t('software.optional')})`} {...register('SOF_Version')}/>
              </Box>
            </SectionCard>
          </Box>
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
