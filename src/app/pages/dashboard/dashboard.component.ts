// src/app/pages/dashboard/dashboard.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { FirebaseService } from '../../services/firebase.service';

interface DashboardStats {
  totalEquipment: number;
  assignedEquipment: number;
  availableEquipment: number;
  maintenanceEquipment: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  loading = true;
  
  // Estadísticas
  stats: DashboardStats = {
    totalEquipment: 0,
    assignedEquipment: 0,
    availableEquipment: 0,
    maintenanceEquipment: 0
  };

  // Actividades recientes (vacío por ahora)
  recentActivities: any[] = [];

  constructor(private firebaseService: FirebaseService) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDashboardData(): void {
    this.loading = true;
    
    // Cargar estadísticas desde Firebase
    this.firebaseService.getStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          this.stats = stats;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error cargando dashboard:', error);
          this.loading = false;
        }
      });
  }
}