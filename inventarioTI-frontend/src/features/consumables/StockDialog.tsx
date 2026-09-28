import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogTitle, DialogContent, DialogActions, Autocomplete, Box, Button, TextField, CircularProgress, Typography, Stack, } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { SectionCard } from '../../components/ui';
import { useSnackbar } from 'notistack';
import { getApiErrorDetail } from '../../api/errors';
import { consumableService } from './consumableService';
import { Consumible, StockMovimientoCreate } from '../../types/consumables';
import { personService } from '../persons/personService';
import { PersonaResumen } from '../../types/users';
import { createSearchFilter } from '../../utils/autocomplete';
interface Props {
    open: boolean;
    modo: 'entrada' | 'salida';
    consumible: Consumible | null;
    onClose: (refresh?: boolean) => void;
}
interface StockFormValues {
    MOC_Cantidad: string | number;
    MOC_Motivo: string;
}
const personFilter = createSearchFilter<PersonaResumen>((person) => [
    person.PER_Primer_Nombre,
    person.PER_Segundo_Nombre ?? '',
    person.PER_Primer_Apellido,
    person.PER_Segundo_Apellido ?? '',
    person.PER_Email_Corporativo,
].join(' '));
const personLabel = (person: PersonaResumen) => [
    person.PER_Primer_Nombre,
    person.PER_Segundo_Nombre,
    person.PER_Primer_Apellido,
    person.PER_Segundo_Apellido,
].filter(Boolean).join(' ');
export const StockDialog = ({ open, modo, consumible, onClose }: Props) => {
    const { t } = useTranslation();
    const { enqueueSnackbar } = useSnackbar();
    const { register, handleSubmit, reset, formState: { errors } } = useForm<StockFormValues>();
    const [loading, setLoading] = useState(false);
    const [personas, setPersonas] = useState<PersonaResumen[]>([]);
    const [persona, setPersona] = useState('');
    useEffect(() => {
        if (!open)
            return;
        reset({ MOC_Cantidad: 1, MOC_Motivo: '' });
        setPersona('');
        if (modo === 'salida') {
            personService.list().then(setPersonas).catch(() => setPersonas([]));
        }
    }, [open, reset, modo]);
    const onSubmit = async (data: StockFormValues) => {
        if (!consumible)
            return;
        setLoading(true);
        try {
            const payload: StockMovimientoCreate = {
                MOC_Cantidad: Number(data.MOC_Cantidad),
                MOC_Motivo: data.MOC_Motivo || undefined,
            };
            if (modo === 'salida' && persona)
                payload.PER_Persona = persona;
            if (modo === 'entrada')
                await consumableService.entrada(consumible.CON_Consumible, payload);
            else
                await consumableService.salida(consumible.CON_Consumible, payload);
            enqueueSnackbar(t('consumables.stock_updated'), { variant: 'success' });
            onClose(true);
        }
        catch (err: unknown) {
            const code = getApiErrorDetail(err);
            const msg = code === 'INSUFFICIENT_STOCK'
                ? t('consumables.error_insufficient')
                : t('common.error_generic');
            enqueueSnackbar(msg, { variant: 'error' });
        }
        finally {
            setLoading(false);
        }
    };
    const title = modo === 'entrada'
        ? t('consumables.entry_title')
        : t('consumables.exit_title');
    return (<Dialog open={open} onClose={() => onClose()} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <SectionCard title={t('consumables.sections.movement')} subtitle={consumible ? `${consumible.CON_Nombre} — ${t('consumables.current_stock')}: ${consumible.CON_Stock_Actual} ${consumible.CON_Unidad}` : undefined}>
          <TextField autoFocus fullWidth margin="dense" type="number" label={t('consumables.quantity')} {...register('MOC_Cantidad', { required: true, min: 1 })} error={!!errors.MOC_Cantidad}/>
          {modo === 'salida' && (<Autocomplete fullWidth options={personas} value={personas.find((person) => person.PER_Persona === persona) ?? null} onChange={(_, person) => setPersona(person?.PER_Persona ?? '')} getOptionLabel={personLabel} filterOptions={personFilter} autoHighlight openOnFocus={false} isOptionEqualToValue={(option, selected) => option.PER_Persona === selected.PER_Persona} noOptionsText={t('common.type_to_search')} renderOption={(props, person) => (<Box component="li" {...props} key={person.PER_Persona}>
                  <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {personLabel(person)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                      {person.PER_Email_Corporativo}
                    </Typography>
                  </Stack>
                </Box>)} renderInput={(params) => (<TextField {...params} margin="dense" label={t('consumables.recipient')}/>)}/>)}
          <TextField fullWidth margin="dense" label={t('consumables.reason')} {...register('MOC_Motivo')}/>
          </SectionCard>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onClose()} color="inherit">{t('common.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={loading} color={modo === 'salida' ? 'warning' : 'primary'}>
            {loading ? <CircularProgress size={24}/> : t('common.save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>);
};
