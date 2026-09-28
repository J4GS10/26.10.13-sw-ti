import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, Chip, IconButton, TableCell, TableRow, Tooltip, Typography, } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import LogoutIcon from '@mui/icons-material/Logout';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { getApiErrorMessage } from '../../api/errors';
import { PageHeader, DataTableShell } from '../../components/ui';
import { SearchInput } from '../../components/SearchInput';
import { CollapsibleToolbar } from '../../components/CollapsibleToolbar';
import type { PersonaResumen } from '../../types/users';
import { personService } from './personService';
import { PersonDetailDialog } from './PersonDetailDialog';
import { PersonDialog } from './PersonDialog';
import { OffboardingDialog } from './OffboardingDialog';
import { usePermissions } from '../../hooks/usePermissions';
export const PersonsPage = () => {
    const { t } = useTranslation();
    const { canAdminInventory } = usePermissions();
    const { enqueueSnackbar } = useSnackbar();
    const [personas, setPersonas] = useState<PersonaResumen[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<PersonaResumen | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [offboardOpen, setOffboardOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await personService.list();
            setPersonas(data);
        }
        catch {
            enqueueSnackbar(t('common.error_loading'), { variant: 'error' });
        }
        finally {
            setLoading(false);
        }
    }, [enqueueSnackbar, t]);
    useEffect(() => {
        load();
    }, [load]);
    const handleReactivate = async (p: PersonaResumen) => {
        try {
            await personService.update(p.PER_Persona, { PER_Estado: true });
            enqueueSnackbar(t('persons.messages.reactivated'), { variant: 'success' });
            load();
        }
        catch (err: unknown) {
            enqueueSnackbar(getApiErrorMessage(err, t('common.error_generic')), { variant: 'error' });
        }
    };
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q)
            return personas;
        return personas.filter((p) => [
            p.PER_Primer_Nombre,
            p.PER_Primer_Apellido,
            p.PER_Email_Corporativo,
        ]
            .filter(Boolean)
            .some((v) => v.toLowerCase().includes(q)));
    }, [personas, search]);
    return (<Box>
      <PageHeader
        title={t('persons.title')}
        subtitle={t('persons.subtitle')}
        badge={filtered.length}
        actions={canAdminInventory ? <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setSelected(null); setEditOpen(true); }}>{t('persons.new')}</Button> : undefined}
      />

      <CollapsibleToolbar storageKey="persons" search={<SearchInput value={search} onChange={setSearch} placeholder={t('persons.search')}/>}/>

      <DataTableShell
        columns={[
          { key: 'name', label: t('persons.col_name') },
          { key: 'email', label: t('persons.col_email') },
          { key: 'phone', label: t('persons.col_phone') },
          { key: 'active', label: t('common.active'), align: 'center' },
          { key: 'actions', label: t('common.actions'), align: 'right' },
        ]}
        rows={filtered}
        loading={loading}
        emptyTitle={t('common.no_records')}
        renderRow={(p) => (<TableRow key={p.PER_Persona} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight={500}>
                        {p.PER_Primer_Nombre} {p.PER_Primer_Apellido}
                      </Typography>
                      {p.PER_AD_GUID && (<Tooltip title={t('persons.ad_synced_tooltip') as string}>
                          <Chip label={t('persons.ad_chip')} size="small" color="info" variant="outlined" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }}/>
                        </Tooltip>)}
                    </Box>
                  </TableCell>
                  <TableCell>{p.PER_Email_Corporativo}</TableCell>
                  <TableCell>{p.PER_Telefono ?? '—'}</TableCell>
                  <TableCell align="center">
                    <Chip label={p.PER_Estado
                    ? t('common.active')
                    : t('persons.inactive')} size="small" color={p.PER_Estado ? 'success' : 'default'}/>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={t('persons.view_detail') as string}>
                      <IconButton size="small" onClick={() => { setSelected(p); setDetailOpen(true); }}>
                        <VisibilityIcon fontSize="small"/>
                      </IconButton>
                    </Tooltip>
                    {canAdminInventory && (<Tooltip title={t('common.edit') as string}>
                      <IconButton size="small" color="primary" onClick={() => { setSelected(p); setEditOpen(true); }}>
                        <EditIcon fontSize="small"/>
                      </IconButton>
                    </Tooltip>)}
                    {!canAdminInventory ? null : p.PER_Estado ? (<Tooltip title={t('persons.offboarding.tooltip') as string}>
                        <IconButton size="small" color="warning" onClick={() => { setSelected(p); setOffboardOpen(true); }}>
                          <LogoutIcon fontSize="small"/>
                        </IconButton>
                      </Tooltip>) : (<Tooltip title={t('persons.reactivate') as string}>
                        <IconButton size="small" color="success" onClick={() => handleReactivate(p)}>
                          <HowToRegIcon fontSize="small"/>
                        </IconButton>
                      </Tooltip>)}
                  </TableCell>
                </TableRow>)}
      />

      <PersonDetailDialog open={detailOpen} persona={selected} onClose={() => setDetailOpen(false)} onOffboard={() => { setDetailOpen(false); setOffboardOpen(true); }}/>
      <OffboardingDialog open={offboardOpen} persona={selected} onClose={() => setOffboardOpen(false)} onCompleted={load}/>
      <PersonDialog open={editOpen} persona={selected} onClose={(refresh) => { setEditOpen(false); setSelected(null); if (refresh)
        load(); }}/>
    </Box>);
};
