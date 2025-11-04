// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    loadComponent: () => import('./layout/layout/layout.component').then(m => m.LayoutComponent),
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'inventario',
        loadComponent: () => import('./pages/inventario/inventario.component').then(m => m.InventarioComponent)
      },
      {
        path: 'tareas',
        loadComponent: () => import('./pages/tareas/tareas.component').then(m => m.TareasComponent)
      },
      // ⭐ NUEVA RUTA DE CONTABILIDAD
      {
        path: 'contabilidad',
        children: [
          {
            path: '',
            redirectTo: 'dashboard',
            pathMatch: 'full'
          },
          {
            path: 'dashboard',
            loadComponent: () => import('./contabilidad/pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
          },
          {
            path: 'upload',
            loadComponent: () => import('./contabilidad/pages/upload/upload.component').then(m => m.UploadComponent)
          },
          {
            path: 'facturas',
            loadComponent: () => import('./contabilidad/pages/facturas/facturas.component').then(m => m.FacturasComponent)
          },
          {
            path: 'detalle/:id',
            loadComponent: () => import('./contabilidad/pages/detalle/detalle.component').then(m => m.DetalleComponent)
          }
        ]
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];