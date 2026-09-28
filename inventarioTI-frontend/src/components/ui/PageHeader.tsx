import { Box, Chip, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string | number;
  actions?: ReactNode;
}

/**
 * Encabezado estándar de página: título, subtítulo opcional, badge de conteo y acciones.
 * Las acciones hacen wrap y en pantallas angostas pasan debajo del título, así
 * nunca se salen de la pantalla ni se sobreponen.
 */
export const PageHeader = ({ title, subtitle, badge, actions }: PageHeaderProps) => (
  <Box
    sx={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      columnGap: 3,
      rowGap: 1.5,
      mb: 3,
    }}
  >
    <Box sx={{ minWidth: 0, flex: '1 1 280px' }}>
      <Stack direction="row" alignItems="center" spacing={1.25}>
        <Typography variant="h5" component="h1" noWrap>
          {title}
        </Typography>
        {badge !== undefined && (
          <Chip label={badge} size="small" sx={{ height: 22, fontSize: '0.75rem', bgcolor: 'action.selected' }} />
        )}
      </Stack>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {subtitle}
        </Typography>
      )}
    </Box>

    {actions && (
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: { xs: 'flex-start', sm: 'flex-end' },
          gap: 1,
          maxWidth: '100%',
        }}
      >
        {actions}
      </Box>
    )}
  </Box>
);
