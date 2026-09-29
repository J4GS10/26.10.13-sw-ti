import { Fragment, useCallback, useEffect, useState } from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, IconButton, Collapse, Chip, CircularProgress, Alert, Stack, Tooltip, } from '@mui/material';
import { PageHeader, DataTableShell, StatusChip } from '../../components/ui';
import { alpha } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import AddCardIcon from '@mui/icons-material/AddCard';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import CategoryIcon from '@mui/icons-material/Category';
import HistoryIcon from '@mui/icons-material/History';
import { LicenseHistoryDialog } from './LicenseHistoryDialog';
import { ExportMenuButton } from '../../components/ExportMenuButton';
import { downloadCsv } from '../../api/downloadCsv';
import { formatMoney } from '../../utils/currency';
import { useTranslation } from 'react-i18next';
import { getApiErrorMessage } from '../../api/errors';
import { softwareService } from './softwareService';
import type { Software, Licencia, LicenciaClave } from '../../types/software';
import { SoftwareDialog } from './SoftwareDialog';
import { LicenseDialog } from './LicenseDialog';
import { LicenseTypesDialog } from './LicenseTypesDialog';
import { useSnackbar } from 'notistack';
import { SearchInput } from '../../components/SearchInput';
import { CollapsibleToolbar } from '../../components/CollapsibleToolbar';
import { useConfirm } from '../../components/confirm-context';
import { usePermissions } from '../../hooks/usePermissions';
const maskLicenseKey = (value?: string | null) => {
    if (!value)
        return '';
    if (value.length <= 8)
        return '*'.repeat(value.length);
    return `${value.slice(0, 4)}-${'*'.repeat(Math.min(12, Math.max(4, value.length - 8)))}-${value.slice(-4)}`;
};
const keyStatusColor = (status: LicenciaClave['LCL_Estado']) => {
    if (status === 'ASIGNADA')
        return 'warning';
    if (status === 'RETIRADA')
        return 'default';
    return 'success';
};
const formatDate = (value?: string | null) => {
    if (!value)
        return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};
const licensesPanelSx: SxProps<Theme> = (theme) => ({
    my: 2,
    ml: { xs: 0, md: 6 },
    p: { xs: 1.5, md: 2 },
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: 2,
    bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'light' ? 0.96 : 0.86),
});
const keyPanelSx: SxProps<Theme> = (theme) => ({
    mx: { xs: 0, md: 1 },
    mb: 1.5,
    p: { xs: 1.25, md: 1.5 },
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: 2,
    bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.035 : 0.1),
});
const keyValueSx: SxProps<Theme> = (theme) => ({
    display: 'inline-flex',
    alignItems: 'center',
    maxWidth: '100%',
    px: 1,
    py: 0.5,
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: 1,
    bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'light' ? 0.9 : 0.72),
    color: 'text.primary',
    fontFamily: '"Roboto Mono", "Consolas", monospace',
    fontSize: '0.82rem',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
});
const Row = ({ row, onAddLicense, onEdit, onDelete, onEditLicense, onDeleteLicense, onHistory, refreshKey }: {
    onHistory: (lic: Licencia, row: Software) => void;
    row: Software;
    onAddLicense: (s: Software) => void;
    onEdit: (s: Software) => void;
    onDelete: (id: number) => void;
    onEditLicense: (lic: Licencia, soft: Software) => void;
    onDeleteLicense: (lic: Licencia) => void;
    refreshKey: number;
}) => {
    const [open, setOpen] = useState(false);
    const [licencias, setLicencias] = useState<Licencia[]>([]);
    const [loading, setLoading] = useState(false);
    const [openKeys, setOpenKeys] = useState<Record<number, boolean>>({});
    const [clavesByLicencia, setClavesByLicencia] = useState<Record<number, LicenciaClave[]>>({});
    const [loadingKeys, setLoadingKeys] = useState<Record<number, boolean>>({});
    const [keyErrors, setKeyErrors] = useState<Record<number, string | null>>({});
    const [visibleKeys, setVisibleKeys] = useState<Record<number, boolean>>({});
    const { t, i18n } = useTranslation();
    const { canAdminInventory } = usePermissions();
    const { enqueueSnackbar } = useSnackbar();
    // Cargar licencias solo al expandir
    const loadLicencias = useCallback(async () => {
        if (!open)
            return;
        setLoading(true);
        try {
            setLicencias(await softwareService.getLicenciasBySoftware(row.SOF_Software));
        }
        catch (error) {
            console.error(error);
        }
        finally {
            setLoading(false);
        }
    }, [open, row.SOF_Software]);
    useEffect(() => {
        void Promise.resolve().then(loadLicencias);
    }, [loadLicencias, refreshKey]);
    useEffect(() => {
        setOpenKeys({});
        setClavesByLicencia({});
        setLoadingKeys({});
        setKeyErrors({});
        setVisibleKeys({});
    }, [refreshKey]);
    const loadClaves = useCallback(async (licenciaId: number) => {
        setLoadingKeys((prev) => ({ ...prev, [licenciaId]: true }));
        setKeyErrors((prev) => ({ ...prev, [licenciaId]: null }));
        try {
            const data = await softwareService.getClavesLicencia(licenciaId);
            setClavesByLicencia((prev) => ({ ...prev, [licenciaId]: data }));
        }
        catch (error) {
            console.error(error);
            setKeyErrors((prev) => ({
                ...prev,
                [licenciaId]: t('software.keys_load_error'),
            }));
        }
        finally {
            setLoadingKeys((prev) => ({ ...prev, [licenciaId]: false }));
        }
    }, [t]);
    const toggleClaves = useCallback(async (licencia: Licencia) => {
        const licenciaId = licencia.LIC_Licencia;
        const willOpen = !openKeys[licenciaId];
        setOpenKeys((prev) => ({ ...prev, [licenciaId]: willOpen }));
        if (willOpen && !clavesByLicencia[licenciaId]) {
            await loadClaves(licenciaId);
        }
    }, [clavesByLicencia, loadClaves, openKeys]);
    const toggleVisibleKey = (claveId: number) => {
        setVisibleKeys((prev) => ({ ...prev, [claveId]: !prev[claveId] }));
    };
    const copyKey = async (clave: string) => {
        try {
            await navigator.clipboard.writeText(clave);
            enqueueSnackbar(t('software.key_copied'), { variant: 'success' });
        }
        catch (error) {
            console.error(error);
            enqueueSnackbar(t('software.key_copy_error'), { variant: 'error' });
        }
    };
    return (<>
      <TableRow hover sx={{ '& > *': { borderBottom: open ? 0 : undefined } }}>
        <TableCell>
          <Tooltip title={open ? t('software.hide_licenses') : t('software.view_licenses')}>
            <IconButton size="small" onClick={() => setOpen(!open)} aria-label={open ? t('software.hide_licenses') : t('software.view_licenses')} sx={{ color: 'primary.main' }}>
              {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </IconButton>
          </Tooltip>
        </TableCell>
        <TableCell component="th" scope="row">
          <Stack spacing={0.25}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
              {row.SOF_Nombre}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ID {row.SOF_Software}
            </Typography>
          </Stack>
        </TableCell>
        <TableCell sx={{ color: 'text.secondary' }}>{row.SOF_Fabricante}</TableCell>
        <TableCell sx={{ color: 'text.secondary' }}>{row.SOF_Version || t('software.not_applicable')}</TableCell>
        <TableCell align="right">
          {canAdminInventory && (<>
          <Tooltip title={t('common.edit')}>
            <IconButton size="small" onClick={() => onEdit(row)} aria-label={t('common.edit')} sx={{ color: 'primary.main', mr: 0.5 }}>
              <EditIcon fontSize="small"/>
            </IconButton>
          </Tooltip>
          <Tooltip title={t('common.delete')}>
            <IconButton size="small" onClick={() => onDelete(row.SOF_Software)} aria-label={t('common.delete')} sx={{ color: 'error.main', mr: 0.5 }}>
              <DeleteIcon fontSize="small"/>
            </IconButton>
          </Tooltip>
          <Tooltip title={t('software.btn_add_license')}>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onAddLicense(row); }} aria-label={t('software.btn_add_license')} sx={{ color: 'success.main' }}>
              <AddCardIcon fontSize="small"/>
            </IconButton>
          </Tooltip>
          </>)}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={licensesPanelSx}>
              <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" spacing={1} sx={{ mb: 1.5 }}>
                <Typography variant="subtitle1" component="div">
                  {t('software.inventory_title')}
                </Typography>
                <Chip size="small" variant="outlined" label={t('software.licenses_count', { count: licencias.length })}/>
              </Stack>

              {loading ? <Box p={2}><CircularProgress size={20}/></Box> : (<TableContainer component={Box}>
                  <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('software.license_key')}</TableCell>
                      <TableCell>{t('software.license_expiry')}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{t('software.seats_short')}</TableCell>
                      <TableCell>{t('software.license_status')}</TableCell>
                      <TableCell align="right">{t('common.actions')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {licencias.map((lic) => {
                const licenciaId = lic.LIC_Licencia;
                const hasIndividualKeys = (lic.LIC_Claves_Total ?? 0) > 0;
                const keysOpen = !!openKeys[licenciaId];
                const keyRows = clavesByLicencia[licenciaId] ?? [];
                return (<Fragment key={licenciaId}>
                          <TableRow hover>
                            <TableCell sx={{ maxWidth: 340 }}>
                              {hasIndividualKeys ? (<Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                  <VpnKeyIcon fontSize="small" color="primary"/>
                                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                    {t('software.protected_license_keys')}
                                  </Typography>
                                </Stack>) : lic.LIC_Clave_Activacion ? (<Box component="span" sx={keyValueSx}>
                                  {maskLicenseKey(lic.LIC_Clave_Activacion)}
                                </Box>) : (<Typography variant="body2" color="text.secondary">
                                  {t('software.digital_license')}
                                </Typography>)}
                            </TableCell>
                            <TableCell>
                              {lic.LIC_Fecha_Vencimiento ? formatDate(lic.LIC_Fecha_Vencimiento) : t('software.perpetual')}
                            </TableCell>
                            <TableCell>
                              {lic.LIC_Cantidad_Usada} / {lic.LIC_Cantidad_Total}
                              {lic.LIC_Costo != null && (<Typography variant="caption" display="block" color="text.secondary">
                                  {formatMoney(lic.LIC_Costo, lic.LIC_Moneda ?? 'GTQ', i18n.language)}
                                </Typography>)}
                              {hasIndividualKeys && (<Chip size="small" sx={{ ml: 1 }} variant="outlined" icon={<VpnKeyIcon />} label={t('software.keys_available', {
                            available: lic.LIC_Claves_Disponibles ?? 0,
                            total: lic.LIC_Claves_Total ?? 0,
                        })}/>)}
                            </TableCell>
                            <TableCell>
                              <StatusChip label={lic.LIC_Cantidad_Usada >= lic.LIC_Cantidad_Total
                        ? t('software.sold_out')
                        : t('software.available')} />
                            </TableCell>
                            <TableCell align="right">
                              {hasIndividualKeys && canAdminInventory && (<Tooltip title={keysOpen
                            ? t('software.hide_keys')
                            : t('software.view_keys')}>
                                  <IconButton size="small" onClick={(event) => {
                            event.stopPropagation();
                            void toggleClaves(lic);
                        }} aria-label={keysOpen
                            ? t('software.hide_keys')
                            : t('software.view_keys')} sx={{ color: 'info.main' }}>
                                    {keysOpen ? <KeyboardArrowUpIcon fontSize="small"/> : <VpnKeyIcon fontSize="small"/>}
                                  </IconButton>
                                </Tooltip>)}
                              <Tooltip title={t('software.history')}>
                                <IconButton size="small" onClick={() => onHistory(lic, row)} aria-label={t('software.history')}>
                                  <HistoryIcon fontSize="small"/>
                                </IconButton>
                              </Tooltip>
                              {canAdminInventory && (<>
                              <Tooltip title={t('software.edit_license')}>
                                <IconButton size="small" onClick={() => onEditLicense(lic, row)} aria-label={t('software.edit_license')}>
                                  <EditIcon fontSize="small"/>
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t('common.delete')}>
                                <IconButton size="small" color="error" onClick={() => onDeleteLicense(lic)} aria-label={t('common.delete')}>
                                  <DeleteIcon fontSize="small"/>
                                </IconButton>
                              </Tooltip>
                              </>)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell colSpan={5} sx={{ p: 0, borderBottom: keysOpen ? undefined : 0 }}>
                              <Collapse in={keysOpen} timeout="auto" unmountOnExit>
                                <Box sx={keyPanelSx}>
                                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" sx={{ mb: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                      {t('software.key_inventory')}
                                    </Typography>
                                    <Stack direction="row" spacing={1}>
                                      <Chip size="small" color="success" variant="outlined" label={t('software.keys_free_count', {
                        count: lic.LIC_Claves_Disponibles ?? 0,
                    })}/>
                                      <Chip size="small" color="warning" variant="outlined" label={t('software.keys_assigned_count', {
                        count: lic.LIC_Claves_Asignadas ?? 0,
                    })}/>
                                    </Stack>
                                  </Stack>

                                  {loadingKeys[licenciaId] ? (<Box p={2}><CircularProgress size={18}/></Box>) : keyErrors[licenciaId] ? (<Alert severity="error">{keyErrors[licenciaId]}</Alert>) : (<TableContainer component={Box}>
                                      <Table size="small">
                                      <TableHead>
                                        <TableRow>
                                          <TableCell>{t('software.key_value')}</TableCell>
                                          <TableCell>{t('software.key_reference')}</TableCell>
                                          <TableCell>{t('software.key_status')}</TableCell>
                                          <TableCell>{t('software.key_assignment')}</TableCell>
                                          <TableCell>{t('software.key_created')}</TableCell>
                                          <TableCell align="right">{t('common.actions')}</TableCell>
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        {keyRows.map((clave) => {
                            const isVisible = !!visibleKeys[clave.LCL_Licencia_Clave];
                            const targetType = clave.LCL_Destino_Tipo === 'PERSONA'
                                ? t('software.assigned_person')
                                : t('software.assigned_asset');
                            return (<TableRow key={clave.LCL_Licencia_Clave}>
                                              <TableCell sx={{ maxWidth: 360 }}>
                                                <Box component="span" sx={keyValueSx}>
                                                  {isVisible
                                    ? clave.LCL_Clave_Activacion
                                    : maskLicenseKey(clave.LCL_Clave_Activacion)}
                                                </Box>
                                              </TableCell>
                                              <TableCell>{clave.LCL_Referencia || '—'}</TableCell>
                                              <TableCell>
                                                <Chip size="small" color={keyStatusColor(clave.LCL_Estado)} variant="outlined" label={t(`software.key_status_${clave.LCL_Estado}`, clave.LCL_Estado)}/>
                                              </TableCell>
                                              <TableCell sx={{ minWidth: 220 }}>
                                                {clave.LCL_Destino_Nombre ? (<Stack spacing={0.25}>
                                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                      {clave.LCL_Destino_Nombre}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                      {targetType}{clave.LCL_Destino_Detalle ? ` - ${clave.LCL_Destino_Detalle}` : ''}
                                                    </Typography>
                                                    {clave.LCL_Asignada_En && (<Typography variant="caption" color="text.secondary">
                                                        {t('software.assigned_on')}: {formatDate(clave.LCL_Asignada_En)}
                                                      </Typography>)}
                                                  </Stack>) : (<Typography variant="body2" color="text.secondary">
                                                    {t('software.key_unassigned')}
                                                  </Typography>)}
                                              </TableCell>
                                              <TableCell>
                                                {clave.LCL_Creado_En
                                    ? formatDate(clave.LCL_Creado_En)
                                    : '—'}
                                              </TableCell>
                                              <TableCell align="right">
                                                <Tooltip title={isVisible
                                    ? t('software.hide_key')
                                    : t('software.reveal_key')}>
                                                  <IconButton size="small" onClick={() => toggleVisibleKey(clave.LCL_Licencia_Clave)} aria-label={isVisible
                                    ? t('software.hide_key')
                                    : t('software.reveal_key')}>
                                                    {isVisible ? <VisibilityOffIcon fontSize="small"/> : <VisibilityIcon fontSize="small"/>}
                                                  </IconButton>
                                                </Tooltip>
                                                <Tooltip title={t('software.copy_key')}>
                                                  <IconButton size="small" onClick={() => void copyKey(clave.LCL_Clave_Activacion)} aria-label={t('software.copy_key')}>
                                                    <ContentCopyIcon fontSize="small"/>
                                                  </IconButton>
                                                </Tooltip>
                                              </TableCell>
                                            </TableRow>);
                        })}
                                        {keyRows.length === 0 && (<TableRow>
                                            <TableCell colSpan={6} align="center" sx={{ color: 'text.secondary', py: 2 }}>
                                              {t('software.no_keys')}
                                            </TableCell>
                                          </TableRow>)}
                                      </TableBody>
                                      </Table>
                                    </TableContainer>)}
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </Fragment>);
            })}
                    {licencias.length === 0 && (<TableRow>
                        <TableCell colSpan={5} align="center" sx={{ color: 'text.secondary', fontStyle: 'italic', py: 2 }}>
                          {t('software.no_licenses')}
                        </TableCell>
                      </TableRow>)}
                  </TableBody>
                  </Table>
                </TableContainer>)}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>);
};
export const SoftwarePage = () => {
    const { t } = useTranslation();
    const { canAdminInventory, canExport } = usePermissions();
    const [historial, setHistorial] = useState<{ lic: Licencia; titulo: string } | null>(null);
    const confirm = useConfirm();
    const [search, setSearch] = useState('');
    const { enqueueSnackbar } = useSnackbar();
    const [softwareList, setSoftwareList] = useState<Software[]>([]);
    const [openSoftDialog, setOpenSoftDialog] = useState(false);
    const [selectedSoft, setSelectedSoft] = useState<Software | null>(null);
    const [softwareToEdit, setSoftwareToEdit] = useState<Software | undefined>(undefined);
    const [licenciaToEdit, setLicenciaToEdit] = useState<Licencia | null>(null);
    const [licenseDialogOpen, setLicenseDialogOpen] = useState(false);
    const [licenseTypesOpen, setLicenseTypesOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [licRefreshKey, setLicRefreshKey] = useState(0);
    const loadData = useCallback(() => {
        setLoading(true);
        softwareService.getSoftware()
            .then(setSoftwareList)
            .catch((error) => {
            console.error(error);
            enqueueSnackbar(t('common.error_loading'), { variant: 'error' });
        })
            .finally(() => setLoading(false));
    }, [enqueueSnackbar, t]);
    useEffect(() => { void Promise.resolve().then(loadData); }, [loadData]);
    const handleEdit = (soft: Software) => {
        setSoftwareToEdit(soft);
        setOpenSoftDialog(true);
    };
    const handleDelete = async (id: number) => {
        if (!(await confirm({ message: t('common.confirm_delete'), destructive: true, confirmText: t('common.delete') })))
            return;
        try {
            await softwareService.deleteSoftware(id);
            enqueueSnackbar(t('common.success_update'), { variant: 'success' });
            loadData();
        }
        catch (err: unknown) {
            enqueueSnackbar(getApiErrorMessage(err, t('common.error_save')), { variant: 'error' });
        }
    };
    const handleEditLicense = (lic: Licencia, soft: Software) => {
        setSelectedSoft(soft);
        setLicenciaToEdit(lic);
        setLicenseDialogOpen(true);
    };
    const handleDeleteLicense = async (lic: Licencia) => {
        if (!(await confirm({ message: t('common.confirm_delete'), destructive: true, confirmText: t('common.delete') })))
            return;
        try {
            await softwareService.deleteLicencia(lic.LIC_Licencia);
            enqueueSnackbar(t('common.success_update'), { variant: 'success' });
            setLicRefreshKey((k) => k + 1);
        }
        catch (err: unknown) {
            enqueueSnackbar(getApiErrorMessage(err, t('common.error_save')), { variant: 'error' });
        }
    };
    const handleAddLicense = (s: Software) => {
        setSelectedSoft(s);
        setLicenciaToEdit(null);
        setLicenseDialogOpen(true);
    };
    const handleCloseDialog = (refresh?: boolean) => {
        setOpenSoftDialog(false);
        setSoftwareToEdit(undefined);
        if (refresh)
            loadData();
    };
    const handleCloseLicenseDialog = (refresh?: boolean) => {
        setLicenseDialogOpen(false);
        setSelectedSoft(null);
        setLicenciaToEdit(null);
        if (refresh)
            setLicRefreshKey((k) => k + 1);
    };
    const q = search.trim().toLowerCase();
    const filtered = q
        ? softwareList.filter((s) => [s.SOF_Nombre, s.SOF_Fabricante, s.SOF_Version]
            .some((v) => (v ?? '').toLowerCase().includes(q)))
        : softwareList;
    return (<Box>
      <PageHeader
        title={t('software.page_title')}
        badge={filtered.length}
        actions={(canAdminInventory || canExport) ? (<>
          {canExport && <ExportMenuButton onExport={(lang) => downloadCsv('/inventario/licencias.csv', 'licencias.csv', lang)}/>}
          {canAdminInventory && (<>
          <Button variant="outlined" startIcon={<CategoryIcon />} onClick={() => setLicenseTypesOpen(true)}>
            {t('app.license_types_title')}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setSoftwareToEdit(undefined); setOpenSoftDialog(true); }}>
            {t('software.btn_new')}
          </Button>
          </>)}
        </>) : undefined}
      />

      <CollapsibleToolbar storageKey="software" search={<SearchInput value={search} onChange={setSearch}/>}/>

      <SoftwareDialog open={openSoftDialog} onClose={handleCloseDialog} softwareToEdit={softwareToEdit}/>

      <LicenseDialog open={licenseDialogOpen} softwarePreseleccionado={selectedSoft} licenciaToEdit={licenciaToEdit} onClose={handleCloseLicenseDialog}/>
      <LicenseTypesDialog open={licenseTypesOpen} onClose={() => setLicenseTypesOpen(false)} />
      <LicenseHistoryDialog licencia={historial?.lic ?? null} titulo={historial?.titulo} onClose={() => setHistorial(null)}/>

      <DataTableShell
        columns={[
          { key: 'expand', label: '', width: '50px' },
          { key: 'name', label: t('common.name') },
          { key: 'manufacturer', label: t('common.manufacturer') },
          { key: 'version', label: t('common.version') },
          { key: 'actions', label: t('common.actions'), align: 'right' },
        ]}
        rows={filtered}
        loading={loading}
        emptyTitle={t('common.no_records')}
        renderRow={(row) => (<Row key={row.SOF_Software} row={row} onAddLicense={handleAddLicense} onEdit={handleEdit} onDelete={handleDelete} onEditLicense={handleEditLicense} onDeleteLicense={handleDeleteLicense} onHistory={(lic, sw) => setHistorial({ lic, titulo: `${sw.SOF_Nombre}${sw.SOF_Version ? ` ${sw.SOF_Version}` : ''}` })} refreshKey={licRefreshKey}/>)}
      />
    </Box>);
};
