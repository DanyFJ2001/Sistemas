import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { 
  Invoice, 
  ValidationResult, 
  DashboardStats,
  InvoiceXMLData 
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  
  // URL del backend (cambiar según tu configuración)
  private apiUrl = 'http://localhost:4000/api';
  
  // Estado reactivo para actualizar el dashboard en tiempo real
  private invoicesSubject = new BehaviorSubject<Invoice[]>([]);
  public invoices$ = this.invoicesSubject.asObservable();
  
  constructor(private http: HttpClient) { }

  // ============== SUBIR Y VALIDAR ==============
  
  /**
   * Subir facturas XML/PDF para validación
   */
  uploadInvoices(files: File[]): Observable<ValidationResult[]> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file, file.name);
    });
    
    return this.http.post<ValidationResult[]>(`${this.apiUrl}/upload`, formData);
  }

  /**
   * Validar una factura específica con IA
   */
  validateInvoice(invoiceData: InvoiceXMLData): Observable<ValidationResult> {
    return this.http.post<ValidationResult>(`${this.apiUrl}/validate`, invoiceData);
  }

  // ============== CRUD FACTURAS ==============
  
  /**
   * Obtener todas las facturas
   */
  getInvoices(): Observable<Invoice[]> {
    return this.http.get<Invoice[]>(`${this.apiUrl}/invoices`).pipe(
      tap(invoices => this.invoicesSubject.next(invoices))
    );
  }

  /**
   * Obtener factura por ID
   */
  getInvoiceById(id: number): Observable<Invoice> {
    return this.http.get<Invoice>(`${this.apiUrl}/invoices/${id}`);
  }

  /**
   * Actualizar estado de factura
   */
  updateInvoiceStatus(id: number, status: string): Observable<Invoice> {
    return this.http.patch<Invoice>(`${this.apiUrl}/invoices/${id}/status`, { status });
  }

  /**
   * Eliminar factura
   */
  deleteInvoice(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/invoices/${id}`);
  }

  // ============== ESTADÍSTICAS ==============
  
  /**
   * Obtener estadísticas del dashboard
   */
  getStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.apiUrl}/stats`);
  }

  // ============== FILTROS Y BÚSQUEDA ==============
  
  /**
   * Filtrar facturas por estado
   */
  filterByStatus(status: string): Observable<Invoice[]> {
    return this.http.get<Invoice[]>(`${this.apiUrl}/invoices?status=${status}`);
  }

  /**
   * Buscar facturas
   */
  searchInvoices(query: string): Observable<Invoice[]> {
    return this.http.get<Invoice[]>(`${this.apiUrl}/invoices/search?q=${query}`);
  }

  // ============== REENVIAR EMAIL ==============
  
  /**
   * Reenviar email de error al proveedor
   */
  resendEmail(invoiceId: number): Observable<{ success: boolean, message: string }> {
    return this.http.post<{ success: boolean, message: string }>(
      `${this.apiUrl}/invoices/${invoiceId}/resend-email`, 
      {}
    );
  }

  // ============== EXPORTAR ==============
  
  /**
   * Exportar reporte en Excel
   */
  exportToExcel(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export/excel`, {
      responseType: 'blob'
    });
  }

  /**
   * Exportar reporte en PDF
   */
  exportToPDF(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export/pdf`, {
      responseType: 'blob'
    });
  }

  // ============== HELPERS ==============
  
  /**
   * Descargar archivo (helper para exportaciones)
   */
  downloadFile(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }
}