import type { ChipColor } from '../types/ui';
import type { UserRole } from '../types/auth';

/** Orden de presentación de los roles (de mayor a menor privilegio). */
export const ALL_ROLES: readonly UserRole[] = ['SUPER_ADMIN', 'ADMIN_SEGURIDAD', 'ADMIN_TI', 'TECNICO', 'AUDITOR', 'CONSULTA'];

/** Roles que administran identidades y accesos. */
export const IAM_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN_SEGURIDAD'];

/** Roles que ven el inventario (el administrador de seguridad no lo ve). */
export const INVENTORY_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN_TI', 'TECNICO', 'AUDITOR', 'CONSULTA'];

/** Operación diaria (altas, asignaciones, mantenimiento). Espejo de `require_operativo`. */
export const OPERATOR_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN_TI', 'TECNICO'];

/** Administración del inventario (catálogos, compras, personas, bajas). Espejo de `require_admin`. */
export const INVENTORY_ADMIN_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN_TI'];

/** Lectura del detalle del inventario: operadores y el auditor (solo lectura). */
export const INVENTORY_READER_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN_TI', 'TECNICO', 'AUDITOR'];

/** Lectura de páginas administrativas del inventario (compras, personas): admins y auditor. */
export const ADMIN_READER_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN_TI', 'AUDITOR'];

/** Bitácora de auditoría (el auditor la ve filtrada por su alcance). */
export const AUDIT_READER_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN_SEGURIDAD', 'AUDITOR'];

/** Roles con alcance global implícito; al resto se le asignan sedes. */
export const ALWAYS_GLOBAL_ROLES: readonly UserRole[] = ['SUPER_ADMIN', 'ADMIN_SEGURIDAD'];

/** Solo un SUPER_ADMIN otorga o administra estos roles. */
const PROTECTED_ROLES: readonly UserRole[] = ['SUPER_ADMIN', 'ADMIN_SEGURIDAD'];

/** Espejo de `app/core/roles.py::can_manage` (el backend también lo aplica). */
export function canManageRole(requester: UserRole | undefined, target: UserRole): boolean {
  if (requester === 'SUPER_ADMIN') return true;
  if (requester === 'ADMIN_SEGURIDAD') return !PROTECTED_ROLES.includes(target);
  return false;
}

/** Roles que `requester` puede asignar a una cuenta. */
export function grantableRoles(requester: UserRole | undefined): UserRole[] {
  return ALL_ROLES.filter((role) => canManageRole(requester, role));
}

/** Permisos de escritura del rol (la UI oculta lo que el backend rechazaría). */
export function permissionsFor(role: UserRole | undefined) {
  return {
    canOperate: !!role && OPERATOR_ROLES.includes(role),
    canAdminInventory: !!role && INVENTORY_ADMIN_ROLES.includes(role),
    canExport: !!role && ['SUPER_ADMIN', 'ADMIN_TI', 'AUDITOR'].includes(role),
    readOnly: role === 'AUDITOR' || role === 'CONSULTA',
  };
}

export function roleChipColor(role: UserRole): ChipColor {
  if (role === 'SUPER_ADMIN') return 'warning';
  if (role === 'ADMIN_SEGURIDAD') return 'secondary';
  if (role === 'ADMIN_TI') return 'primary';
  if (role === 'AUDITOR') return 'info';
  return 'default';
}
