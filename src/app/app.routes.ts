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
      {
        path: 'Ai',
        loadComponent: () => import('./pages/automatizaciones/automatizaciones.component').then(m => m.AutomatizacionesComponent)
      },{
        path: 'difusiones',
        loadComponent: () => import('./pages/difusiones/difusiones.component').then(m => m.DifusionesComponent)
      },
      
     
    ]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];