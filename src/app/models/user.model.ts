// Los 3 tipos de roles disponibles en tu sistema
export type UserRole = 'admin' | 'jefe_inventario' | 'observador';

// La estructura de datos de cada usuario
export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  sucursal?: string;
  createdAt: string;
  updatedAt?: string;
  active: boolean;
}

// Nombres para mostrar en la interfaz
export const ROLE_LABELS: Record<UserRole, string> = {
  'admin': 'Administrador',
  'jefe_inventario': 'Jefe de Inventario',
  'observador': 'Observador'
};

// Permisos de cada rol
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  'admin': ['read', 'write', 'delete', 'manage_users', 'reports', 'settings'],
  'jefe_inventario': ['read', 'write', 'delete', 'reports'],
  'observador': ['read']
};