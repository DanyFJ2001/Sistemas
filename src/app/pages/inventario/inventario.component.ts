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
  private googleSheetUrl = 'https://script.google.com/macros/s/AKfycbxvae6Mq9jbMSqJ8qur4sfBesiuBtZjJ7c9RdxV7EUEowVQ86Wly0LqCdcB6rHCHkvM/exec';
  private destroy$ = new Subject<void>();
  private html5QrCode: Html5Qrcode | null = null;
  private isScanning = false;
  private startQRScannerTimeout?: any;
  
  // URL de Google Sheets API

  loading = true;
  searchTerm = '';
  selectedFilter = 'todos';
  savingEquipment = false;
  syncingSheet = false;
  
  // Ordenamiento
  selectedSort = 'name-asc';
  sortOptions = [
    { value: 'name-asc', label: 'Nombre (A-Z)' },
    { value: 'name-desc', label: 'Nombre (Z-A)' },
    { value: 'serial-asc', label: 'N° Serie (A-Z)' },
    { value: 'serial-desc', label: 'N° Serie (Z-A)' },
    { value: 'category-asc', label: 'Categoría (A-Z)' },
    { value: 'category-desc', label: 'Categoría (Z-A)' },
    { value: 'date-newest', label: 'Más recientes' },
    { value: 'date-oldest', label: 'Más antiguos' }
  ];
  
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

  onSortChange(sortValue: string): void {
    this.selectedSort = sortValue;
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

    filtered = this.sortEquipment(filtered);

    this.filteredEquipment = filtered;
  }

  private sortEquipment(equipment: Equipment[]): Equipment[] {
    const sorted = [...equipment];

    switch (this.selectedSort) {
      case 'name-asc':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'name-desc':
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case 'serial-asc':
        return sorted.sort((a, b) => a.serialNumber.localeCompare(b.serialNumber));
      case 'serial-desc':
        return sorted.sort((a, b) => b.serialNumber.localeCompare(a.serialNumber));
      case 'category-asc':
        return sorted.sort((a, b) => a.category.localeCompare(b.category));
      case 'category-desc':
        return sorted.sort((a, b) => b.category.localeCompare(a.category));
      case 'date-newest':
        return sorted.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
      case 'date-oldest':
        return sorted.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });
      default:
        return sorted;
    }
  }

  // ===== QR SCANNER =====
  async openScanQR(): Promise<void> {
    console.log('📷 Abriendo scanner QR...');
    this.showQRScanner = true;
    this.scannerError = '';
    this.isScanning = false;
    
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
          if (!this.showAddModal && !this.isScanning) {
            this.isScanning = true;
            this.ngZone.run(() => {
              this.onQRCodeScanned(decodedText);
            });
          }
        },
        (errorMessage) => {}
      );

      console.log('✅ Scanner iniciado');
    } catch (error: any) {
      console.error('Error al iniciar scanner:', error);
      this.ngZone.run(() => {
        this.scannerError = error?.message || 'No se pudo acceder a la cámara.';
        this.showQRScanner = false;
      });
    }
  }

  onQRCodeScanned(code: string): void {
    console.log('🎯 Código recibido:', code);
    
    this.stopQRScanner();
    
    let parsedData: any = null;
    let serialNumber = code;
    
    try {
      parsedData = JSON.parse(code);
      serialNumber = parsedData.serialNumber || code;
    } catch (error) {
      console.log('ℹ️ QR no es JSON, usando como número de serie simple');
    }
    
    const existing = this.firebaseService.findEquipmentBySerial(serialNumber);
    
    if (existing) {
      alert(`Equipo ya registrado:\n${existing.name}\nModelo: ${existing.model}\nSerie: ${existing.serialNumber}`);
      this.closeQRScanner();
      return;
    }
    
    this.closeQRScanner();
    
    if (parsedData && typeof parsedData === 'object') {
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
    } else {
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
    
    setTimeout(() => {
      this.ngZone.run(() => {
        this.showAddModal = true;
        this.cdr.detectChanges();
      });
    }, 150);
  }

  simulateQRScan(): void {
    const testCode = 'TEST-' + Date.now().toString().slice(-6);
    this.ngZone.run(() => {
      this.onQRCodeScanned(testCode);
    });
  }

  closeQRScanner(): void {
    this.showQRScanner = false;
    this.isScanning = false;
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

    if (!this.categories.includes(this.newEquipment.category!)) {
      alert('Categoría inválida');
      return;
    }

    const existing = this.firebaseService.findEquipmentBySerial(this.newEquipment.serialNumber!);
    
    if (existing && existing.id !== this.newEquipment.id) {
      alert('Ya existe un equipo con ese número de serie');
      return;
    }

    this.savingEquipment = true;
    try {
      if (this.newEquipment.id) {
        await this.firebaseService.updateEquipment(
          this.newEquipment.id, 
          this.newEquipment as Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>
        );
        alert('Equipo actualizado exitosamente');
      } else {
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
    alert(`Detalles de ${equipment.name}\nModelo: ${equipment.model}\nSerie: ${equipment.serialNumber}`);
  }

  async editEquipment(equipment: Equipment): Promise<void> {
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

  // ===== SYNC CON GOOGLE SHEETS =====
  
  // Enviar UN registro a Google Sheets
  async syncToGoogleSheet(equipment?: Equipment): Promise<void> {
    const eq = equipment || this.filteredEquipment[0];
    
    if (!eq) {
      alert('No hay equipo para enviar');
      return;
    }

    this.syncingSheet = true;

    try {
      const params = new URLSearchParams({
        action: 'insert',
        codigo: eq.id || '',
        ano: new Date().getFullYear().toString(),
        cod_definitivo: eq.serialNumber || '',
        nombre_equipo: eq.name || '',
        sucursal: '',
        area_ubicacion: '',
        serie_lote: eq.serialNumber || '',
        marca: '',
        modelo: eq.model || '',
        status: eq.status || '',
        accesorios: '',
        responsable: eq.assignedTo || '',
        fecha_elaboracion: new Date().toISOString().split('T')[0],
        fecha_mantenimiento: '',
        grupo: eq.category || '',
        sub_grupo: '',
        nombre_general: eq.name || '',
        ciudad: '',
        fecha_compra: eq.purchaseDate || '',
        nro_factura: '',
        costo: '',
        proveedor: '',
        empresa: 'SEGURILAB',
        analisis: '',
        periodo_contable: new Date().getFullYear().toString()
      });

      const response = await fetch(`${this.googleSheetUrl}?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        alert(`✅ Equipo "${eq.name}" enviado a Google Sheets`);
      } else {
        alert('❌ Error: ' + (result.error || 'No se pudo enviar'));
      }
    } catch (error) {
      console.error('Error enviando a Google Sheets:', error);
      alert('❌ Error de conexión con Google Sheets');
    } finally {
      this.syncingSheet = false;
    }
  }

  // Enviar TODOS los registros a Google Sheets
  async syncAllToGoogleSheet(): Promise<void> {
    if (this.filteredEquipment.length === 0) {
      alert('No hay equipos para enviar');
      return;
    }

    const confirmacion = confirm(`¿Enviar ${this.filteredEquipment.length} equipos a Google Sheets?`);
    if (!confirmacion) return;

    this.syncingSheet = true;
    let enviados = 0;
    let errores = 0;

    for (const eq of this.filteredEquipment) {
      try {
        const params = new URLSearchParams({
          action: 'insert',
          codigo: eq.id || '',
          ano: new Date().getFullYear().toString(),
          cod_definitivo: eq.serialNumber || '',
          nombre_equipo: eq.name || '',
          sucursal: '',
          area_ubicacion: '',
          serie_lote: eq.serialNumber || '',
          marca: '',
          modelo: eq.model || '',
          status: eq.status || '',
          accesorios: '',
          responsable: eq.assignedTo || '',
          fecha_elaboracion: new Date().toISOString().split('T')[0],
          fecha_mantenimiento: '',
          grupo: eq.category || '',
          sub_grupo: '',
          nombre_general: eq.name || '',
          ciudad: '',
          fecha_compra: eq.purchaseDate || '',
          nro_factura: '',
          costo: '',
          proveedor: '',
          empresa: 'SEGURILAB',
          analisis: '',
          periodo_contable: new Date().getFullYear().toString()
        });

        const response = await fetch(`${this.googleSheetUrl}?${params.toString()}`);
        const result = await response.json();
        
        if (result.success) {
          enviados++;
        } else {
          errores++;
        }
        
        // Pausa para no saturar
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        errores++;
      }
    }

    this.syncingSheet = false;
    alert(`✅ Enviados: ${enviados}\n❌ Errores: ${errores}`);
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
        alert('No se pudo abrir la ventana de impresión.');
      }
    } catch (error) {
      console.error('Error exportando PDF:', error);
      alert('Error al generar el PDF');
    }
  }
}