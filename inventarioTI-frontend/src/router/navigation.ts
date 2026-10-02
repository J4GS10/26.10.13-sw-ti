import DashboardIcon from '@mui/icons-material/Dashboard';
import ComputerIcon from '@mui/icons-material/Computer';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import SettingsIcon from '@mui/icons-material/Settings';
import CategoryIcon from '@mui/icons-material/Category';
import PlaceIcon from '@mui/icons-material/Place';
import BadgeIcon from '@mui/icons-material/Badge';
import BusinessIcon from '@mui/icons-material/Business';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ViewListIcon from '@mui/icons-material/ViewList';
import AppsIcon from '@mui/icons-material/Apps';
import BuildIcon from '@mui/icons-material/Build';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import StorefrontIcon from '@mui/icons-material/Storefront';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import PolicyIcon from '@mui/icons-material/Policy';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import ContactMailIcon from '@mui/icons-material/ContactMail';
import TimelineIcon from '@mui/icons-material/Timeline';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import ApprovalIcon from '@mui/icons-material/Approval';
import type { SvgIconComponent } from '@mui/icons-material';
import { UserRole } from '../types/auth';
import { ADMIN_READER_ROLES, AUDIT_READER_ROLES, IAM_ROLES, INVENTORY_READER_ROLES, INVENTORY_ROLES } from '../utils/roles';

export interface NavItem {
  title: string;
  path: string;
  icon: SvgIconComponent;
  allowedRoles: UserRole[];
  /** Etiqueta de grupo para ordenar el sidebar. */
  group?: 'OPERATIONS' | 'PROCUREMENT' | 'ORGANIZATION' | 'CATALOG' | 'SECURITY' | 'ADMIN';
}

export const NAVIGATION_ITEMS: NavItem[] = [
  // ---------- Tablero ----------
  {
    title: 'menu.dashboard',
    path: '/',
    icon: DashboardIcon,
    allowedRoles: INVENTORY_ROLES,
    group: 'OPERATIONS',
  },

  // ---------- Operación diaria ----------
  {
    title: 'menu.assets',
    path: '/activos',
    icon: ComputerIcon,
    allowedRoles: INVENTORY_READER_ROLES,
    group: 'OPERATIONS',
  },
  {
    title: 'menu.scanner',
    path: '/scanner',
    icon: QrCodeScannerIcon,
    allowedRoles: INVENTORY_READER_ROLES,
    group: 'OPERATIONS',
  },
  {
    title: 'menu.movements',
    path: '/operaciones/movimientos',
    icon: SwapHorizIcon,
    allowedRoles: INVENTORY_READER_ROLES,
    group: 'OPERATIONS',
  },
  {
    title: 'menu.traceability',
    path: '/trazabilidad',
    icon: TimelineIcon,
    allowedRoles: INVENTORY_READER_ROLES,
    group: 'OPERATIONS',
  },
  {
    title: 'menu.inventory_count',
    path: '/inventario/tomas',
    icon: FactCheckIcon,
    allowedRoles: INVENTORY_READER_ROLES,
    group: 'OPERATIONS',
  },
  {
    title: 'menu.approvals',
    path: '/aprobaciones',
    icon: ApprovalIcon,
    allowedRoles: ADMIN_READER_ROLES,
    group: 'OPERATIONS',
  },
  {
    title: 'menu.maintenance',
    path: '/mantenimiento',
    icon: BuildIcon,
    allowedRoles: INVENTORY_READER_ROLES,
    group: 'OPERATIONS',
  },
  {
    title: 'menu.software',
    path: '/software',
    icon: AppsIcon,
    allowedRoles: ADMIN_READER_ROLES,
    group: 'OPERATIONS',
  },
  {
    title: 'menu.consumables',
    path: '/consumibles',
    icon: Inventory2Icon,
    allowedRoles: INVENTORY_READER_ROLES,
    group: 'OPERATIONS',
  },

  // ---------- Compras y garantías ----------
  {
    title: 'menu.providers',
    path: '/compras/proveedores',
    icon: StorefrontIcon,
    allowedRoles: ADMIN_READER_ROLES,
    group: 'PROCUREMENT',
  },
  {
    title: 'menu.purchase_orders',
    path: '/compras/ordenes',
    icon: ReceiptLongIcon,
    allowedRoles: ADMIN_READER_ROLES,
    group: 'PROCUREMENT',
  },
  {
    title: 'menu.warranties',
    path: '/compras/garantias',
    icon: VerifiedUserIcon,
    allowedRoles: ADMIN_READER_ROLES,
    group: 'PROCUREMENT',
  },

  // ---------- Organización ----------
  {
    title: 'menu.departments',
    path: '/departamentos',
    icon: BusinessIcon,
    allowedRoles: ADMIN_READER_ROLES,
    group: 'ORGANIZATION',
  },
  {
    title: 'menu.persons',
    path: '/empleados',
    icon: BadgeIcon,
    allowedRoles: ADMIN_READER_ROLES,
    group: 'ORGANIZATION',
  },

  // ---------- Seguridad: identidades y accesos (sin inventario para ADMIN_SEGURIDAD) ----------
  {
    title: 'menu.users',
    path: '/usuarios',
    icon: ManageAccountsIcon,
    allowedRoles: IAM_ROLES,
    group: 'SECURITY',
  },
  {
    title: 'menu.audit',
    path: '/auditoria',
    icon: PolicyIcon,
    allowedRoles: AUDIT_READER_ROLES,
    group: 'SECURITY',
  },

  // ---------- Catálogos / Configuración ----------
  {
    title: 'menu.brands',
    path: '/config/marcas',
    icon: CategoryIcon,
    allowedRoles: ['SUPER_ADMIN', 'JEFE_TI', 'ADMIN_TI'],
    group: 'CATALOG',
  },
  {
    title: 'menu.models',
    path: '/config/modelos',
    icon: ViewListIcon,
    allowedRoles: ['SUPER_ADMIN', 'JEFE_TI', 'ADMIN_TI'],
    group: 'CATALOG',
  },
  {
    title: 'menu.types',
    path: '/config/tipos',
    icon: CategoryIcon,
    allowedRoles: ['SUPER_ADMIN', 'JEFE_TI', 'ADMIN_TI'],
    group: 'CATALOG',
  },
  {
    title: 'menu.locations',
    path: '/config/ubicaciones',
    icon: PlaceIcon,
    allowedRoles: ['SUPER_ADMIN', 'JEFE_TI', 'ADMIN_TI'],
    group: 'CATALOG',
  },
  {
    title: 'menu.directory',
    path: '/config/directorio',
    icon: ContactMailIcon,
    allowedRoles: ['SUPER_ADMIN', 'JEFE_TI', 'ADMIN_TI'],
    group: 'ADMIN',
  },
  {
    title: 'menu.config',
    path: '/config',
    icon: SettingsIcon,
    allowedRoles: ['SUPER_ADMIN'],
    group: 'ADMIN',
  },
];
