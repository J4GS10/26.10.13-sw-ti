import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Box, Typography, TableCell, TableRow, Chip, IconButton, CircularProgress, Button, Tooltip, Select, MenuItem, FormControl, InputLabel, Checkbox,
} from '@mui/material';
import { PageHeader, StatusChip, DataTableShell } from '../../components/ui';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import { useTranslation } from 'react-i18next';
import { stateLabel, stateVariant } from '../../utils/catalogLabels';
import { useSnackbar } from 'notistack';
import { getApiErrorMessage } from '../../api/errors';
import { downloadCsv } from '../../api/downloadCsv';
import { AssetDialog } from './AssetDialog';
import { BajaDialog } from './BajaDialog';
import { AssetDetailDialog } from './AssetDetailDialog';
import { assetService } from './assetService';
import { catalogService } from '../catalogs/catalogService';
import { Activo, EstadoOperativo, Marca, Modelo, TipoActivo } from '../../types/inventory';
import { ExportMenuButton } from '../../components/ExportMenuButton';
import { usePermissions } from '../../hooks/usePermissions';
import { SearchInput } from '../../components/SearchInput';
import { normalizeLanguage } from '../../types/language';
import { CollapsibleToolbar } from '../../components/CollapsibleToolbar';

export const AssetsPage = () => {
    const { t, i18n } = useTranslation();
    const { canOperate, canAdminInventory, canExport } = usePermissions();
    const { enqueueSnackbar } = useSnackbar();

    // ── Catálogos (para dropdowns) ──────────────────────────────────────────
    const [marcas, setMarcas] = useState<Marca[]>([]);
    const [modelos, setModelos] = useState<Modelo[]>([]);
    const [tipos, setTipos] = useState<TipoActivo[]>([]);
    const [estados, setEstados] = useState<EstadoOperativo[]>([]);

    // ── Datos de la página actual (server-side) ─────────────────────────────
    const [activos, setActivos] = useState<Activo[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    // ── Filtros ─────────────────────────────────────────────────────────────
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [estadoFilter, setEstadoFilter] = useState<number | 'all'>('all');
    const [tipoFilter, setTipoFilter] = useState<number | 'all'>('all');

    // ── Paginación ──────────────────────────────────────────────────────────
    const [page, setPage] = useState(0);               // MUI: 0-indexed
    const [rowsPerPage, setRowsPerPage] = useState(25);

    // ── Selección para etiquetas ────────────────────────────────────────────
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const [downloadingLabels, setDownloadingLabels] = useState(false);

    // ── Diálogos ────────────────────────────────────────────────────────────
    const [editOpen, setEditOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [selected, setSelected] = useState<Activo | null>(null);


    // ── Debounce de búsqueda (400ms) ────────────────────────────────────────
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(0);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // ── Sincronizar idioma de exportación ───────────────────────────────────

    // ── Cargar catálogos (una sola vez al montar) ───────────────────────────
    const loadCatalogs = useCallback(async () => {
        try {
            const [marcasData, tiposData, estadosData, modelosFlat] = await Promise.all([
                assetService.getMarcas().catch((e) => { console.error('getMarcas', e); return [] as Marca[]; }),
                assetService.getTipos().catch((e) => { console.error('getTipos', e); return [] as TipoActivo[]; }),
                assetService.getEstados().catch((e) => { console.error('getEstados', e); return [] as EstadoOperativo[]; }),
                catalogService.getModelosFlat().catch((e) => { console.error('getModelosFlat', e); return [] as Modelo[]; }),
            ]);
            setMarcas(marcasData);
            setTipos(tiposData);
            setEstados(estadosData);
            setModelos(modelosFlat);
        } catch (err) {
            console.error('loadCatalogs error', err);
        }
    }, []);

    useEffect(() => { loadCatalogs(); }, [loadCatalogs]);

    // ── Cargar página de activos (server-side) ──────────────────────────────
    const loadActivos = useCallback(async () => {
        setLoading(true);
        try {
            const result = await assetService.searchActivos({
                q: debouncedSearch.trim() || undefined,
                tipo_activo_id: tipoFilter !== 'all' ? (tipoFilter as number) : undefined,
                estado_operativo_id: estadoFilter !== 'all' ? (estadoFilter as number) : undefined,
                page: page + 1,          // MUI 0-indexed → server 1-indexed
                per_page: rowsPerPage,
            });
            setActivos(result.items);
            setTotal(result.total);
        } catch (err) {
            console.error('loadActivos error', err);
            enqueueSnackbar(t('common.error_loading'), { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, tipoFilter, estadoFilter, page, rowsPerPage, enqueueSnackbar, t]);

    useEffect(() => { loadActivos(); }, [loadActivos]);

    // ── Limpiar selección si cambia la página/filtros ───────────────────────
    useEffect(() => {
        setSelectedAssetIds((prev) => {
            if (prev.size === 0) return prev;
            const existingIds = new Set(activos.map((a) => a.ACT_Activo));
            const next = new Set([...prev].filter((id) => existingIds.has(id)));
            return next.size === prev.size ? prev : next;
        });
    }, [activos]);

    // ── Métricas de filtros activos ─────────────────────────────────────────
    const activeFilters = [
        searchTerm.trim(),
        estadoFilter !== 'all',
        tipoFilter !== 'all',
    ].filter(Boolean).length;

    // ── IDs de la página actual (para checkbox header) ──────────────────────
    const pagedAssetIds = useMemo(() => activos.map((a) => a.ACT_Activo), [activos]);
    const selectedCount = selectedAssetIds.size;
    const selectedVisibleCount = pagedAssetIds.filter((id) => selectedAssetIds.has(id)).length;
    const allVisibleSelected = pagedAssetIds.length > 0 && selectedVisibleCount === pagedAssetIds.length;
    const someVisibleSelected = selectedVisibleCount > 0 && selectedVisibleCount < pagedAssetIds.length;

    // ── Resolución de nombres desde catálogos ───────────────────────────────
    const getTipoName = (id: number) => tipos.find((t) => t.TAC_Tipo_Activo === id)?.TAC_Nombre ?? '—';
    const getEstadoInfo = (id: number) => estados.find((e) => e.EOP_Estado_Operativo === id);
    const getModelo = (id: number) => modelos.find((m) => m.MOD_Modelo === id);
    const getMarcaName = (modeloId: number) => {
        const mod = getModelo(modeloId);
        if (!mod) return '—';
        return marcas.find((m) => m.MAR_Marca === mod.MAR_Marca)?.MAR_Nombre ?? '—';
    };
    const getModeloName = (id: number) => getModelo(id)?.MOD_Nombre ?? '—';

    // ── Handlers ────────────────────────────────────────────────────────────
    const handleEdit = (asset: Activo) => { setSelected(asset); setEditOpen(true); };
    const handleView = (asset: Activo) => { setSelected(asset); setDetailOpen(true); };
    const handleNew = () => { setSelected(null); setEditOpen(true); };

    const handleToggleVisibleSelection = () => {
        setSelectedAssetIds((prev) => {
            const next = new Set(prev);
            if (allVisibleSelected) {
                pagedAssetIds.forEach((id) => next.delete(id));
            } else {
                pagedAssetIds.forEach((id) => next.add(id));
            }
            return next;
        });
    };

    const handleToggleAssetSelection = (assetId: string) => {
        setSelectedAssetIds((prev) => {
            const next = new Set(prev);
            if (next.has(assetId)) next.delete(assetId); else next.add(assetId);
            return next;
        });
    };


    const handleClearSelection = () => setSelectedAssetIds(new Set());

    const handleDownloadLabels = async () => {
        const activosIds = [...selectedAssetIds];
        if (activosIds.length === 0) {
            enqueueSnackbar(t('assets.labels.select_required'), { variant: 'info' });
            return;
        }
        if (activosIds.length > 200) {
            enqueueSnackbar(t('assets.labels.too_many_selected'), { variant: 'warning' });
            return;
        }
        setDownloadingLabels(true);
        try {
            const blob = await assetService.downloadLabels({ activos_ids: activosIds }, normalizeLanguage(i18n.resolvedLanguage));
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `etiquetas-activos-${activosIds.length}.pdf`;
            anchor.click();
            window.URL.revokeObjectURL(url);
            enqueueSnackbar(t('assets.labels.downloaded'), { variant: 'success' });
        } catch (error: unknown) {
            enqueueSnackbar(getApiErrorMessage(error, t('common.error_generic')), { variant: 'error' });
        } finally {
            setDownloadingLabels(false);
        }
    };

    // Baja: siempre como solicitud formal (motivo, destino) que aprueba el Jefe de TI.
    const [bajaTarget, setBajaTarget] = useState<Activo | null>(null);

    return (
        <Box>
            <PageHeader
                title={t('assets.title')}
                badge={total}
                actions={(
                    <>
                        {canExport && <ExportMenuButton onExport={(lang) => downloadCsv('/export/activos.csv', 'activos.csv', lang)} />}
                        {canOperate && (
                            <Button variant="contained" startIcon={<AddIcon />} onClick={handleNew}>
                                {t('assets.new_btn')}
                            </Button>
                        )}
                    </>
                )}
            />

            <CollapsibleToolbar
                storageKey="assets-toolbar"
                summary={activeFilters ? <Chip size="small" color="primary" variant="outlined" label={t('common.active_filters_count', { count: activeFilters })} /> : undefined}
                search={<SearchInput value={searchTerm} onChange={setSearchTerm} placeholder={t('assets.search_placeholder')} />}
            >
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                    <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 200 } }}>
                        <InputLabel>{t('assets.filter_type')}</InputLabel>
                        <Select
                            label={t('assets.filter_type')}
                            value={tipoFilter}
                            onChange={(e) => { setTipoFilter(e.target.value as number | 'all'); setPage(0); }}
                        >
                            <MenuItem value="all">{t('assets.all_types')}</MenuItem>
                            {tipos.map((tp) => (
                                <MenuItem key={tp.TAC_Tipo_Activo} value={tp.TAC_Tipo_Activo}>
                                    {tp.TAC_Nombre}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 200 } }}>
                        <InputLabel>{t('assets.filter_state')}</InputLabel>
                        <Select
                            label={t('assets.filter_state')}
                            value={estadoFilter}
                            onChange={(e) => { setEstadoFilter(e.target.value as number | 'all'); setPage(0); }}
                        >
                            <MenuItem value="all">{t('assets.all_states')}</MenuItem>
                            {estados.map((e) => (
                                <MenuItem key={e.EOP_Estado_Operativo} value={e.EOP_Estado_Operativo}>
                                    {stateLabel(t, e.EOP_Nombre)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>
            </CollapsibleToolbar>

            <AssetDialog
                open={editOpen}
                assetToEdit={selected}
                onClose={(refresh) => { setEditOpen(false); setSelected(null); if (refresh) loadActivos(); }}
            />
            <AssetDetailDialog
                open={detailOpen}
                asset={selected}
                marcas={marcas}
                modelos={modelos}
                tipos={tipos}
                estados={estados}
                onClose={() => { setDetailOpen(false); setSelected(null); }}
                onChanged={loadActivos}
            />

            <DataTableShell
                columns={[
                    {
                        key: 'select',
                        padding: 'checkbox',
                        label: (
                            <Checkbox
                                color="primary"
                                indeterminate={someVisibleSelected}
                                checked={allVisibleSelected}
                                onChange={handleToggleVisibleSelection}
                                inputProps={{ 'aria-label': t('assets.labels.select_visible') }}
                            />
                        ),
                    },
                    { key: 'code', label: t('assets.table.code') },
                    { key: 'type', label: t('assets.table.type') },
                    { key: 'brand', label: t('assets.dialog.brand') },
                    { key: 'model', label: t('assets.dialog.model') },
                    { key: 'serial', label: t('assets.table.serial') },
                    { key: 'host', label: t('assets.table.host') },
                    { key: 'status', label: t('assets.table.status') },
                    { key: 'actions', label: t('assets.table.actions'), align: 'right' },
                ]}
                rows={activos}
                loading={loading}
                total={total}
                page={page}
                rowsPerPage={rowsPerPage}
                onPageChange={setPage}
                onRowsPerPageChange={(n) => { setRowsPerPage(n); setPage(0); }}
                emptyTitle={t('assets.table.empty')}
                toolbar={selectedCount > 0 ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, mr: 'auto' }}>
                            {t('assets.labels.selected_count', { count: selectedCount })}
                        </Typography>
                        <Button size="small" onClick={handleClearSelection}>
                            {t('assets.labels.clear_selection')}
                        </Button>
                        {canOperate && (
                            <Button
                                size="small"
                                variant="contained"
                                startIcon={downloadingLabels ? <CircularProgress size={16} color="inherit" /> : <QrCodeScannerIcon />}
                                onClick={handleDownloadLabels}
                                disabled={downloadingLabels}
                            >
                                {t('assets.labels.download_selected', { count: selectedCount })}
                            </Button>
                        )}
                    </Box>
                ) : undefined}
                renderRow={(row) => {
                    const isSelected = selectedAssetIds.has(row.ACT_Activo);
                    return (
                        <TableRow key={row.ACT_Activo} hover selected={isSelected}>
                            <TableCell padding="checkbox">
                                <Checkbox
                                    color="primary"
                                    checked={isSelected}
                                    onChange={() => handleToggleAssetSelection(row.ACT_Activo)}
                                    inputProps={{ 'aria-label': t('assets.labels.select_asset', { code: row.ACT_Codigo_Interno }) }}
                                />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>{row.ACT_Codigo_Interno}</TableCell>
                            <TableCell>{getTipoName(row.TAC_Tipo_Activo)}</TableCell>
                            <TableCell>{getMarcaName(row.MOD_Modelo)}</TableCell>
                            <TableCell>{getModeloName(row.MOD_Modelo)}</TableCell>
                            <TableCell>{row.ACT_Serie_Fabricante}</TableCell>
                            <TableCell>{row.ACT_Hostname || '—'}</TableCell>
                            <TableCell>
                                <StatusChip label={stateLabel(t, getEstadoInfo(row.EOP_Estado_Operativo)?.EOP_Nombre)} variant={stateVariant(getEstadoInfo(row.EOP_Estado_Operativo)?.EOP_Nombre)} />
                            </TableCell>
                            <TableCell align="right">
                                <Tooltip title={t('common.view') as string}>
                                    <IconButton size="small" onClick={() => handleView(row)}>
                                        <VisibilityIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                {canOperate && (
                                    <Tooltip title={t('common.edit') as string}>
                                        <IconButton size="small" color="primary" onClick={() => handleEdit(row)}>
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                )}
                                {canAdminInventory && (
                                    <Tooltip title={t('assets.actions.decommission') as string}>
                                        <IconButton size="small" color="error" onClick={() => setBajaTarget(row)} aria-label={t('assets.actions.decommission')}>
                                            <DeleteOutlineIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </TableCell>
                        </TableRow>
                    );
                }}
            />
            <BajaDialog open={!!bajaTarget} activo={bajaTarget} onClose={(changed) => { setBajaTarget(null); if (changed) loadActivos(); }} />
        </Box>
    );
};
