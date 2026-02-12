import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [

  // 🔹 Página principal (sin login)
  {
    path: '',
    redirectTo: 'induccion',
    pathMatch: 'full'
  },

  // 🔹 Inducción pública
  {
    path: 'induccion',
    loadComponent: () =>
      import('./pages/induccion/induccion.component')
        .then(m => m.InduccionComponent)
  },

   {
    path: 'quiz',
    loadComponent: () =>
      import('./pages/induccion/quiz/quiz.component')
        .then(m => m.InduccionQuizComponent)
  },

  // 🔹 Login
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component')
        .then(m => m.LoginComponent)
  },

  // 🔒 Área protegida
  {
    path: '',
    loadComponent: () =>
      import('./layout/layout/layout.component')
        .then(m => m.LayoutComponent),
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    children: [

      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component')
            .then(m => m.DashboardComponent)
      },
      {
        path: 'inventario',
        loadComponent: () =>
          import('./pages/inventario/inventario.component')
            .then(m => m.InventarioComponent)
      },
      {
        path: 'codigo',
        loadComponent: () =>
          import('./pages/contabilidad/contabilidad.component')
            .then(m => m.ContabilidadComponent)
      },
      {
        path: 'tareas',
        loadComponent: () =>
          import('./pages/tareas/tareas.component')
            .then(m => m.TareasComponent)
      },
      {
        path: 'Ai',
        loadComponent: () =>
          import('./pages/automatizaciones/automatizaciones.component')
            .then(m => m.AutomatizacionesComponent)
      },
      {
        path: 'difusiones',
        loadComponent: () =>
          import('./pages/difusiones/difusiones.component')
            .then(m => m.DifusionesComponent)
      },
      {
        path: 'contactos',
        loadComponent: () =>
          import('./pages/contactos/contactos.component')
            .then(m => m.BasesContactosComponent)
      },
      {
        path: 'factos',
        loadComponent: () =>
          import('./pages/analytics/analytics.component')
            .then(m => m.AnalyticsComponent)
      }
    ]
  },

  // 🚫 Cualquier ruta inválida
  {
    path: '**',
    redirectTo: 'induccion'
  }
];
