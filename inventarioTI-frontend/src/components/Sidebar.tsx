import React, { useState } from 'react';
import {
  Avatar, Box, ButtonBase, Divider, Drawer, IconButton, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, ListSubheader, Menu, MenuItem, Tooltip, Typography, alpha, useTheme,
} from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CheckIcon from '@mui/icons-material/Check';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DevicesOtherIcon from '@mui/icons-material/DevicesOther';
import LogoutIcon from '@mui/icons-material/Logout';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SecurityIcon from '@mui/icons-material/Security';
import { useAuth } from '../context/auth-context';
import { useConfig } from '../context/config-context';
import { NAVIGATION_ITEMS, NavItem } from '../router/navigation';
import { normalizeLanguage } from '../types/language';
import { ChangePasswordDialog } from '../features/auth/ChangePasswordDialog';
import { AccountSecurityDialog } from '../features/auth/AccountSecurityDialog';

export const DRAWER_WIDTH = 256;
export const DRAWER_COLLAPSED_WIDTH = 72;

type GroupKey = NonNullable<NavItem['group']>;
const GROUP_ORDER: GroupKey[] = ['OPERATIONS', 'PROCUREMENT', 'ORGANIZATION', 'CATALOG', 'SECURITY', 'ADMIN'];
const LANGUAGES = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italiano' },
] as const;

interface SidebarProps {
  /** Escritorio: barra fija expandida o en modo rail (solo iconos). */
  variant: 'permanent' | 'temporary';
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Móvil: drawer temporal. */
  open?: boolean;
  onClose?: () => void;
}

export const Sidebar = ({ variant, collapsed = false, onToggleCollapse, open = false, onClose }: SidebarProps) => {
  const theme = useTheme();
  const { user, logout, logoutAll } = useAuth();
  const { config } = useConfig();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [pwdOpen, setPwdOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const rail = variant === 'permanent' && collapsed;
  const width = rail ? DRAWER_COLLAPSED_WIDTH : DRAWER_WIDTH;
  const menuItems: NavItem[] = user
    ? NAVIGATION_ITEMS.filter((item) => item.allowedRoles.includes(user.role))
    : [];
  const currentLanguage = normalizeLanguage(i18n.resolvedLanguage);
  const initial = user?.sub ? user.sub.charAt(0).toUpperCase() : '?';

  const go = (path: string) => {
    navigate(path);
    onClose?.();
  };
  const closeMenu = () => setMenuAnchor(null);

  const renderItem = (item: NavItem) => {
    const isActive = location.pathname === item.path;
    const label = t(item.title, item.title);
    const button = (
      <ListItemButton
        onClick={() => go(item.path)}
        selected={isActive}
        aria-label={rail ? label : undefined}
        sx={{
          minHeight: 40,
          borderRadius: 1.5,
          px: rail ? 0 : 1.5,
          justifyContent: rail ? 'center' : 'flex-start',
          color: 'text.secondary',
          '& .MuiListItemIcon-root': { color: 'inherit' },
          '&:hover': { color: 'text.primary' },
          '&.Mui-selected': {
            color: 'primary.main',
            bgcolor: alpha(theme.palette.primary.main, 0.12),
            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.18) },
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: rail ? 0 : 36, justifyContent: 'center' }}>
          <item.icon fontSize="small" />
        </ListItemIcon>
        {!rail && (
          <ListItemText
            primary={label}
            primaryTypographyProps={{ variant: 'body2', fontWeight: isActive ? 700 : 500, noWrap: true }}
          />
        )}
      </ListItemButton>
    );
    return (
      <ListItem key={item.path} disablePadding sx={{ mb: 0.25 }}>
        {rail ? <Tooltip title={label} placement="right">{button}</Tooltip> : button}
      </ListItem>
    );
  };

  const content = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Marca */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, minHeight: 64,
        px: rail ? 0 : 2, justifyContent: rail ? 'center' : 'space-between',
      }}>
        {!rail && (
          <Box sx={{ minWidth: 0 }}>
            {config.SYS_Logo_URL ? (
              <Box component="img" src={config.SYS_Logo_URL} alt={config.SYS_Nombre_Empresa}
                sx={{ display: 'block', maxHeight: 36, maxWidth: 180, objectFit: 'contain' }}
                onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }} />
            ) : (
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'primary.main', lineHeight: 1.2 }} noWrap>
                {config.SYS_Nombre_Empresa}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {t('app.title')}
            </Typography>
          </Box>
        )}
        {variant === 'permanent' && onToggleCollapse && (
          <Tooltip title={t(rail ? 'common.show_navigation' : 'common.hide_navigation')} placement="right">
            <IconButton size="small" onClick={onToggleCollapse}
              aria-label={t(rail ? 'common.show_navigation' : 'common.hide_navigation')}>
              {rail ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Divider />

      {/* Navegación */}
      <List component="nav" dense sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', px: rail ? 1 : 1.5, py: 1 }}>
        {GROUP_ORDER.map((g, index) => {
          const items = menuItems.filter((m) => (m.group ?? 'OPERATIONS') === g);
          if (items.length === 0) return null;
          return (
            <React.Fragment key={g}>
              {rail
                ? index > 0 && <Divider sx={{ my: 1 }} />
                : (
                  <ListSubheader disableSticky sx={{
                    bgcolor: 'transparent', lineHeight: 1, px: 1.5, pt: index === 0 ? 0.5 : 2, pb: 1,
                    typography: 'overline', fontSize: '0.68rem', color: 'text.secondary',
                  }}>
                    {t(`menu_groups.${g}`, g)}
                  </ListSubheader>
                )}
              {items.map(renderItem)}
            </React.Fragment>
          );
        })}
      </List>

      {/* Cuenta */}
      <Divider />
      <Box sx={{ p: 1 }}>
        <Tooltip title={rail ? (user?.sub ?? '') : ''} placement="right">
          <ButtonBase
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            aria-haspopup="menu"
            aria-label={t('common.account_menu')}
            sx={{
              width: '100%', borderRadius: 1.5, p: 1, gap: 1.25,
              justifyContent: rail ? 'center' : 'flex-start',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Avatar sx={{
              width: 32, height: 32, fontSize: '0.875rem', fontWeight: 700,
              bgcolor: alpha(theme.palette.primary.main, 0.15), color: 'primary.main',
            }}>
              {initial}
            </Avatar>
            {!rail && (
              <>
                <Box sx={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                  <Typography variant="body2" fontWeight={700} noWrap>{user?.sub}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                    {user?.role ? t(`users.roles.${user.role}`, user.role) : ''}
                  </Typography>
                </Box>
                <MoreVertIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              </>
            )}
          </ButtonBase>
        </Tooltip>
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'top', horizontal: rail ? 'right' : 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { minWidth: 240 } } }}
      >
        <ListSubheader sx={{ bgcolor: 'transparent', lineHeight: 2.5, typography: 'overline', fontSize: '0.68rem' }}>
          {t('common.language')}
        </ListSubheader>
        {LANGUAGES.map((lang) => (
          <MenuItem key={lang.code} dense selected={currentLanguage === lang.code}
            onClick={() => { void i18n.changeLanguage(lang.code); closeMenu(); }}>
            <ListItemText>{lang.label}</ListItemText>
            {currentLanguage === lang.code && <CheckIcon fontSize="small" color="primary" />}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem dense onClick={() => { setSecurityOpen(true); closeMenu(); }}>
          <ListItemIcon><SecurityIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('security.account.title')}</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem dense onClick={() => { closeMenu(); logout(); navigate('/login'); }}>
          <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('auth.logout')}</ListItemText>
        </MenuItem>
        <MenuItem dense onClick={() => {
          closeMenu();
          logoutAll().catch(() => undefined).finally(() => navigate('/login'));
        }}>
          <ListItemIcon><DevicesOtherIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('auth.logout_all')}</ListItemText>
        </MenuItem>
      </Menu>

      <ChangePasswordDialog open={pwdOpen} onClose={() => setPwdOpen(false)} />
      <AccountSecurityDialog
        open={securityOpen}
        onClose={() => setSecurityOpen(false)}
        onChangePassword={() => setPwdOpen(true)}
      />
    </Box>
  );

  return (
    <Drawer
      variant={variant}
      open={variant === 'temporary' ? open : true}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        width: variant === 'permanent' ? width : undefined,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width,
          boxSizing: 'border-box',
          bgcolor: 'background.paper',
          borderRight: '1px solid',
          borderColor: 'divider',
          overflowX: 'hidden',
          transition: theme.transitions.create('width', { duration: theme.transitions.duration.shorter }),
        },
      }}
    >
      {content}
    </Drawer>
  );
};
