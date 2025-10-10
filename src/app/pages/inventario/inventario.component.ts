// src/app/pages/inventario/inventario.component.ts
import { Component, OnInit, OnDestroy, ViewChild, ElementRef, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { FirebaseService, Equipment } from '../../services/firebase.service';
import { Html5Qrcode } from 'html5-qrcode';

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventario.component.html',
  styleUrl: './inventario.component.css'
})
export class InventarioComponent implements OnInit, OnDestroy {
  @ViewChild('qrReader') qrReader!: ElementRef<HTMLDivElement>;
  
  private destroy$ = new Subject<void>();
  private html5QrCode: Html5Qrcode | null = null;
  private isScanning = false;
  private startQRScannerTimeout?: any;
  
  loading = true;
  searchTerm = '';
  selectedFilter = 'todos';
  savingEquipment = false;
  
  // Scanner QR
  showQRScanner = false;
  scannerError = '';
  
  // Modal agregar equipo
  showAddModal = false;
  newEquipment: Partial<Equipment> = {
    name: '',
    model: '',
    serialNumber: '',
    category: 'Laptop',
    status: 'disponible',
    assignedTo: '',
    purchaseDate: ''
  };
  
  // Lista de equipos
  equipmentList: Equipment[] = [];
  filteredEquipment: Equipment[] = [];
  
  // Categorías disponibles
  categories = ['Laptop', 'PC', 'Monitor', 'Impresora', 'Tablet', 'Servidor', 'Otro'];

  constructor(
    private firebaseService: FirebaseService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadEquipment();
  }

  ngOnDestroy(): void {
    if (this.startQRScannerTimeout) {
      clearTimeout(this.startQRScannerTimeout);
    }
    this.destroy$.next();
    this.destroy$.complete();
    this.stopQRScanner();
  }

  loadEquipment(): void {
    this.loading = true;
    
    this.firebaseService.getEquipment()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (equipment) => {
          this.equipmentList = equipment;
          this.filterEquipment();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error cargando inventario:', error);
          this.loading = false;
        }
      });
  }

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value.toLowerCase();
    this.searchTerm = value;
    this.filterEquipment();
  }

  onFilterChange(filter: string): void {
    this.selectedFilter = filter;
    this.filterEquipment();
  }

  filterEquipment(): void {
    let filtered = [...this.equipmentList];

    if (this.searchTerm) {
      filtered = filtered.filter(eq => 
        eq.name.toLowerCase().includes(this.searchTerm) ||
        eq.model.toLowerCase().includes(this.searchTerm) ||
        eq.serialNumber.toLowerCase().includes(this.searchTerm) ||
        eq.category.toLowerCase().includes(this.searchTerm)
      );
    }

    if (this.selectedFilter !== 'todos') {
      filtered = filtered.filter(eq => eq.status === this.selectedFilter);
    }

    this.filteredEquipment = filtered;
  }

  // ===== QR SCANNER =====
  async openScanQR(): Promise<void> {
    console.log('📷 Abriendo scanner QR...');
    this.showQRScanner = true;
    this.scannerError = '';
    this.isScanning = false;
    
    // Esperar a que el DOM se actualice
    this.startQRScannerTimeout = setTimeout(() => {
      this.startQRScanner();
    }, 200);
  }

  private async startQRScanner(): Promise<void> {
    try {
      if (!this.qrReader?.nativeElement) {
        throw new Error('Elemento QR reader no disponible');
      }

      this.html5QrCode = new Html5Qrcode('qr-reader');
      this.isScanning = false;
      
      // Verificar cámaras disponibles
      try {
        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) {
          throw new Error('No se encontraron cámaras disponibles');
        }
      } catch (err) {
        throw new Error('No se pudo acceder a las cámaras. Verifica los permisos.');
      }
      
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      await this.html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          // Solo procesar si NO hay modal abierto
          if (!this.showAddModal && !this.isScanning) {
            this.isScanning = true;
            this.ngZone.run(() => {
              this.onQRCodeScanned(decodedText);
            });
          }
        },
        (errorMessage) => {
          // Ignorar errores de búsqueda de QR
        }
      );

      console.log('✅ Scanner iniciado');
    } catch (error: any) {
      console.error('Error al iniciar scanner:', error);
      this.ngZone.run(() => {
        this.scannerError = error?.message || 'No se pudo acceder a la cámara. Permite el acceso en tu navegador.';
        this.showQRScanner = false;
      });
    }
  }

  onQRCodeScanned(code: string): void {
    console.log('=== onQRCodeScanned INICIO ===');
    console.log('🎯 Código recibido:', code);
    
    // Detener el scanner inmediatamente
    this.stopQRScanner();
    
    // Intentar parsear como JSON
    let parsedData: any = null;
    let serialNumber = code;
    
    try {
      parsedData = JSON.parse(code);
      console.log('✅ QR parseado como JSON:', parsedData);
      serialNumber = parsedData.serialNumber || code;
    } catch (error) {
      console.log('ℹ️ QR no es JSON, usando como número de serie simple');
    }
    
    // Buscar si el equipo ya existe
    const existing = this.firebaseService.findEquipmentBySerial(serialNumber);
    
    if (existing) {
      console.log('⚠️ Equipo ya existe:', existing);
      alert(`Equipo ya registrado:\n${existing.name}\nModelo: ${existing.model}\nSerie: ${existing.serialNumber}`);
      this.closeQRScanner();
      return;
    }
    
    console.log('✅ Equipo nuevo, preparando datos...');
    
    // Cerrar scanner primero
    this.closeQRScanner();
    
    // Preparar datos del nuevo equipo
    if (parsedData && typeof parsedData === 'object') {
      // QR con JSON completo
      console.log('📦 Llenando con datos del JSON...');
      this.newEquipment = {
        name: parsedData.name || '',
        model: parsedData.model || '',
        serialNumber: parsedData.serialNumber || serialNumber,
        qrCode: code,
        category: parsedData.category || 'Laptop',
        status: parsedData.status || 'disponible',
        assignedTo: parsedData.assignedTo || '',
        purchaseDate: parsedData.purchaseDate || ''
      };
      
      console.log('Datos asignados:', {
        name: this.newEquipment.name,
        model: this.newEquipment.model,
        serialNumber: this.newEquipment.serialNumber,
        category: this.newEquipment.category
      });
    } else {
      // QR simple
      console.log('📝 QR simple, solo número de serie');
      this.newEquipment = {
        name: '',
        model: '',
        serialNumber: serialNumber,
        qrCode: code,
        category: 'Laptop',
        status: 'disponible',
        assignedTo: '',
        purchaseDate: ''
      };
    }
    
    // Abrir modal con delay para asegurar que Angular detecte cambios
    setTimeout(() => {
      this.ngZone.run(() => {
        this.showAddModal = true;
        this.cdr.detectChanges();
        console.log('✅ Modal abierto');
        console.log('Valores actuales en newEquipment:', this.newEquipment);
      });
    }, 150);
    
    console.log('=== onQRCodeScanned FIN ===');
  }

  // Método para testing sin cámara
  simulateQRScan(): void {
    const testCode = 'TEST-' + Date.now().toString().slice(-6);
    console.log('🧪 Simulando QR:', testCode);
    
    this.ngZone.run(() => {
      this.onQRCodeScanned(testCode);
    });
  }

  closeQRScanner(): void {
    this.showQRScanner = false;
    this.isScanning = false;
    
    // Detener el scanner con delay
    setTimeout(() => {
      this.stopQRScanner();
    }, 100);
  }

  private stopQRScanner(): void {
    if (this.html5QrCode) {
      this.html5QrCode.stop()
        .then(() => {
          this.html5QrCode?.clear();
          this.html5QrCode = null;
        })
        .catch((err) => {
          console.error('Error deteniendo scanner:', err);
          this.html5QrCode = null;
        })
        .finally(() => {
          this.isScanning = false;
        });
    }
  }

  // ===== MODAL AGREGAR EQUIPO =====
  openAddModal(): void {
    this.newEquipment = {
      name: '',
      model: '',
      serialNumber: '',
      category: 'Laptop',
      status: 'disponible',
      assignedTo: '',
      purchaseDate: ''
    };
    this.showAddModal = true;
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.newEquipment = {};
  }

  async saveEquipment(): Promise<void> {
    if (this.savingEquipment) return;

    if (!this.newEquipment.name || !this.newEquipment.model || !this.newEquipment.serialNumber) {
      alert('Por favor completa todos los campos obligatorios');
      return;
    }

    // Validar categoría
    if (!this.categories.includes(this.newEquipment.category!)) {
      alert('Categoría inválida');
      return;
    }

    // Verificar si la serie ya existe (solo si NO estamos editando)
    const existing = this.firebaseService.findEquipmentBySerial(this.newEquipment.serialNumber!);
    
    // Si existe un equipo con ese número de serie Y no es el mismo que estamos editando
    if (existing && existing.id !== this.newEquipment.id) {
      alert('Ya existe un equipo con ese número de serie');
      return;
    }

    this.savingEquipment = true;
    try {
      if (this.newEquipment.id) {
        // ACTUALIZAR equipo existente
        await this.firebaseService.updateEquipment(
          this.newEquipment.id, 
          this.newEquipment as Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>
        );
        alert('Equipo actualizado exitosamente');
      } else {
        // CREAR nuevo equipo
        await this.firebaseService.addEquipment(
          this.newEquipment as Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>
        );
        alert('Equipo agregado exitosamente');
      }
      this.closeAddModal();
    } catch (error) {
      console.error('Error al guardar equipo:', error);
      alert('Error al guardar el equipo. Intenta de nuevo.');
    } finally {
      this.savingEquipment = false;
    }
  }

  // ===== ACCIONES DE EQUIPO =====
  viewEquipment(equipment: Equipment): void {
    // TODO: Abrir modal con detalles completos
    alert(`Detalles de ${equipment.name}\nModelo: ${equipment.model}\nSerie: ${equipment.serialNumber}`);
  }

  async editEquipment(equipment: Equipment): Promise<void> {
    // TODO: Abrir modal para editar
    this.newEquipment = { ...equipment };
    this.showAddModal = true;
  }

  async deleteEquipment(equipment: Equipment): Promise<void> {
    if (confirm(`¿Estás seguro de eliminar ${equipment.name}?`)) {
      try {
        await this.firebaseService.deleteEquipment(equipment.id);
        alert('Equipo eliminado exitosamente');
      } catch (error) {
        console.error('Error al eliminar:', error);
        alert('Error al eliminar el equipo');
      }
    }
  }

  // ===== EXPORTACIÓN =====
  exportToExcel(): void {
    try {
      const escapeHtml = (text: string) => {
        return text.replace(/[&<>"']/g, (m) => {
          const entities: any = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
          return entities[m];
        });
      };

      let html = '<table><thead><tr>';
      html += '<th>Nombre</th><th>Modelo</th><th>Serie</th><th>Categoría</th><th>Estado</th><th>Asignado a</th>';
      html += '</tr></thead><tbody>';
      
      this.filteredEquipment.forEach(eq => {
        html += '<tr>';
        html += `<td>${escapeHtml(eq.name)}</td>`;
        html += `<td>${escapeHtml(eq.model)}</td>`;
        html += `<td>${escapeHtml(eq.serialNumber)}</td>`;
        html += `<td>${escapeHtml(eq.category)}</td>`;
        html += `<td>${escapeHtml(eq.status)}</td>`;
        html += `<td>${escapeHtml(eq.assignedTo || '-')}</td>`;
        html += '</tr>';
      });
      
      html += '</tbody></table>';
      
      const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventario_${new Date().toISOString().split('T')[0]}.xls`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exportando:', error);
      alert('Error al exportar el archivo');
    }
  }

  exportToPDF(): void {
    try {
      const escapeHtml = (text: string) => {
        return text.replace(/[&<>"']/g, (m) => {
          const entities: any = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
          return entities[m];
        });
      };

      let html = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; }
              h1 { color: #333; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #6366f1; color: white; }
            </style>
          </head>
          <body>
            <h1>Inventario de Equipos</h1>
            <p>Fecha: ${new Date().toLocaleDateString()}</p>
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Modelo</th>
                  <th>Serie</th>
                  <th>Categoría</th>
                  <th>Estado</th>
                  <th>Asignado a</th>
                </tr>
              </thead>
              <tbody>
      `;
      
      this.filteredEquipment.forEach(eq => {
        html += `
          <tr>
            <td>${escapeHtml(eq.name)}</td>
            <td>${escapeHtml(eq.model)}</td>
            <td>${escapeHtml(eq.serialNumber)}</td>
            <td>${escapeHtml(eq.category)}</td>
            <td>${escapeHtml(eq.status)}</td>
            <td>${escapeHtml(eq.assignedTo || '-')}</td>
          </tr>
        `;
      });
      
      html += `
              </tbody>
            </table>
          </body>
        </html>
      `;
      
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 250);
      } else {
        alert('No se pudo abrir la ventana de impresión. Verifica que no esté bloqueada por el navegador.');
      }
    } catch (error) {
      console.error('Error exportando PDF:', error);
      alert('Error al generar el PDF');
    }
  }
}
