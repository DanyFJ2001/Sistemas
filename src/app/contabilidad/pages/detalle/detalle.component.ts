import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { InvoiceService } from '../../services/invoice.service';
import { Invoice, ValidationResult } from '../../models';

@Component({
  selector: 'app-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './detalle.component.html',
  styleUrl: './detalle.component.scss'
})
export class DetalleComponent implements OnInit {
  
  invoice: Invoice | null = null;
  validationResult: ValidationResult | null = null;
  isLoading = true;
  fileName = '';
  isSendingEmail = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private invoiceService: InvoiceService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    
    if (id) {
      this.loadInvoiceDetail(+id);
    } else {
      // Si viene desde upload sin guardar, cargar de sessionStorage
      this.loadTemporaryResult();
    }
  }

  // ============== GETTERS SEGUROS ==============

  get hasValidationErrors(): boolean {
    return (this.validationResult?.errors?.length ?? 0) > 0;
  }

  get hasValidationWarnings(): boolean {
    return (this.validationResult?.warnings?.length ?? 0) > 0;
  }

  get validationErrors() {
    return this.validationResult?.errors ?? [];
  }

  get validationWarnings() {
    return this.validationResult?.warnings ?? [];
  }

  get hasConceptos(): boolean {
    return (this.invoice?.xmlData?.conceptos?.length ?? 0) > 0;
  }

  get conceptos() {
    return this.invoice?.xmlData?.conceptos ?? [];
  }

  get hasValidaciones(): boolean {
    return this.validationResult?.validaciones != null;
  }

  get validaciones() {
    return this.validationResult?.validaciones ?? {
      rucValido: false,
      claveAccesoValida: false,
      calculosCorrectos: false,
      fechaValida: false,
      ambienteValido: false
    };
  }

  // ============== CARGAR DATOS ==============

  loadInvoiceDetail(id: number): void {
    this.isLoading = true;
    
    this.invoiceService.getInvoiceById(id).subscribe({
      next: (invoice) => {
        this.invoice = invoice;
        this.validationResult = invoice.validationResult || null;
        this.fileName = invoice.fileName;
        this.isLoading = false;
        console.log('✅ Factura cargada:', invoice);
      },
      error: (error) => {
        console.error('❌ Error cargando factura:', error);
        this.isLoading = false;
        alert('Error al cargar la factura');
        this.goBack();
      }
    });
  }

  loadTemporaryResult(): void {
    const resultStr = sessionStorage.getItem('validation-result');
    const fileNameStr = sessionStorage.getItem('file-name');
    
    if (resultStr) {
      this.validationResult = JSON.parse(resultStr);
      this.fileName = fileNameStr || 'factura.xml';
      this.isLoading = false;
      console.log('✅ Resultado temporal cargado');
    } else {
      console.warn('⚠️ No hay resultado temporal');
      this.goBack();
    }
  }

  // ============== ACCIONES ==============

  resendEmail(): void {
    if (!this.invoice) {
      alert('No se puede reenviar el email sin una factura guardada');
      return;
    }

    this.isSendingEmail = true;
    
    this.invoiceService.resendEmail(this.invoice.id).subscribe({
      next: (response) => {
        this.isSendingEmail = false;
        alert('✅ Email reenviado correctamente');
        console.log('✅ Email enviado:', response);
      },
      error: (error) => {
        this.isSendingEmail = false;
        console.error('❌ Error enviando email:', error);
        alert('Error al enviar el email');
      }
    });
  }

  downloadXML(): void {
    if (!this.invoice?.xmlData) {
      alert('No hay datos XML disponibles para descargar');
      return;
    }

    const xmlContent = this.generateXMLContent(this.invoice.xmlData);
    const blob = new Blob([xmlContent], { type: 'text/xml' });
    this.invoiceService.downloadFile(blob, this.fileName);
  }

  generateXMLContent(data: any): string {
    // Generar contenido XML básico con validación
    const ruc = data.rucEmisor || 'N/A';
    const razonSocial = this.escapeXML(data.razonSocialEmisor || 'N/A');
    const total = data.valorTotal || 0;
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<factura>
  <ruc>${ruc}</ruc>
  <razonSocial>${razonSocial}</razonSocial>
  <total>${total}</total>
</factura>`;
  }

  escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  copyDetails(): void {
    const details = this.generateDetailsText();
    
    navigator.clipboard.writeText(details).then(() => {
      alert('✅ Detalles copiados al portapapeles');
    }).catch(err => {
      console.error('❌ Error copiando:', err);
      alert('Error al copiar los detalles');
    });
  }

  generateDetailsText(): string {
    if (!this.validationResult) return '';
    
    let text = `RESULTADO DE VALIDACIÓN\n`;
    text += `========================\n\n`;
    text += `Archivo: ${this.fileName}\n`;
    text += `Estado: ${this.getStatusText(this.validationResult.status)}\n`;
    text += `Confianza: ${(this.validationResult.confidence * 100).toFixed(0)}%\n\n`;
    
    if (this.hasValidationErrors) {
      text += `ERRORES:\n`;
      this.validationErrors.forEach((error, i) => {
        text += `${i + 1}. ${error.field}: ${error.message}\n`;
      });
      text += `\n`;
    }
    
    if (this.hasValidationWarnings) {
      text += `ADVERTENCIAS:\n`;
      this.validationWarnings.forEach((warning, i) => {
        text += `${i + 1}. ${warning.field}: ${warning.message}\n`;
      });
      text += `\n`;
    }
    
    text += `ANÁLISIS IA:\n${this.validationResult.aiAnalysis || 'Sin análisis'}\n`;
    
    return text;
  }

  // ============== NAVEGACIÓN ==============

  goBack(): void {
    this.router.navigate(['/contabilidad/dashboard']);
  }

  // ============== HELPERS ==============

  getStatusClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'approved': 'success',
      'rejected': 'danger',
      'review': 'warning'
    };
    return statusMap[status] || 'info';
  }

  getStatusText(status: string): string {
    const statusTextMap: { [key: string]: string } = {
      'approved': 'Aprobada',
      'rejected': 'Rechazada',
      'review': 'En Revisión'
    };
    return statusTextMap[status] || 'Pendiente';
  }

  getStatusIcon(status: string): string {
    const iconMap: { [key: string]: string } = {
      'approved': '✅',
      'rejected': '❌',
      'review': '⚠️'
    };
    return iconMap[status] || '⏳';
  }

  formatCurrency(amount: number | undefined | null): string {
    if (amount === undefined || amount === null) return '$0.00';
    
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  formatDate(dateString: string | undefined | null): string {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Fecha inválida';
      
      return new Intl.DateTimeFormat('es-EC', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (error) {
      console.error('Error formateando fecha:', error);
      return 'Error en fecha';
    }
  }

  // ============== HELPERS PARA VALORES SEGUROS ==============

  getSubtotal0(): number {
    return this.invoice?.xmlData?.subtotal0 ?? 0;
  }

  getSubtotal5(): number {
    return this.invoice?.xmlData?.subtotal5 ?? 0;
  }

  getSubtotal15(): number {
    return this.invoice?.xmlData?.subtotal15 ?? 0;
  }

  getDescuento(): number {
    return this.invoice?.xmlData?.descuento ?? 0;
  }

  hasSubtotal0(): boolean {
    return (this.invoice?.xmlData?.subtotal0 ?? 0) > 0;
  }

  hasSubtotal5(): boolean {
    return (this.invoice?.xmlData?.subtotal5 ?? 0) > 0;
  }

  hasSubtotal15(): boolean {
    return (this.invoice?.xmlData?.subtotal15 ?? 0) > 0;
  }

  hasDescuento(): boolean {
    return (this.invoice?.xmlData?.descuento ?? 0) > 0;
  }
}