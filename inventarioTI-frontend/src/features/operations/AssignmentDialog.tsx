import { useEffect, useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, CircularProgress, Box, Autocomplete, Typography, MenuItem, Stack } from '@mui/material';
import { ContextCaption, SectionCard, SuggestionHint } from '../../components/ui';
import { useTranslation } from 'react-i18next';
import { catalogSlug, movementTypeLabel } from '../../utils/catalogLabels';
import { useEntityContext } from '../../hooks/useEntityContext';
import { useSuggestion } from '../../hooks/useSuggestion';
import { suggestionService } from '../../api/suggestionService';
import { areaReason, personContextLine, shortList } from '../../utils/suggestionReasons';
import { useSnackbar } from 'notistack';
import { getApiErrorMessage } from '../../api/errors';
// --- SERVICIOS ---
// Mantenemos la estructura de producción: movementService es la autoridad
import { movementService } from './movementService';
import { assetService } from '../assets/assetService';
// Agregamos userService si fuera estrictamente necesario para tipos, 
// pero usaremos el endpoint de movementService que ya funcionaba en prod.
// --- TIPOS ---
import { Activo, TipoActivo } from '../../types/inventory';
import { PersonaResumen } from '../../types/users';
import { MovimientoCreate, TipoMovimiento } from '../../types/traceability';
import { Area } from '../../types/geo';
import { createSearchFilter } from '../../utils/autocomplete';
interface Props {
    open: boolean;
    onClose: (refresh?: boolean) => void;
}
interface AssignmentFormData {
    categoria: number | '';
    activo: Activo | null;
    persona: PersonaResumen | null;
    area: Area | null;
    tipo_movimiento: TipoMovimiento | null;
    observacion: string;
    hostname: string;
}
const assetFilter = createSearchFilter<Activo>((asset) => [
    asset.ACT_Codigo_Interno,
    asset.ACT_Serie_Fabricante,
    asset.ACT_Hostname ?? '',
].join(' '));
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
export const AssignmentDialog = ({ open, onClose }: Props) => {
    const { t } = useTranslation();
    // Fusionamos hooks: Production (control) + Implementation (watch/setValue)
    const { control, handleSubmit, reset, watch, setValue } = useForm<AssignmentFormData>();
    const { enqueueSnackbar } = useSnackbar();
    // --- ESTADOS (Catalogos) ---
    const [activos, setActivos] = useState<Activo[]>([]);
    const [personas, setPersonas] = useState<PersonaResumen[]>([]);
    const [tiposMov, setTiposMov] = useState<TipoMovimiento[]>([]);
    const [areas, setAreas] = useState<Area[]>([]);
    const [tiposActivo, setTiposActivo] = useState<TipoActivo[]>([]);
    const [loadingData, setLoadingData] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    // --- NUEVA LÓGICA: Watch para el filtro de categoría ---
    const selectedCategory = watch('categoria');
    // --- SUGERENCIAS RELACIONALES (prellenan sin pisar lo que elija el usuario) ---
    const selectedAsset = watch('activo');
    const selectedPerson = watch('persona');
    const currentArea = watch('area');
    const currentType = watch('tipo_movimiento');
    const currentHostname = watch('hostname') ?? '';
    const personCtx = useEntityContext(selectedPerson?.PER_Persona ?? null, suggestionService.persona);
    const assetCtx = useEntityContext(selectedAsset?.ACT_Activo ?? null, suggestionService.activo);
    const areaHint = useSuggestion<number | null>({
        current: currentArea?.ARE_Area ?? null,
        empty: null,
        apply: (id) => setValue('area', areas.find((a) => a.ARE_Area === id) ?? null, { shouldDirty: true, shouldValidate: id != null }),
        suggestion: personCtx.loading ? undefined : personCtx.data?.area_sugerida ? {
            value: personCtx.data.area_sugerida.ARE_Area,
            label: personCtx.data.area_sugerida.nombre,
            reason: areaReason(t, personCtx.data.area_sugerida.origen, personCtx.data.persona?.nombre),
        } : null,
    });
    const suggestedType = assetCtx.data
        ? tiposMov.find((tm) => catalogSlug(tm.TMO_Nombre) === assetCtx.data?.tipo_movimiento_sugerido) ?? null
        : null;
    const typeHint = useSuggestion<number | null>({
        current: currentType?.TMO_Tipo_Movimiento ?? null,
        empty: null,
        apply: (id) => setValue('tipo_movimiento', tiposMov.find((tm) => tm.TMO_Tipo_Movimiento === id) ?? null, { shouldDirty: true, shouldValidate: id != null }),
        suggestion: assetCtx.loading ? undefined : suggestedType ? {
            value: suggestedType.TMO_Tipo_Movimiento,
            label: movementTypeLabel(t, suggestedType.TMO_Nombre),
            reason: assetCtx.data?.tipo_movimiento_sugerido === 'transferencia'
                ? t('suggestions.reasons.movement_in_custody')
                : t('suggestions.reasons.movement_free'),
        } : null,
    });
    const hostnameHint = useSuggestion<string>({
        current: currentHostname,
        empty: '',
        apply: (value) => setValue('hostname', value, { shouldDirty: true }),
        suggestion: selectedAsset?.ACT_Hostname
            ? { value: selectedAsset.ACT_Hostname, label: selectedAsset.ACT_Hostname, reason: t('suggestions.reasons.hostname_current') }
            : null,
    });
    const custodian = assetCtx.data?.custodio;
    const custodyLine = custodian ? [
        custodian.departamento
            ? t('suggestions.info.custody', { name: custodian.nombre ?? '', department: custodian.departamento })
            : t('suggestions.info.custody_no_dep', { name: custodian.nombre ?? '' }),
        assetCtx.data?.area_actual ? t('suggestions.info.current_area', { area: assetCtx.data.area_actual.nombre }) : null,
    ].filter(Boolean).join(' · ') : '';
    const personLine = personCtx.data ? personContextLine(t, personCtx.data) : '';
    const personAssets = personCtx.data?.activos_vigentes ?? [];
    // --- CARGA DE DATOS (Conservamos la robustez de Producción) ---
    useEffect(() => {
        if (open) {
            setLoadingData(true);
            Promise.all([
                // Usamos los métodos Lookup de movementService de producción (son los fiables)
                movementService.getActivosLookup(),
                movementService.getPersonasLookup(),
                movementService.getTiposMovimiento(),
                movementService.getAreas(),
                assetService.getTipos() // Necesario para el filtro y labels
            ]).then(([a, p, tm, ar, ta]) => {
                setActivos(a);
                setPersonas(p);
                setTiposMov(tm);
                setAreas(ar);
                setTiposActivo(ta);
            }).catch(err => {
                console.error(err);
                enqueueSnackbar(t('common.error_loading'), { variant: 'error' });
            }).finally(() => {
                setLoadingData(false);
            });
            // Reset completo incluyendo el nuevo campo categoria
            reset({
                categoria: '',
                activo: null,
                persona: null,
                area: null,
                tipo_movimiento: null,
                observacion: '',
                hostname: ''
            });
        }
    }, [open, reset, t, enqueueSnackbar]);
    // --- LÓGICA DE FILTRADO (Nueva Funcionalidad) ---
    // Filtramos la lista maestra 'activos' basada en la categoría seleccionada
    const activosFiltrados = useMemo(() => {
        if (!selectedCategory)
            return []; // O return activos; si quieres mostrar todos al inicio
        return activos.filter(a => a.TAC_Tipo_Activo === selectedCategory);
    }, [activos, selectedCategory]);
    // --- LÓGICA VISUAL (Producción - Más rica) ---
    const getActivoLabel = (activo: Activo) => {
        // Usamos la lógica de producción que busca el nombre del tipo para mostrarlo bonito
        const tipo = tiposActivo.find(t => t.TAC_Tipo_Activo === activo.TAC_Tipo_Activo)?.TAC_Nombre || t('operations.table.asset');
        return `${activo.ACT_Codigo_Interno} | ${tipo} | ${activo.ACT_Hostname || t('assets.table.no_host')}`;
    };
    // --- SUBMIT (Producción) ---
    const onSubmit = async (data: AssignmentFormData) => {
        if (!data.activo || !data.persona || !data.area || !data.tipo_movimiento) {
            enqueueSnackbar(t('common.required'), { variant: 'warning' });
            return;
        }
        setSubmitting(true);
        try {
            const payload: MovimientoCreate = {
                ACT_Activo: data.activo.ACT_Activo,
                PER_Persona: data.persona.PER_Persona,
                ARE_Area: data.area.ARE_Area,
                TMO_Tipo_Movimiento: data.tipo_movimiento.TMO_Tipo_Movimiento,
                MOV_Observacion: data.observacion,
                ACT_Hostname: data.hostname ?? '',
            };
            await movementService.createMovement(payload);
            enqueueSnackbar(t('operations.messages.success_assign'), { variant: 'success' });
            onClose(true);
        }
        catch (error: unknown) {
            enqueueSnackbar(getApiErrorMessage(error, t('common.error_create')), { variant: 'error' });
        }
        finally {
            setSubmitting(false);
        }
    };
    return (<Dialog open={open} onClose={() => onClose()} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 'bold' }}>
        {t('operations.dialog.title')}
      </DialogTitle>
      
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          {loadingData ? (<Box display="flex" justifyContent="center" p={3}><CircularProgress /></Box>) : (<Stack spacing={2}>
              <SectionCard title={t('operations.sections.asset')}>
              <Box display="flex" flexDirection="column" gap={3}>
              {/* 1. (NUEVO) FILTRO DE CATEGORÍA */}
              <Controller name="categoria" control={control} defaultValue="" render={({ field }) => (<TextField {...field} select label={t('operations.dialog.filter_category')} fullWidth helperText={t('operations.dialog.filter_category_help')} onChange={(e) => {
                    field.onChange(e);
                    // Limpiamos el activo seleccionado si cambia la categoría (UX)
                    setValue('activo', null);
                }}>
                    {tiposActivo.map((tipo) => (<MenuItem key={tipo.TAC_Tipo_Activo} value={tipo.TAC_Tipo_Activo}>
                            {tipo.TAC_Nombre}
                        </MenuItem>))}
                  </TextField>)}/>

              {/* 2. SELECCIÓN DE ACTIVO (Modificado con Filtro) */}
              <Controller name="activo" control={control} rules={{ required: t('common.required') }} render={({ field: { onChange, value }, fieldState: { error } }) => (<Autocomplete options={activosFiltrados} getOptionLabel={getActivoLabel} filterOptions={assetFilter} autoHighlight openOnFocus={false} value={value || null} disabled={!selectedCategory} isOptionEqualToValue={(option, selected) => option.ACT_Activo === selected.ACT_Activo} noOptionsText={!selectedCategory
                    ? t('operations.dialog.select_category_first')
                    : t('common.type_to_search')} onChange={(_, data) => onChange(data)} renderOption={(props, option) => (<Box component="li" {...props} key={option.ACT_Activo}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {option.ACT_Codigo_Interno}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                            {option.ACT_Hostname || t('assets.table.no_host')} / {option.ACT_Serie_Fabricante}
                          </Typography>
                        </Box>
                      </Box>)} renderInput={(params) => (<TextField {...params} label={t('operations.dialog.select_asset')} placeholder={selectedCategory
                        ? t('operations.dialog.asset_search_placeholder')
                        : t('operations.dialog.waiting_filter')} error={!!error} helperText={error?.message}/>)}/>)}/>
              {custodyLine && (<Box sx={{ mt: -2.5 }}>
                  <ContextCaption>{custodyLine}</ContextCaption>
                </Box>)}

              {/* HOSTNAME del equipo (al asignar a un nuevo usuario) */}
              <Controller name="hostname" control={control} render={({ field }) => (<TextField {...field} fullWidth label={t('operations.dialog.hostname')} placeholder={t('operations.dialog.hostname_placeholder')} helperText={t('operations.dialog.hostname_help')} inputProps={{ maxLength: 100 }}/>)}/>
              {hostnameHint && (<Box sx={{ mt: -2.5 }}>
                  <SuggestionHint hint={hostnameHint}/>
                </Box>)}
              </Box>
              </SectionCard>

              <SectionCard title={t('operations.sections.assignment')}>
              <Box display="flex" flexDirection="column" gap={3}>
              {/* 3. SELECCIÓN DE PERSONA (Producción) */}
              <Controller name="persona" control={control} rules={{ required: t('common.required') }} render={({ field: { onChange, value }, fieldState: { error } }) => (<Autocomplete options={personas} getOptionLabel={(option) => `${personLabel(option)} (${option.PER_Email_Corporativo || t('users.dialog.no_email')})`} filterOptions={personFilter} autoHighlight openOnFocus={false} isOptionEqualToValue={(option, selected) => option.PER_Persona === selected.PER_Persona} noOptionsText={t('common.type_to_search')} value={value || null} onChange={(_, data) => onChange(data)} renderOption={(props, option) => (<Box component="li" {...props} key={option.PER_Persona}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {personLabel(option)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                            {option.PER_Email_Corporativo}
                          </Typography>
                        </Box>
                      </Box>)} renderInput={(params) => (<TextField {...params} label={t('operations.dialog.select_person')} error={!!error} helperText={error?.message}/>)}/>)}/>
              {(personLine || personAssets.length > 0) && (<Box sx={{ mt: -2.5 }}>
                  {personLine && <ContextCaption>{personLine}</ContextCaption>}
                  {personAssets.length > 0 && (<ContextCaption>{t('suggestions.info.has_assets', { list: shortList(personAssets) })}</ContextCaption>)}
                </Box>)}

              {/* 4. UBICACIÓN Y TIPO (En fila - Producción) */}
              <Box display="flex" gap={2} alignItems="flex-start">
                <Box sx={{ flex: 1, minWidth: 0 }}>
                <Controller name="area" control={control} rules={{ required: true }} render={({ field: { onChange, value }, fieldState: { error } }) => (<Autocomplete options={areas} getOptionLabel={(option) => option.ARE_Nombre} value={value || null} onChange={(_, data) => onChange(data)} renderInput={(params) => (<TextField {...params} label={t('operations.dialog.select_area')} error={!!error}/>)}/>)}/>
                <SuggestionHint hint={areaHint}/>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>

                <Controller name="tipo_movimiento" control={control} rules={{ required: true }} render={({ field: { onChange, value }, fieldState: { error } }) => (<Autocomplete options={tiposMov} getOptionLabel={(option) => movementTypeLabel(t, option.TMO_Nombre)} value={value || null} onChange={(_, data) => onChange(data)} renderInput={(params) => (<TextField {...params} label={t('operations.dialog.select_type')} error={!!error}/>)}/>)}/>
                <SuggestionHint hint={typeHint}/>
                </Box>
              </Box>
              </Box>
              </SectionCard>

              <SectionCard title={t('operations.sections.notes')}>
              <Box display="flex" flexDirection="column" gap={2}>
              {/* 5. OBSERVACIONES (Producción - Controller seguro) */}
              <Controller name="observacion" control={control} defaultValue="" render={({ field }) => (<TextField {...field} label={t('operations.dialog.notes')} multiline rows={3} fullWidth/>)}/>

              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                {t('operations.dialog.auto_close_note')}
              </Typography>
              </Box>
              </SectionCard>
            </Stack>)}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => onClose()} color="inherit">
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="contained" disabled={submitting || loadingData}>
            {submitting ? <CircularProgress size={24}/> : t('common.save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>);
};
