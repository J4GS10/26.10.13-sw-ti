import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Chip, CircularProgress, IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../components/ui';
import { useConfirm } from '../../components/confirm-context';
import { useSnackbar } from 'notistack';
import { getApiErrorDetail } from '../../api/errors';
import { attachmentService, Adjunto } from './attachmentService';
const CATEGORIES = ['factura', 'foto', 'acta', 'otro'];
const fmtSize = (bytes: number): string => {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
interface Props {
    activoId?: string;
    ordenId?: number;
}
export const AttachmentsSection = ({ activoId, ordenId }: Props) => {
    const { t } = useTranslation();
    const confirm = useConfirm();
    const { enqueueSnackbar } = useSnackbar();
    const fileRef = useRef<HTMLInputElement>(null);
    const isOrden = ordenId != null;
    const [items, setItems] = useState<Adjunto[]>([]);
    const [loading, setLoading] = useState(false);
    const [categoria, setCategoria] = useState(isOrden ? 'factura' : 'otro');
    const [uploading, setUploading] = useState(false);
    const load = useCallback(async () => {
        if (!activoId && !ordenId)
            return;
        setLoading(true);
        try {
            setItems(isOrden
                ? await attachmentService.listOrden(ordenId as number)
                : await attachmentService.list(activoId as string));
        }
        catch {
            enqueueSnackbar(t('common.error_loading'), { variant: 'error' });
        }
        finally {
            setLoading(false);
        }
    }, [activoId, enqueueSnackbar, isOrden, ordenId, t]);
    useEffect(() => { load(); }, [load]);
    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        setUploading(true);
        try {
            if (isOrden)
                await attachmentService.uploadOrden(ordenId as number, file, categoria);
            else
                await attachmentService.upload(activoId as string, file, categoria);
            enqueueSnackbar(t('attachments.uploaded'), { variant: 'success' });
            await load();
        }
        catch (err: unknown) {
            const code = getApiErrorDetail(err);
            let msg = t('common.error_generic');
            if (code === 'FILE_TYPE_NOT_ALLOWED')
                msg = t('attachments.err_type');
            else if (typeof code === 'string' && code.startsWith('FILE_TOO_LARGE')) {
                msg = t('attachments.err_size');
            }
            enqueueSnackbar(msg, { variant: 'error' });
        }
        finally {
            setUploading(false);
            if (fileRef.current)
                fileRef.current.value = '';
        }
    };
    const handleDelete = async (id: string) => {
        if (!(await confirm({ message: t('common.confirm_delete'), destructive: true, confirmText: t('common.delete') })))
            return;
        try {
            await attachmentService.remove(id);
            await load();
        }
        catch {
            enqueueSnackbar(t('common.error_generic'), { variant: 'error' });
        }
    };
    return (<Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }}>
        <TextField select size="small" label={t('attachments.category')} value={categoria} onChange={(e) => setCategoria(e.target.value)} sx={{ minWidth: 160 }}>
          {CATEGORIES.map((c) => (<MenuItem key={c} value={c}>{t(`attachments.cat_${c}`, c)}</MenuItem>))}
        </TextField>
        <input ref={fileRef} type="file" hidden onChange={handleFile}/>
        <Button variant="contained" startIcon={uploading ? <CircularProgress size={18}/> : <UploadFileIcon />} onClick={() => fileRef.current?.click()} disabled={uploading}>
          {t('attachments.upload')}
        </Button>
        <Typography variant="caption" color="text.secondary">
          {t('attachments.hint')}
        </Typography>
      </Stack>

      {loading ? (<Box display="flex" justifyContent="center" py={3}><CircularProgress /></Box>) : items.length === 0 ? (<EmptyState compact title={t('attachments.empty')}/>) : (<TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('attachments.name')}</TableCell>
                <TableCell>{t('attachments.category')}</TableCell>
                <TableCell>{t('attachments.size')}</TableCell>
                <TableCell>{t('attachments.date')}</TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((a) => (<TableRow key={a.ADJ_Adjunto} hover>
                  <TableCell>{a.ADJ_Nombre_Original}</TableCell>
                  <TableCell><Chip size="small" label={t(`attachments.cat_${a.ADJ_Categoria}`, a.ADJ_Categoria)}/></TableCell>
                  <TableCell>{fmtSize(a.ADJ_Tamano_Bytes)}</TableCell>
                  <TableCell>{a.ADJ_Fecha_Subida.slice(0, 10)}</TableCell>
                  <TableCell align="right">
                    <Tooltip title={t('attachments.download') as string}>
                      <IconButton size="small" color="primary" onClick={() => attachmentService.download(a)}>
                        <DownloadIcon fontSize="small"/>
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.delete') as string}>
                      <IconButton size="small" color="error" onClick={() => handleDelete(a.ADJ_Adjunto)}>
                        <DeleteIcon fontSize="small"/>
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>))}
            </TableBody>
          </Table>
        </TableContainer>)}
    </Box>);
};
