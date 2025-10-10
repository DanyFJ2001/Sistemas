// src/app/layout/layout.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent implements OnInit {
  darkMode = true;
  
  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loadThemePreference();
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
}