import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { InvoiceService } from '../../services/invoice.service';
import { Invoice, InvoiceStatus } from '../../models';

@Component({
  selector: 'app-facturas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './facturas.component.html',
  styleUrl: './facturas.component.scss'
})
export class FacturasComponent implements OnInit {
  
  allInvoices: Invoice[] = [];
  filteredInvoices: Invoice[] = [];
  isLoading = true;
  
  // Filtros
  searchQuery = '';
  statusFilter: string = 'all';
  
  // Paginación
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;
  
  // Estados disponibles para filtrar
  statuses = [
    { value: 'all', label: 'Todos', icon: '📋' },
    { value: 'approved', label: 'Aprobadas', icon: '✅' },
    { value: 'rejected', label: 'Rechazadas', icon: '❌' },
    { value: 'review', label: 'En Revisión', icon: '⚠️' },
    { value: 'pending', label: 'Pendientes', icon: '⏳' }
  ];

  constructor(
    private invoiceService: InvoiceService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadInvoices();
  }

  // ============== CARGAR DATOS ==============

  loadInvoices(): void {
    this.isLoading = true;
    
    this.invoiceService.getInvoices().subscribe({
      next: (invoices) => {
        this.allInvoices = invoices;
        this.applyFilters();
        this.isLoading = false;
        console.log('✅ Facturas cargadas:', invoices.length);
      },
      error: (error) => {
        console.error('❌ Error cargando facturas:', error);
        this.isLoading = false;
        alert('Error al cargar las facturas');
      }
    });
  }

  // ============== FILTROS Y BÚSQUEDA ==============

  applyFilters(): void {
    let filtered = [...this.allInvoices];
    
    // Filtrar por estado
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(inv => inv.status === this.statusFilter);
    }
    
    // Filtrar por búsqueda
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(inv =>
        inv.fileName.toLowerCase().includes(query) ||
        inv.supplier.toLowerCase().includes(query) ||
        inv.ruc.includes(query) ||
        inv.id.toString().includes(query)
      );
    }
    
    this.filteredInvoices = filtered;
    this.totalPages = Math.ceil(filtered.length / this.itemsPerPage);
    this.currentPage = 1; // Reset a la primera página
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onStatusFilterChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.applyFilters();
  }

  // ============== PAGINACIÓN ==============

  get paginatedInvoices(): Invoice[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredInvoices.slice(start, end);
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  // ============== ACCIONES ==============

  viewDetail(id: number): void {
    this.router.navigate(['/contabilidad/detalle', id]);
  }

  deleteInvoice(invoice: Invoice): void {
    const confirmed = confirm(`¿Estás seguro de eliminar la factura ${invoice.fileName}?`);
    
    if (confirmed) {
      this.invoiceService.deleteInvoice(invoice.id).subscribe({
        next: () => {
          console.log('✅ Factura eliminada');
          this.loadInvoices();
          alert('Factura eliminada correctamente');
        },
        error: (error) => {
          console.error('❌ Error eliminando factura:', error);
          alert('Error al eliminar la factura');
        }
      });
    }
  }

  refresh(): void {
    this.loadInvoices();
  }

  goToUpload(): void {
    this.router.navigate(['/contabilidad/upload']);
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

  getStatusCount(status: string): number {
    if (status === 'all') return this.allInvoices.length;
    return this.allInvoices.filter(inv => inv.status === status).length;
  }
}