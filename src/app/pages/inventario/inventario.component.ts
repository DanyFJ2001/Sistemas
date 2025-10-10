// src/app/pages/inventario/inventario.component.ts
import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
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
  
  loading = true;
  searchTerm = '';
  selectedFilter = 'todos';
  
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

  constructor(private firebaseService: FirebaseService) {}

  ngOnInit(): void {
    this.loadEquipment();
  }

  ngOnDestroy(): void {
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
    this.showQRScanner = true;
    this.scannerError = '';
    
    // Esperar a que el DOM se actualice
    setTimeout(() => {
      this.startQRScanner();
    }, 100);
  }

  private async startQRScanner(): Promise<void> {
    try {
      // Crear instancia del scanner
      this.html5QrCode = new Html5Qrcode('qr-reader');
      
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      // Iniciar el scanner
      await this.html5QrCode.start(
        { facingMode: 'environment' }, // Cámara trasera en móviles
        config,
        (decodedText, decodedResult) => {
          // Código QR detectado exitosamente
          console.log('QR Code detectado:', decodedText);
          this.onQRCodeScanned(decodedText);
        },
        (errorMessage) => {
          // Error al escanear (normal mientras busca el QR)
          // No hacer nada aquí para evitar spam en consola
        }
      );
    } catch (error: any) {
      console.error('Error al iniciar scanner:', error);
      this.scannerError = error?.message || 'No se pudo acceder a la cámara. Por favor, permite el acceso.';
    }
  }

  onQRCodeScanned(code: string): void {
    console.log('QR Code escaneado:', code);
    
    // Detener el scanner inmediatamente
    this.stopQRScanner();
    
    // Buscar si el equipo ya existe
    const existing = this.firebaseService.findEquipmentByQR(code);
    
    if (existing) {
      alert(`Equipo ya registrado:\n${existing.name}\nModelo: ${existing.model}\nSerie: ${existing.serialNumber}`);
      this.closeQRScanner();
      return;
    }
    
    // Si no existe, abrir modal para agregar info adicional
    this.newEquipment = {
      name: '',
      model: '',
      serialNumber: code,
      qrCode: code,
      category: 'Laptop',
      status: 'disponible',
      assignedTo: '',
      purchaseDate: ''
    };
    
    this.closeQRScanner();
    this.showAddModal = true;
  }

  // Método temporal para simular escaneo (para testing sin cámara)
  simulateQRScan(): void {
    const testCode = 'TEST-' + Date.now().toString().substr(-6);
    this.onQRCodeScanned(testCode);
  }

  closeQRScanner(): void {
    this.showQRScanner = false;
    this.stopQRScanner();
  }

  private stopQRScanner(): void {
    if (this.html5QrCode) {
      this.html5QrCode.stop()
        .then(() => {
          this.html5QrCode?.clear();
          this.html5QrCode = null;
        })
        .catch((err) => {
          console.error('Error al detener scanner:', err);
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
    if (!this.newEquipment.name || !this.newEquipment.model || !this.newEquipment.serialNumber) {
      alert('Por favor completa todos los campos obligatorios');
      return;
    }

    // Verificar si la serie ya existe
    const existing = this.firebaseService.findEquipmentBySerial(this.newEquipment.serialNumber!);
    if (existing) {
      alert('Ya existe un equipo con ese número de serie');
      return;
    }

    try {
      await this.firebaseService.addEquipment(this.newEquipment as Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>);
      alert('Equipo agregado exitosamente');
      this.closeAddModal();
    } catch (error) {
      console.error('Error al guardar equipo:', error);
      alert('Error al guardar el equipo. Intenta de nuevo.');
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
    // Crear tabla HTML
    let html = '<table><thead><tr>';
    html += '<th>Nombre</th><th>Modelo</th><th>Serie</th><th>Categoría</th><th>Estado</th><th>Asignado a</th>';
    html += '</tr></thead><tbody>';
    
    this.filteredEquipment.forEach(eq => {
      html += '<tr>';
      html += `<td>${eq.name}</td>`;
      html += `<td>${eq.model}</td>`;
      html += `<td>${eq.serialNumber}</td>`;
      html += `<td>${eq.category}</td>`;
      html += `<td>${eq.status}</td>`;
      html += `<td>${eq.assignedTo || '-'}</td>`;
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    
    // Crear archivo y descargar
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario_${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  exportToPDF(): void {
    // Generar contenido HTML para PDF
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
          <td>${eq.name}</td>
          <td>${eq.model}</td>
          <td>${eq.serialNumber}</td>
          <td>${eq.category}</td>
          <td>${eq.status}</td>
          <td>${eq.assignedTo || '-'}</td>
        </tr>
      `;
    });
    
    html += `
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    // Abrir en nueva ventana para imprimir
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  }
}