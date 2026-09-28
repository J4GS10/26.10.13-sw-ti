import { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, CircularProgress, Typography, Table, TableBody, TableCell, TableHead, TableRow, Chip, Box, Stack, IconButton, } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../../components/confirm-context';
import { useSnackbar } from 'notistack';
import { getApiErrorMessage } from '../../api/errors';
import { procurementService } from './procurementService';
import { OrdenCompra } from '../../types/procurement';
import { AttachmentsSection } from '../attachments/AttachmentsSection';
import { ReceiveOrderDialog } from './ReceiveOrderDialog';
import type { ChipColor } from '../../types/ui';
import { SectionCard } from '../../components/ui';
import { usePermissions } from '../../hooks/usePermissions';
import { formatMoney } from '../../utils/currency';
interface Props {
    open: boolean;
    ordenId: number | null;
    onClose: (refresh?: boolean) => void;
}
const estadoColor = (e: string): ChipColor => e === 'RECIBIDA' ? 'success' : e === 'CANCELADA' ? 'error' : 'default';
export const OrderDetailDialog = ({ open, ordenId, onClose }: Props) => {
    const { t, i18n } = useTranslation();
    const { canAdminInventory } = usePermissions();
    const confirm = useConfirm();
    const { enqueueSnackbar } = useSnackbar();
    const [orden, setOrden] = useState<OrdenCompra | null>(null);
    const [loading, setLoading] = useState(false);
    const [receiveOpen, setReceiveOpen] = useState(false);
    const [changed, setChanged] = useState(false);
    const load = useCallback(async () => {
        if (ordenId == null)
            return;
        setLoading(true);
        try {
            setOrden(await procurementService.getOrden(ordenId));
        }
        catch {
            enqueueSnackbar(t('common.error_loading'), { variant: 'error' });
        }
        finally {
            setLoading(false);
        }
    }, [enqueueSnackbar, ordenId, t]);
    useEffect(() => { if (open) {
        setChanged(false);
        load();
    } }, [open, load]);
    const cancelar = async () => {
        if (!orden)
            return;
        if (!(await confirm({ message: t('procurement.confirm_cancel'), destructive: true, confirmText: t('procurement.cancel_order') })))
            return;
        try {
            await procurementService.cambiarEstado(orden.OCO_Orden, 'CANCELADA');
            setChanged(true);
            load();
        }
        catch (err: unknown) {
            enqueueSnackbar(getApiErrorMessage(err, t('common.error_generic')), { variant: 'error' });
        }
    };
    const esBorrador = orden?.OCO_Estado === 'BORRADOR';
    return (<>
      <Dialog open={open} onClose={() => onClose(changed)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{t('procurement.order')} {orden?.OCO_Numero ?? ''}</span>
          <IconButton onClick={() => onClose(changed)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {loading || !orden ? (<Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>) : (<>
              <Stack spacing={2}>
                <SectionCard title={t('procurement.sections.order_data')}>
                  <Stack direction="row" spacing={3} flexWrap="wrap">
                    <Box><Typography variant="caption" color="text.secondary">{t('procurement.provider')}</Typography>
                      <Typography>{orden.proveedor?.PRV_Nombre ?? '—'}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">{t('procurement.date')}</Typography>
                      <Typography>{orden.OCO_Fecha}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">{t('procurement.status')}</Typography>
                      <Box><Chip size="small" label={orden.OCO_Estado} color={estadoColor(orden.OCO_Estado)}/></Box></Box>
                    <Box><Typography variant="caption" color="text.secondary">{t('procurement.total')}</Typography>
                      <Typography>{formatMoney(orden.OCO_Total, orden.OCO_Moneda, i18n.language)}</Typography></Box>
                  </Stack>
                  {orden.OCO_Notas && (<Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>{orden.OCO_Notas}</Typography>)}
                </SectionCard>
                <SectionCard title={t('procurement.lines')} noPadding>
                  <Table size="small">
                    <TableHead><TableRow>
                      <TableCell>{t('procurement.line_desc')}</TableCell>
                      <TableCell align="right">{t('procurement.line_qty')}</TableCell>
                      <TableCell align="right">{t('procurement.line_price')}</TableCell>
                      <TableCell align="right">{t('procurement.subtotal')}</TableCell>
                      <TableCell>{t('procurement.linked')}</TableCell>
                    </TableRow></TableHead>
                    <TableBody>
                      {(orden.lineas ?? []).map((l) => (<TableRow key={l.OCL_Linea}>
                          <TableCell>{l.OCL_Descripcion}</TableCell>
                          <TableCell align="right">{l.OCL_Cantidad}</TableCell>
                          <TableCell align="right">{formatMoney(l.OCL_Precio_Unitario, orden.OCO_Moneda, i18n.language)}</TableCell>
                          <TableCell align="right">{formatMoney(l.OCL_Subtotal ?? 0, orden.OCO_Moneda, i18n.language)}</TableCell>
                          <TableCell>
                            {l.ACT_Activo ? <Chip size="small" color="primary" label={t('procurement.linked_asset')}/>
                        : l.CON_Consumible ? <Chip size="small" label={t('procurement.linked_consumable')}/>
                            : '—'}
                          </TableCell>
                        </TableRow>))}
                      {(orden.lineas ?? []).length === 0 && (<TableRow><TableCell colSpan={5} sx={{ color: 'text.secondary' }}>
                          {t('procurement.no_lines')}</TableCell></TableRow>)}
                    </TableBody>
                  </Table>
                </SectionCard>
                <SectionCard title={t('procurement.invoice')}>
                  <AttachmentsSection ordenId={orden.OCO_Orden}/>
                </SectionCard>
              </Stack>
            </>)}
        </DialogContent>
        <DialogActions>
          {esBorrador && canAdminInventory && (<>
              <Button color="error" onClick={cancelar}>{t('procurement.cancel_order')}</Button>
              <Button variant="contained" color="success" onClick={() => setReceiveOpen(true)}>
                {t('procurement.receive')}
              </Button>
            </>)}
          <Button onClick={() => onClose(changed)} color="inherit">{t('common.close')}</Button>
        </DialogActions>
      </Dialog>

      <ReceiveOrderDialog open={receiveOpen} orden={orden} onClose={(r) => { setReceiveOpen(false); if (r) {
        setChanged(true);
        load();
    } }}/>
    </>);
};
