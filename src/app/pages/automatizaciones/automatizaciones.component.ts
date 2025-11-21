import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { 
  MedicalProcessorService, 
  CertificadoMedico, 
  ProcessingStatus 
} from './../../services/medical.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-automatizaciones',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './automatizaciones.component.html',
  styleUrl: './automatizaciones.component.css'
})
export class AutomatizacionesComponent implements OnInit, OnDestroy {
  // Estado de archivos
  selectedFiles: File[] = [];
  isDragging = false;
  
  // Estado de procesamiento
  isProcessing = false;
  processingStatuses: ProcessingStatus[] = [];
  results: CertificadoMedico[] = [];
  
  // Preview del PDF seleccionado (ahora es SafeResourceUrl)
  selectedPdfPreview: SafeResourceUrl | null = null;
  selectedPdfName: string | null = null;
  currentScanningArea: string | null = null;
  
  // Estadísticas
  stats = {
    total: 0,
    procesados: 0,
    errores: 0
  };

  private subscriptions = new Subscription();

  constructor(
    private medicalService: MedicalProcessorService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    // Suscribirse a actualizaciones de procesamiento
    this.subscriptions.add(
      this.medicalService.processingStatus$.subscribe(statuses => {
        this.processingStatuses = statuses;
        this.updateScanningAnimation();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /**
   * Manejar drag & drop
   */
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
      this.handleFiles(Array.from(files));
    }
  }

  /**
   * Manejar selección de archivos
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.handleFiles(Array.from(input.files));
    }
  }

  /**
   * Procesar archivos seleccionados
   */
  private handleFiles(files: File[]): void {
    // Filtrar solo PDFs
    const pdfFiles = files.filter(f => f.type === 'application/pdf');
    
    if (pdfFiles.length === 0) {
      alert('Por favor selecciona archivos PDF válidos');
      return;
    }

    this.selectedFiles = pdfFiles;
    this.stats.total = pdfFiles.length;
    
    // Mostrar preview del primer archivo
    if (pdfFiles.length > 0) {
      this.showPdfPreview(pdfFiles[0]);
    }
  }

  /**
   * Mostrar preview del PDF
   */
  async showPdfPreview(file: File): Promise<void> {
    this.selectedPdfName = file.name;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      // Sanitizar la URL para evitar errores de seguridad
      this.selectedPdfPreview = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    };
    reader.readAsDataURL(file);
  }

  /**
   * Iniciar procesamiento
   */
  procesarArchivos(): void {
    if (this.selectedFiles.length === 0) {
      alert('No hay archivos para procesar');
      return;
    }

    this.isProcessing = true;
    this.results = [];
    this.medicalService.clearProcessingStatus();

    this.medicalService.processCertificados(this.selectedFiles).subscribe({
      next: (response) => {
        this.results = response.data;
        this.stats.procesados = response.procesados;
        this.stats.errores = response.errores;
        this.isProcessing = false;
        
        console.log('✅ Procesamiento completado:', response);
      },
      error: (error) => {
        console.error('❌ Error:', error);
        this.isProcessing = false;
        alert('Error al procesar archivos. Verifica que el backend esté funcionando.');
      }
    });
  }

  /**
   * Animación de escaneo en áreas específicas
   */
  private updateScanningAnimation(): void {
    const currentStatus = this.processingStatuses[0];
    
    if (!currentStatus) {
      this.currentScanningArea = null;
      return;
    }

    switch (currentStatus.status) {
      case 'converting':
        this.currentScanningArea = 'header';
        break;
      case 'analyzing':
        if (currentStatus.progress < 70) {
          this.currentScanningArea = 'aptitud';
        } else if (currentStatus.progress < 85) {
          this.currentScanningArea = 'diagnosticos';
        } else {
          this.currentScanningArea = 'examenes';
        }
        break;
      case 'completed':
        this.currentScanningArea = 'complete';
        setTimeout(() => this.currentScanningArea = null, 2000);
        break;
    }
  }

  /**
   * Exportar resultados
   */
  exportarExcel(): void {
    if (this.results.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    this.medicalService.exportToExcel(this.results);
  }

  /**
   * Limpiar todo
   */
  limpiar(): void {
    this.selectedFiles = [];
    this.results = [];
    this.selectedPdfPreview = null;
    this.selectedPdfName = null;
    this.processingStatuses = [];
    this.isProcessing = false;
    this.stats = { total: 0, procesados: 0, errores: 0 };
    this.medicalService.clearProcessingStatus();
  }

  /**
   * Obtener color según aptitud médica
   */
  getAptitudColor(aptitud: string): string {
    if (aptitud.includes('APTO') && !aptitud.includes('NO')) {
      return '#10b981'; // Verde
    } else if (aptitud.includes('NO APTO')) {
      return '#ef4444'; // Rojo
    } else if (aptitud.includes('OBSERVACIÓN') || aptitud.includes('LIMITACIONES')) {
      return '#f59e0b'; // Amarillo
    }
    return '#6b7280'; // Gris
  }

  /**
   * Obtener icono según estado
   */
  getStatusIcon(status: string): string {
    switch (status) {
      case 'queued': return '⏳';
      case 'converting': return '🔄';
      case 'analyzing': return '🤖';
      case 'completed': return '✅';
      case 'error': return '❌';
      default: return '📄';
    }
  }
}