import { Component, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements AfterViewInit {
  email = '';
  password = '';
  loading = false;
  errorMessage = '';
  showPassword = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }

  // 🎥 DEBUG: Verificar si el video carga
  ngAfterViewInit() {
    const video = document.querySelector('.background-video') as HTMLVideoElement;
    
    if (video) {
      console.log('✅ Video element encontrado');
      console.log('📹 Video src:', video.src);
      console.log('🎬 Video readyState:', video.readyState);
      
      video.addEventListener('loadeddata', () => {
        console.log('✅ Video cargado correctamente');
        video.play().catch(err => {
          console.error('❌ Error al reproducir:', err);
        });
      });
      
      video.addEventListener('error', (e) => {
        console.error('❌ Error al cargar video:', e);
        console.error('Video error code:', video.error?.code);
        console.error('Video error message:', video.error?.message);
      });
    } else {
      console.error('❌ Video element NO encontrado en el DOM');
    }
  }

  async onLogin(): Promise<void> {
    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor completa todos los campos';
      return;
    }

    if (!this.isValidEmail(this.email)) {
      this.errorMessage = 'Por favor ingresa un correo válido';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      await this.authService.login(this.email, this.password);
      console.log('✅ Login exitoso');
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      console.error('❌ Error en login:', error);
      this.errorMessage = error.message || 'Error al iniciar sesión';
      this.loading = false;
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  onInputChange(): void {
    if (this.errorMessage) {
      this.errorMessage = '';
    }
  }
}

//SECCION DE ROLES
// src/app/models/user.model.ts

export type UserRole = 'admin' | 'jefe_inventario' | 'observador';

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

export const ROLE_LABELS: Record<UserRole, string> = {
  'admin': 'Administrador',
  'jefe_inventario': 'Jefe de Inventario',
  'observador': 'Observador'
};

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  'admin': ['read', 'write', 'delete', 'manage_users', 'reports', 'settings'],
  'jefe_inventario': ['read', 'write', 'delete', 'reports'],
  'observador': ['read']
};