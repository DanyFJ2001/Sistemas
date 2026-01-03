// src/app/guards/auth.guard.ts
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async canActivate(): Promise<boolean> {
    // Esperar a que Firebase termine de inicializar
    const isAuthenticated = await this.authService.waitForAuthInit();
    
    if (isAuthenticated) {
      return true;
    } else {
      console.log('🚫 No autenticado - redirigiendo a login');
      this.router.navigate(['/login']);
      return false;
    }
  }

  async canActivateChild(): Promise<boolean> {
    return this.canActivate();
  }
}