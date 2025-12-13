// src/app/pages/inventario/inventario.component.ts
import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  NgZone,
  ChangeDetectorRef,
} from '@angular/core';
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
  styleUrl: './inventario.component.css',
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

  // Ordenamiento
  selectedSort = 'name-asc';
  sortOptions = [
    { value: 'name-asc', label: 'Nombre (A-Z)' },
    { value: 'name-desc', label: 'Nombre (Z-A)' },
    { value: 'serial-asc', label: 'N° Serie (A-Z)' },
    { value: 'serial-desc', label: 'N° Serie (Z-A)' },
    { value: 'codigo-asc', label: 'Código (A-Z)' },
    { value: 'codigo-desc', label: 'Código (Z-A)' },
    { value: 'date-newest', label: 'Más recientes' },
    { value: 'date-oldest', label: 'Más antiguos' },
  ];

  // Scanner QR
  showQRScanner = false;
  scannerError = '';

  // Modal agregar equipo
  showAddModal = false;
  newEquipment: Partial<Equipment> = this.getEmptyEquipment();

  // Lista de equipos
  equipmentList: Equipment[] = [];
  filteredEquipment: Equipment[] = [];

  // Opciones para selectores
  categories = ['Laptop', 'PC', 'Monitor', 'Impresora', 'Tablet', 'Servidor', 'Otro'];
  
  sucursales = [
    'Matriz',
    'Sucursal Norte',
    'Sucursal Shyris',
    'Sucursal Centro',
    'Almacén'
  ];

  areas = [
    'Administración',
    'Sistemas',
    'Recursos Humanos',
    'Contabilidad',
    'Ventas',
    'Operaciones',
    'Laboratorio',
    'Salud Ocupacional'
  ];

  // Modal de estado
  showStatusModal = false;
  selectedEquipment: Equipment | null = null;
  statusOptions = [
    { value: 'disponible', label: 'Disponible' },
    { value: 'asignado', label: 'Asignado' },
    { value: 'mantenimiento', label: 'Mantenimiento' },
  ];

  // NUEVO: Modal de vista (solo lectura)
  showViewModal = false;
  viewedEquipment: Equipment | null = null;

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

  private getEmptyEquipment(): Partial<Equipment> {
    const currentYear = new Date().getFullYear().toString();
    return {
      codigo: '',
      anio: currentYear,
      name: '',
      sucursal: 'Matriz',
      area: 'Administración',
      serialNumber: '',
      marca: '',
      model: '',
      status: 'disponible',
      accesorios: '',
      responsable: '',
      observaciones: '',
      category: 'Laptop',
      purchaseDate: '',
    };
  }

  loadEquipment(): void {
    this.loading = true;

    this.firebaseService
      .getEquipment()
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
        },
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

    // Aplicar búsqueda
    if (this.searchTerm) {
      filtered = filtered.filter(
        (eq) =>
          eq.name.toLowerCase().includes(this.searchTerm) ||
          eq.model.toLowerCase().includes(this.searchTerm) ||
          eq.serialNumber.toLowerCase().includes(this.searchTerm) ||
          eq.codigo.toLowerCase().includes(this.searchTerm) ||
          eq.marca.toLowerCase().includes(this.searchTerm) ||
          eq.responsable?.toLowerCase().includes(this.searchTerm) ||
          eq.area.toLowerCase().includes(this.searchTerm)
      );
    }

    // Aplicar filtro por estado
    if (this.selectedFilter !== 'todos') {
      filtered = filtered.filter((eq) => eq.status === this.selectedFilter);
    }

    // Aplicar ordenamiento
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
      case 'codigo-asc':
        return sorted.sort((a, b) => a.codigo.localeCompare(b.codigo));
      case 'codigo-desc':
        return sorted.sort((a, b) => b.codigo.localeCompare(a.codigo));
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

  // ===== QR/BARCODE SCANNER =====
  async openScanQR(): Promise<void> {
    console.log('📷 Abriendo scanner...');
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

      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        throw new Error('No se encontraron cámaras disponibles');
      }

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await this.html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          if (!this.showAddModal && !this.showViewModal && !this.isScanning) {
            this.isScanning = true;
            this.ngZone.run(() => {
              this.onCodeScanned(decodedText);
            });
          }
        },
        (errorMessage) => {
          // Ignorar errores de búsqueda
        }
      );

      console.log('✅ Scanner iniciado');
    } catch (error: any) {
      console.error('Error al iniciar scanner:', error);
      this.ngZone.run(() => {
        this.scannerError =
          error?.message || 'No se pudo acceder a la cámara.';
        this.showQRScanner = false;
      });
    }
  }

  onCodeScanned(code: string): void {
    console.log('🎯 Código escaneado:', code);

    this.stopQRScanner();

    // Buscar si ya existe un equipo con este código
    const existing = this.equipmentList.find(
      (eq) => eq.codigo === code || eq.qrCode === code || eq.serialNumber === code
    );

    this.closeQRScanner();

    if (existing) {
      // ✅ EQUIPO YA EXISTE: Mostrar modal de SOLO LECTURA
      console.log('📦 Equipo encontrado, mostrando datos...');
      console.log('📝 Datos:', existing);
      
      this.viewedEquipment = existing;
      this.showViewModal = true;
      
    } else {
      // ✅ EQUIPO NUEVO: Abrir formulario para crear
      console.log('🆕 Equipo nuevo, abriendo formulario...');
      this.newEquipment = this.getEmptyEquipment();
      this.newEquipment.codigo = code;
      this.newEquipment.qrCode = code;

      setTimeout(() => {
        this.ngZone.run(() => {
          this.showAddModal = true;
          this.cdr.detectChanges();
          console.log('✅ Modal abierto para nuevo equipo');
        });
      }, 150);
    }
  }

  simulateQRScan(): void {
    const testCode = 'TEST-' + Date.now().toString().slice(-6);
    console.log('🧪 Simulando código:', testCode);

    this.ngZone.run(() => {
      this.onCodeScanned(testCode);
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
      this.html5QrCode
        .stop()
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

  // ===== MODAL AGREGAR/EDITAR EQUIPO =====
  openAddModal(): void {
    this.newEquipment = this.getEmptyEquipment();
    this.showAddModal = true;
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.newEquipment = {};
  }

  async saveEquipment(): Promise<void> {
    if (this.savingEquipment) return;

    // Validar campos obligatorios
    if (
      !this.newEquipment.codigo ||
      !this.newEquipment.name ||
      !this.newEquipment.serialNumber ||
      !this.newEquipment.marca ||
      !this.newEquipment.model
    ) {
      alert('Por favor completa todos los campos obligatorios (*)');
      return;
    }

    // Verificar código duplicado
    const existingCode = this.equipmentList.find(
      (eq) =>
        eq.codigo === this.newEquipment.codigo &&
        eq.id !== this.newEquipment.id
    );

    if (existingCode) {
      alert('Ya existe un equipo con ese código');
      return;
    }

    // Verificar serie duplicada
    const existingSerial = this.equipmentList.find(
      (eq) =>
        eq.serialNumber === this.newEquipment.serialNumber &&
        eq.id !== this.newEquipment.id
    );

    if (existingSerial) {
      alert('Ya existe un equipo con ese número de serie');
      return;
    }

    this.savingEquipment = true;
    try {
      if (this.newEquipment.id) {
        // ACTUALIZAR
        console.log('📝 Actualizando equipo:', this.newEquipment);
        await this.firebaseService.updateEquipment(
          this.newEquipment.id,
          this.newEquipment as Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>
        );
        alert('Equipo actualizado exitosamente');
      } else {
        // CREAR NUEVO
        console.log('💾 Guardando nuevo equipo:', this.newEquipment);
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

  // ===== MODAL DE ESTADO =====
  openStatusChangeModal(equipment: Equipment): void {
    this.selectedEquipment = { ...equipment };
    this.showStatusModal = true;
  }

  closeStatusModal(): void {
    this.showStatusModal = false;
    this.selectedEquipment = null;
  }

  async saveStatusChange(): Promise<void> {
    if (!this.selectedEquipment || this.savingEquipment) return;

    this.savingEquipment = true;
    try {
      await this.firebaseService.updateEquipment(this.selectedEquipment.id, {
        status: this.selectedEquipment.status,
        responsable: this.selectedEquipment.responsable,
      });
      alert('Estado actualizado exitosamente');
      this.closeStatusModal();
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      alert('Error al actualizar el estado');
    } finally {
      this.savingEquipment = false;
    }
  }

  // ===== MODAL DE VISTA (SOLO LECTURA) =====
  closeViewModal(): void {
    this.showViewModal = false;
    this.viewedEquipment = null;
  }

  editFromView(): void {
    if (this.viewedEquipment) {
      this.newEquipment = { ...this.viewedEquipment };
      this.closeViewModal();
      this.showAddModal = true;
    }
  }

  // ===== ACCIONES DE EQUIPO =====
  viewEquipment(equipment: Equipment): void {
    // Abrir modal de vista
    this.viewedEquipment = equipment;
    this.showViewModal = true;
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

  // ===== EXPORTACIÓN =====
  exportToExcel(): void {
    try {
      const escapeHtml = (text: string) => {
        return text.replace(/[&<>"']/g, (m) => {
          const entities: any = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
          };
          return entities[m];
        });
      };

      let html = '<table><thead><tr>';
      html += '<th>CODIGO</th><th>AÑO</th><th>NOMBRE</th><th>SUCURSAL</th><th>AREA</th>';
      html += '<th>N° SERIE</th><th>MARCA</th><th>MODELO</th><th>STATUS</th>';
      html += '<th>ACCESORIOS</th><th>RESPONSABLE</th><th>OBSERVACIONES</th>';
      html += '</tr></thead><tbody>';

      this.filteredEquipment.forEach((eq) => {
        html += '<tr>';
        html += `<td>${escapeHtml(eq.codigo)}</td>`;
        html += `<td>${escapeHtml(eq.anio)}</td>`;
        html += `<td>${escapeHtml(eq.name)}</td>`;
        html += `<td>${escapeHtml(eq.sucursal)}</td>`;
        html += `<td>${escapeHtml(eq.area)}</td>`;
        html += `<td>${escapeHtml(eq.serialNumber)}</td>`;
        html += `<td>${escapeHtml(eq.marca)}</td>`;
        html += `<td>${escapeHtml(eq.model)}</td>`;
        html += `<td>${escapeHtml(eq.status)}</td>`;
        html += `<td>${escapeHtml(eq.accesorios || '-')}</td>`;
        html += `<td>${escapeHtml(eq.responsable || '-')}</td>`;
        html += `<td>${escapeHtml(eq.observaciones || '-')}</td>`;
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
          const entities: any = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
          };
          return entities[m];
        });
      };

      let html = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; font-size: 10px; }
              h1 { color: #333; font-size: 18px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
              th { background-color: #6366f1; color: white; font-size: 9px; }
              td { font-size: 9px; }
            </style>
          </head>
          <body>
            <h1>Inventario de Equipos</h1>
            <p>Fecha: ${new Date().toLocaleDateString()}</p>
            <table>
              <thead>
                <tr>
                  <th>CODIGO</th><th>AÑO</th><th>NOMBRE</th><th>SUCURSAL</th><th>AREA</th>
                  <th>N° SERIE</th><th>MARCA</th><th>MODELO</th><th>STATUS</th>
                  <th>ACCESORIOS</th><th>RESPONSABLE</th><th>OBSERVACIONES</th>
                </tr>
              </thead>
              <tbody>
      `;

      this.filteredEquipment.forEach((eq) => {
        html += `
          <tr>
            <td>${escapeHtml(eq.codigo)}</td>
            <td>${escapeHtml(eq.anio)}</td>
            <td>${escapeHtml(eq.name)}</td>
            <td>${escapeHtml(eq.sucursal)}</td>
            <td>${escapeHtml(eq.area)}</td>
            <td>${escapeHtml(eq.serialNumber)}</td>
            <td>${escapeHtml(eq.marca)}</td>
            <td>${escapeHtml(eq.model)}</td>
            <td>${escapeHtml(eq.status)}</td>
            <td>${escapeHtml(eq.accesorios || '-')}</td>
            <td>${escapeHtml(eq.responsable || '-')}</td>
            <td>${escapeHtml(eq.observaciones || '-')}</td>
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
