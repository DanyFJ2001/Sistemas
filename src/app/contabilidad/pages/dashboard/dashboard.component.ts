import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { InvoiceService } from '../../services/invoice.service';
import { DashboardStats, Invoice } from '../../models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  
  stats: DashboardStats = {
    approved: 0,
    rejected: 0,
    review: 0,
    pending: 0,
    total: 0,
    totalAmount: 0,
    emailsSent: 0
  };

  recentInvoices: Invoice[] = [];
  isLoading = true;

  constructor(
    private invoiceService: InvoiceService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  // ============== CARGAR DATOS ==============

  loadDashboardData(): void {
    this.isLoading = true;

    // Cargar estadísticas
    this.invoiceService.getStats().subscribe({
      next: (stats) => {
        this.stats = stats;
        console.log('📊 Stats cargadas:', stats);
      },
      error: (error) => {
        console.error('❌ Error cargando stats:', error);
      }
    });

    // Cargar facturas recientes (últimas 10)
    this.invoiceService.getInvoices().subscribe({
      next: (invoices) => {
        this.recentInvoices = invoices.slice(0, 10);
        this.isLoading = false;
        console.log('📋 Facturas cargadas:', invoices.length);
      },
      error: (error) => {
        console.error('❌ Error cargando facturas:', error);
        this.isLoading = false;
      }
    });
  }

  // ============== NAVEGACIÓN ==============

  goToUpload(): void {
    this.router.navigate(['/contabilidad/upload']);
  }

  goToFacturas(): void {
    this.router.navigate(['/contabilidad/facturas']);
  }

  viewInvoiceDetail(id: number): void {
    this.router.navigate(['/contabilidad/detalle', id]);
  }

  // ============== HELPERS ==============

  getStatusClass(status: string): string {
    switch (status) {
      case 'approved': return 'success';
      case 'rejected': return 'danger';
      case 'review': return 'warning';
      case 'pending': return 'info';
      default: return 'info';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'approved': return 'Aprobada';
      case 'rejected': return 'Rechazada';
      case 'review': return 'En Revisión';
      case 'pending': return 'Pendiente';
      default: return 'Desconocido';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'approved': return '✅';
      case 'rejected': return '❌';
      case 'review': return '⚠️';
      case 'pending': return '⏳';
      default: return '📄';
    }
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-EC', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  }

  // ============== ACCIONES ==============

  refresh(): void {
    this.loadDashboardData();
  }

  exportData(): void {
    this.invoiceService.exportToExcel().subscribe({
      next: (blob) => {
        this.invoiceService.downloadFile(blob, `facturas-${Date.now()}.xlsx`);
        console.log('✅ Exportación exitosa');
      },
      error: (error) => {
        console.error('❌ Error exportando:', error);
        alert('Error al exportar los datos');
      }
    });
  }
}