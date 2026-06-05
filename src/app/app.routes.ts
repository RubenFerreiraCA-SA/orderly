import { Routes } from '@angular/router';
import { authGuard, loginGuard } from './core/guards/auth.guard';
import { AppShellComponent } from './layout/app-shell/app-shell.component';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'brain-dump',
        loadComponent: () =>
          import('./pages/brain-dump/brain-dump.component').then((m) => m.BrainDumpComponent),
      },
      {
        path: 'daily-plan',
        loadComponent: () =>
          import('./pages/daily-plan/daily-plan.component').then((m) => m.DailyPlanComponent),
      },
      {
        path: 'actions',
        loadComponent: () =>
          import('./pages/actions/actions.component').then((m) => m.ActionsComponent),
      },
      {
        path: 'goals',
        loadComponent: () =>
          import('./pages/goals/goals.component').then((m) => m.GoalsComponent),
      },
      {
        path: 'weekly-review',
        loadComponent: () =>
          import('./pages/weekly-review/weekly-review.component').then(
            (m) => m.WeeklyReviewComponent
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./pages/settings/settings.component').then((m) => m.SettingsComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
