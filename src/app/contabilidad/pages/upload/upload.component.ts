import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { InvoiceService } from '../../services/invoice.service';
import { ValidationResult } from '../../models';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.scss'
})
export class UploadComponent {
  
  selectedFiles: File[] = [];
  isDragging = false;
  isUploading = false;
  uploadProgress = 0;
  results: ValidationResult[] = [];
  showResults = false;

  constructor(
    private invoiceService: InvoiceService,
    private router: Router
  ) {}

  // ============== DRAG & DROP ==============
  
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const files = event.dataTransfer?.files;
    if (files) {
      this.addFiles(Array.from(files));
    }
  }

  // ============== FILE SELECTION ==============
  
  onFileSelected(event: any): void {
    const files = event.target.files;
    if (files) {
      this.addFiles(Array.from(files));
    }
  }

  addFiles(files: File[]): void {
    // Filtrar solo XML y PDF
    const validFiles = files.filter(file => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      return extension === 'xml' || extension === 'pdf';
    });

    // Agregar a la lista
    this.selectedFiles = [...this.selectedFiles, ...validFiles];
  }

  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
  }

  clearAll(): void {
    this.selectedFiles = [];
    this.results = [];
    this.showResults = false;
  }

  // ============== VALIDACIÓN ==============
  
  async validateAll(): Promise<void> {
    if (this.selectedFiles.length === 0) {
      alert('Selecciona al menos un archivo');
      return;
    }

    this.isUploading = true;
    this.uploadProgress = 0;

    try {
      // Simular progreso
      const progressInterval = setInterval(() => {
        if (this.uploadProgress < 90) {
          this.uploadProgress += 10;
        }
      }, 200);

      // Subir y validar
      this.invoiceService.uploadInvoices(this.selectedFiles).subscribe({
        next: (results) => {
          clearInterval(progressInterval);
          this.uploadProgress = 100;
          this.results = results;
          this.showResults = true;
          this.isUploading = false;
          
          console.log('✅ Validación completa:', results);
        },
        error: (error) => {
          clearInterval(progressInterval);
          this.isUploading = false;
          console.error('❌ Error:', error);
          alert('Error al validar las facturas: ' + error.message);
        }
      });

    } catch (error) {
      this.isUploading = false;
      console.error('❌ Error:', error);
    }
  }

  // ============== HELPERS ==============
  
  getFileIcon(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return extension === 'xml' ? '📄' : '📑';
  }

  getFileSize(file: File): string {
    const kb = file.size / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }
    return `${(kb / 1024).toFixed(1)} MB`;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'approved': return 'success';
      case 'rejected': return 'danger';
      case 'review': return 'warning';
      default: return 'info';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'approved': return 'Aprobada';
      case 'rejected': return 'Rechazada';
      case 'review': return 'En Revisión';
      default: return 'Pendiente';
    }
  }

  viewDetails(result: ValidationResult, index: number): void {
    // Guardar resultado en sessionStorage para verlo en detalle
    sessionStorage.setItem('validation-result', JSON.stringify(result));
    sessionStorage.setItem('file-name', this.selectedFiles[index].name);
    this.router.navigate(['/contabilidad/detalle', index]);
  }

  goToDashboard(): void {
    this.router.navigate(['/contabilidad/dashboard']);
  }
}