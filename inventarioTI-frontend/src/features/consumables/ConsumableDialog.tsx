import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, CircularProgress, Stack, } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { SectionCard, SedeField, SuggestionHint } from '../../components/ui';
import { useSedes } from '../../hooks/useSedes';
import { useSuggestion } from '../../hooks/useSuggestion';
import { useSnackbar } from 'notistack';
import { getApiErrorDetail, getApiErrorMessage } from '../../api/errors';
import { consumableService } from './consumableService';
import { Consumible, ConsumibleCreate } from '../../types/consumables';
interface Props {
    open: boolean;
    onClose: (refresh?: boolean) => void;
    toEdit?: Consumible | null;
}
interface ConsumibleFormValues {
    CON_Nombre: string;
    CON_Descripcion: string;
    CON_Categoria: string;
    CON_Unidad: string;
    CON_Stock_Minimo: string | number;
    CON_Stock_Actual?: string | number;
}
export const ConsumableDialog = ({ open, onClose, toEdit }: Props) => {
    const { t } = useTranslation();
    const { enqueueSnackbar } = useSnackbar();
    const isEdit = !!toEdit;
    const { register, handleSubmit, reset, formState: { errors } } = useForm<ConsumibleFormValues>();
    const [loading, setLoading] = useState(false);
    // Bodega (sede) donde se almacena; con una sola sede se prellena.
    const [sede, setSede] = useState<number | ''>('');
    const { sedes, loading: loadingSedes, unica } = useSedes(open);
    const sedeHint = useSuggestion<number | ''>({
        current: sede,
        empty: '',
        enabled: open && !isEdit,
        apply: setSede,
        suggestion: loadingSedes ? undefined : unica
            ? { value: unica.SED_Sede, label: unica.SED_Nombre, reason: t('scope.reasons.only_sede') }
            : null,
    });
    useEffect(() => {
        if (!open)
            return;
        setSede(toEdit?.SED_Sede ?? '');
        if (toEdit) {
            reset({
                CON_Nombre: toEdit.CON_Nombre,
                CON_Descripcion: toEdit.CON_Descripcion ?? '',
                CON_Categoria: toEdit.CON_Categoria ?? '',
                CON_Unidad: toEdit.CON_Unidad,
                CON_Stock_Minimo: toEdit.CON_Stock_Minimo,
            });
        }
        else {
            reset({ CON_Nombre: '', CON_Descripcion: '', CON_Categoria: '', CON_Unidad: 'unidad', CON_Stock_Minimo: 0, CON_Stock_Actual: 0 });
        }
    }, [open, toEdit, reset]);
    const onSubmit = async (data: ConsumibleFormValues) => {
        setLoading(true);
        try {
            if (sede === '' && !isEdit) {
                enqueueSnackbar(t('scope.sede_required'), { variant: 'warning' });
                return;
            }
            const payload: ConsumibleCreate = {
                ...data,
                CON_Stock_Minimo: Number(data.CON_Stock_Minimo),
                CON_Stock_Actual: Number(data.CON_Stock_Actual ?? 0),
                SED_Sede: sede === '' ? null : Number(sede),
            };
            if (isEdit && toEdit) {
                const updatePayload: Partial<ConsumibleCreate> = { ...payload };
                delete updatePayload.CON_Stock_Actual;
                await consumableService.update(toEdit.CON_Consumible, updatePayload);
                enqueueSnackbar(t('common.success_update'), { variant: 'success' });
            }
            else {
                await consumableService.create(payload);
                enqueueSnackbar(t('consumables.created'), { variant: 'success' });
            }
            onClose(true);
        }
        catch (err: unknown) {
            const code = getApiErrorDetail(err);
            const msg = code === 'CONSUMABLE_ALREADY_EXISTS'
                ? t('consumables.error_exists')
                : getApiErrorMessage(err, t('common.error_generic'));
            enqueueSnackbar(msg, { variant: 'error' });
        }
        finally {
            setLoading(false);
        }
    };
    return (<Dialog open={open} onClose={() => onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? t('common.edit') : t('consumables.new_title')}</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Stack spacing={2}>
          <SectionCard title={t('consumables.sections.general')}>
          <TextField autoFocus fullWidth margin="dense" label={t('consumables.field_name')} {...register('CON_Nombre', { required: true, minLength: 2 })} error={!!errors.CON_Nombre} helperText={errors.CON_Nombre ? t('common.required') : ''}/>
          <TextField fullWidth margin="dense" label={t('consumables.field_description')} {...register('CON_Descripcion')}/>
          <Stack direction="row" spacing={2}>
            <TextField fullWidth margin="dense" label={t('consumables.field_category')} {...register('CON_Categoria')}/>
            <TextField fullWidth margin="dense" label={t('consumables.field_unit')} {...register('CON_Unidad', { required: true })}/>
          </Stack>
          <SedeField margin="dense" required={!isEdit} value={sede} onChange={setSede} sedes={sedes} loading={loadingSedes} label={t('scope.warehouse_sede')} helperText={sedeHint ? undefined : t('scope.consumable_sede_help')}/>
          <SuggestionHint hint={sedeHint}/>
          </SectionCard>
          <SectionCard title={t('consumables.sections.stock')}>
          <Stack direction="row" spacing={2}>
            <TextField fullWidth margin="dense" type="number" label={t('consumables.field_min')} {...register('CON_Stock_Minimo', { required: true, min: 0 })}/>
            {!isEdit && (<TextField fullWidth margin="dense" type="number" label={t('consumables.field_initial')} {...register('CON_Stock_Actual', { required: true, min: 0 })}/>)}
          </Stack>
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
