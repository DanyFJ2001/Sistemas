// src/app/layout/layout.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';


@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent implements OnInit {
  darkMode = true;
  userEmail = '';
  
  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadThemePreference();
    this.loadUserInfo();
  }

  loadUserInfo(): void {
    this.userEmail = this.authService.getUserEmail() || 'Usuario';
  }

  toggleTheme(): void {
    this.darkMode = !this.darkMode;
    this.saveThemePreference();
    this.applyTheme();
  }

  loadThemePreference(): void {
    const savedTheme = localStorage.getItem('theme');
    this.darkMode = savedTheme !== 'light';
    this.applyTheme();
  }

  saveThemePreference(): void {
    localStorage.setItem('theme', this.darkMode ? 'dark' : 'light');
  }

  applyTheme(): void {
    if (this.darkMode) {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
    } else {
      document.body.classList.add('light-mode');
      document.body.classList.remove('dark-mode');
    }
  }

  async logout(): Promise<void> {
    if (confirm('¿Estás seguro que deseas cerrar sesión?')) {
      try {
        await this.authService.logout();
        this.router.navigate(['/login']);
      } catch (error) {
        console.error('Error al cerrar sesión:', error);
        alert('Error al cerrar sesión');
      }
    }
  }
}