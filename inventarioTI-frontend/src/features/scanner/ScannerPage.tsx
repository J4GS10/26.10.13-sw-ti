import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../components/ui';
import { useSnackbar } from 'notistack';
import { Box, Button, Chip, CircularProgress, Divider, Paper, Stack, TextField, Typography } from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import SearchIcon from '@mui/icons-material/Search';
import HistoryIcon from '@mui/icons-material/History';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import BuildIcon from '@mui/icons-material/Build';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import { PageHeader } from '../../components/ui';
import { getApiErrorMessage } from '../../api/errors';
import { Activo } from '../../types/inventory';
import { assetService } from '../assets/assetService';
import { AssetDetailDialog } from '../assets/AssetDetailDialog';
import { usePermissions } from '../../hooks/usePermissions';
type DetectedBarcode = {
    rawValue: string;
};
type BarcodeDetectorInstance = {
    detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
};
type BarcodeDetectorConstructor = new (options?: {
    formats?: string[];
}) => BarcodeDetectorInstance;
declare global {
    interface Window {
        BarcodeDetector?: BarcodeDetectorConstructor;
    }
}
function parseScannedCode(rawValue: string): string {
    const value = rawValue.trim();
    if (!value)
        return "";
    if (value.toLowerCase().startsWith("asset:")) {
        return value.slice(6).trim();
    }
    try {
        const url = new URL(value);
        const lastSegment = url.pathname.split("/").filter(Boolean).pop();
        return (lastSegment || value).trim();
    }
    catch {
        return value;
    }
}
export const ScannerPage = () => {
    const { t } = useTranslation();
    const { canOperate } = usePermissions();
    const { enqueueSnackbar } = useSnackbar();
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const frameRef = useRef<number | null>(null);
    const scanningRef = useRef(false);
    const resolvingRef = useRef(false);
    const lastCodeRef = useRef("");
    const [cameraState, setCameraState] = useState<'idle' | 'active' | 'unsupported' | 'denied'>('idle');
    const [manualCode, setManualCode] = useState('');
    const [asset, setAsset] = useState<Activo | null>(null);
    const [loading, setLoading] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const stopCamera = useCallback(() => {
        scanningRef.current = false;
        if (frameRef.current !== null) {
            window.cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
        }
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setCameraState((state) => (state === 'active' ? 'idle' : state));
    }, []);
    const resolveCode = useCallback(async (rawCode: string) => {
        const code = parseScannedCode(rawCode);
        if (!code || code === lastCodeRef.current)
            return;
        lastCodeRef.current = code;
        setLoading(true);
        try {
            const found = await assetService.getActivoByCode(code);
            setAsset(found);
            setManualCode(found.ACT_Codigo_Interno);
            setDetailOpen(true);
            enqueueSnackbar(t('scanner.found'), { variant: 'success' });
        }
        catch (error: unknown) {
            setAsset(null);
            enqueueSnackbar(getApiErrorMessage(error, t('scanner.not_found')), {
                variant: 'error',
            });
        }
        finally {
            setLoading(false);
        }
    }, [enqueueSnackbar, t]);
    const scanLoop = useCallback((detector: BarcodeDetectorInstance) => {
        const tick = async () => {
            if (!scanningRef.current || !videoRef.current)
                return;
            if (videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !resolvingRef.current) {
                resolvingRef.current = true;
                try {
                    const codes = await detector.detect(videoRef.current);
                    const firstCode = codes[0]?.rawValue;
                    if (firstCode)
                        await resolveCode(firstCode);
                }
                catch {
                    // El detector puede fallar en frames intermedios; el siguiente frame reintenta.
                }
                finally {
                    resolvingRef.current = false;
                }
            }
            frameRef.current = window.requestAnimationFrame(tick);
        };
        frameRef.current = window.requestAnimationFrame(tick);
    }, [resolveCode]);
    const startCamera = useCallback(async () => {
        if (!window.BarcodeDetector || !navigator.mediaDevices?.getUserMedia) {
            setCameraState('unsupported');
            return;
        }
        try {
            const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' } },
                audio: false,
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            scanningRef.current = true;
            setCameraState('active');
            scanLoop(detector);
        }
        catch {
            setCameraState('denied');
        }
    }, [scanLoop]);
    useEffect(() => stopCamera, [stopCamera]);
    const handleManualSearch = async () => {
        lastCodeRef.current = "";
        await resolveCode(manualCode);
    };
    return (<Box>
      <PageHeader
        title={t('scanner.title')}
        subtitle={t('scanner.subtitle')}
        actions={
          <Stack direction="row" spacing={1}>
            {cameraState === 'active' ? (<Button startIcon={<StopCircleIcon />} variant="outlined" color="inherit" onClick={stopCamera}>
                {t('scanner.stop')}
              </Button>) : (<Button startIcon={<QrCodeScannerIcon />} variant="contained" onClick={startCamera}>
                {t('scanner.start')}
              </Button>)}
          </Stack>
        }
      />

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="stretch">
        <Paper variant="outlined" sx={{ p: 2, flex: 1, borderRadius: 2 }}>
          <Box sx={{
            position: 'relative',
            bgcolor: 'grey.900',
            borderRadius: 1,
            overflow: 'hidden',
            aspectRatio: { xs: '4 / 3', md: '16 / 9' },
            minHeight: 260,
            display: 'grid',
            placeItems: 'center',
        }}>
            <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            {cameraState !== 'active' && (<Stack spacing={1} alignItems="center" sx={{ position: 'absolute', color: 'common.white' }}>
                <QrCodeScannerIcon fontSize="large"/>
                <Typography variant="body2">
                  {cameraState === 'unsupported'
                ? t('scanner.unsupported')
                : cameraState === 'denied'
                    ? t('scanner.denied')
                    : t('scanner.idle')}
                </Typography>
              </Stack>)}
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, width: { xs: '100%', lg: 380 }, borderRadius: 2 }}>
          <Stack spacing={2}>
            <TextField label={t('scanner.manual_code')} value={manualCode} onChange={(event) => setManualCode(event.target.value)} size="small" fullWidth/>
            <Button startIcon={loading ? <CircularProgress size={16}/> : <SearchIcon />} variant="contained" disabled={loading || !manualCode.trim()} onClick={handleManualSearch}>
              {t('common.search')}
            </Button>

            <Divider />

            {asset ? (<Stack spacing={1.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
                    {asset.ACT_Codigo_Interno}
                  </Typography>
                  <Chip size="small" label={asset.ACT_Hostname || t('assets.table.no_host')}/>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {asset.ACT_Serie_Fabricante}
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row', lg: 'column' }} spacing={1}>
                  <Button startIcon={<HistoryIcon />} variant="outlined" onClick={() => setDetailOpen(true)}>
                    {t('common.view')}
                  </Button>
                  {canOperate && (<Button startIcon={<SwapHorizIcon />} variant="outlined" onClick={() => navigate('/operaciones/movimientos')}>
                    {t('scanner.assign')}
                  </Button>)}
                  {canOperate && (<Button startIcon={<BuildIcon />} variant="outlined" onClick={() => navigate('/mantenimiento')}>
                    {t('scanner.repair')}
                  </Button>)}
                </Stack>
              </Stack>) : (<EmptyState compact title={t('scanner.empty')}/>)}
          </Stack>
        </Paper>
      </Stack>

      <AssetDetailDialog open={detailOpen} asset={asset} onClose={() => setDetailOpen(false)}/>
    </Box>);
};
