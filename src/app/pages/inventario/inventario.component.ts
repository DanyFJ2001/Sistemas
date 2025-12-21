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

interface NameSuggestion {
  name: string;
  count: number;
}

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

  selectedSort = 'name-asc';
  sortOptions = [
    { value: 'name-asc', label: 'Nombre (A-Z)' },
    { value: 'name-desc', label: 'Nombre (Z-A)' },
    { value: 'serial-asc', label: 'N° Serie (A-Z)' },
    { value: 'serial-desc', label: 'N° Serie (Z-A)' },
    { value: 'codigo-asc', label: 'Código (A-Z)' },
    { value: 'codigo-desc', label: 'Código (Z-A)' },
    { value: 'sucursal-asc', label: 'Sucursal (A-Z)' },
    { value: 'date-newest', label: 'Más recientes' },
    { value: 'date-oldest', label: 'Más antiguos' },
  ];

  showQRScanner = false;
  scannerError = '';
  showAddModal = false;
  newEquipment: Partial<Equipment> = this.getEmptyEquipment();
  allowCodeRegeneration = false;

  showNameSuggestions = false;
  filteredNameSuggestions: NameSuggestion[] = [];
  allNameSuggestions: NameSuggestion[] = [];
  selectedSuggestionIndex = -1;

  equipmentList: Equipment[] = [];
  filteredEquipment: Equipment[] = [];

  categories = ['EQUIPOS DE COMPUTO Y ELECTRONICOS', 'EQUIPOS MEDICOS', 'MUEBLES Y ENSERES'];

  private categoryCodeMap: { [key: string]: string } = {
    'EQUIPOS DE COMPUTO Y ELECTRONICOS': 'EC',
    'EQUIPOS MEDICOS': 'EM',
    'MUEBLES Y ENSERES': 'ME'
  };

  sucursales = ['CALDERON', 'CAMION', 'CARAPUNGO', 'COCA', 'ECOGRAFIAS', 'JIPIJAPA', 'LABORATORIO', 'MICHELENA', 'NACIONES UNIDAS', 'PRADERAS', 'LAGO AGRIO'];

  private sucursalCodeMap: { [key: string]: string } = {
    'CALDERON': 'CA', 'CAMION': 'CM', 'CARAPUNGO': 'CP', 'COCA': 'CO', 'ECOGRAFIAS': 'EG',
    'JIPIJAPA': 'JI', 'LABORATORIO': 'LA', 'MICHELENA': 'MI', 'NACIONES UNIDAS': 'NU',
    'PRADERAS': 'PR', 'LAGO AGRIO': 'LG'
  };

  private sucursalColorMap: { [key: string]: string } = {
    'CALDERON': '#e74c3c', 'CAMION': '#9b59b6', 'CARAPUNGO': '#3498db', 'COCA': '#1abc9c',
    'ECOGRAFIAS': '#f39c12', 'JIPIJAPA': '#2ecc71', 'LABORATORIO': '#e91e63',
    'MICHELENA': '#00bcd4', 'NACIONES UNIDAS': '#ff5722', 'PRADERAS': '#8bc34a', 'LAGO AGRIO': '#673ab7'
  };

  areas = ['Administración', 'Sistemas', 'Recursos Humanos', 'Contabilidad', 'Gestion de la Calidad',
    'Comercial', 'Operaciones', 'Laboratorio', 'Salud Ocupacional', 'Recepción', 'Gerencia Comercial'];

  showStatusModal = false;
  selectedEquipment: Equipment | null = null;
  statusOptions = [
    { value: 'disponible', label: 'Disponible' },
    { value: 'asignado', label: 'Asignado' },
    { value: 'mantenimiento', label: 'Mantenimiento' },
  ];

  showViewModal = false;
  viewedEquipment: Equipment | null = null;

  constructor(private firebaseService: FirebaseService, private ngZone: NgZone, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.loadEquipment(); }

  ngOnDestroy(): void {
    if (this.startQRScannerTimeout) clearTimeout(this.startQRScannerTimeout);
    this.destroy$.next();
    this.destroy$.complete();
    this.stopQRScanner();
  }

  private getEmptyEquipment(): Partial<Equipment> {
    return {
      codigo: '', anio: new Date().getFullYear().toString(), name: '', sucursal: 'JIPIJAPA',
      area: 'Administración', serialNumber: '', marca: '', model: '', status: 'disponible',
      accesorios: '', responsable: '', observaciones: '', category: 'EQUIPOS DE COMPUTO Y ELECTRONICOS', purchaseDate: '',
    };
  }

  getSucursalInitials(sucursal: string): string {
    return this.sucursalCodeMap[sucursal] || sucursal.substring(0, 2).toUpperCase();
  }

  getSucursalColor(sucursal: string): string {
    return this.sucursalColorMap[sucursal] || '#6366f1';
  }

  getCategoryClass(category: string): string {
    const code = this.categoryCodeMap[category];
    return code ? code.toLowerCase() : 'default';
  }

  private updateNameSuggestions(): void {
    const nameCountMap = new Map<string, number>();
    this.equipmentList.forEach(eq => {
      const name = eq.name.trim().toUpperCase();
      if (name) nameCountMap.set(name, (nameCountMap.get(name) || 0) + 1);
    });
    this.allNameSuggestions = Array.from(nameCountMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  private filterSuggestions(): void {
    const searchValue = (this.newEquipment.name || '').trim().toUpperCase();
    if (!searchValue) {
      this.filteredNameSuggestions = [...this.allNameSuggestions].slice(0, 10);
    } else {
      this.filteredNameSuggestions = this.allNameSuggestions.filter(s => s.name.includes(searchValue)).slice(0, 10);
    }
    this.selectedSuggestionIndex = -1;
  }

  isExistingName(name: string): boolean {
    if (!name) return false;
    return this.allNameSuggestions.some(s => s.name === name.trim().toUpperCase());
  }

  onNameFocus(): void {
    this.showNameSuggestions = true;
    this.filterSuggestions();
  }

  onNameBlur(): void {
    setTimeout(() => { this.showNameSuggestions = false; }, 200);
  }

  onNameKeydown(event: KeyboardEvent): void {
    if (!this.showNameSuggestions) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (this.selectedSuggestionIndex < this.filteredNameSuggestions.length - 1) this.selectedSuggestionIndex++;
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (this.selectedSuggestionIndex > 0) this.selectedSuggestionIndex--;
        break;
      case 'Enter':
        event.preventDefault();
        if (this.selectedSuggestionIndex >= 0 && this.filteredNameSuggestions[this.selectedSuggestionIndex]) {
          this.selectNameSuggestion(this.filteredNameSuggestions[this.selectedSuggestionIndex]);
        } else {
          this.showNameSuggestions = false;
          this.generateEquipmentCode();
        }
        break;
      case 'Escape':
        this.showNameSuggestions = false;
        break;
    }
  }

  selectNameSuggestion(suggestion: NameSuggestion): void {
    this.newEquipment.name = suggestion.name;
    this.showNameSuggestions = false;
    this.selectedSuggestionIndex = -1;
    this.generateEquipmentCode();
  }

  onNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.toUpperCase().replace(/[^A-Z0-9\s]/g, '');
    input.value = value;
    this.newEquipment.name = value;
    this.filterSuggestions();
    this.generateEquipmentCode();
  }

  onFieldChange(): void { this.generateEquipmentCode(); }

  onCodeRegenerationToggle(): void {
    if (this.allowCodeRegeneration) this.generateEquipmentCode();
  }

  private generateEquipmentCode(): void {
    if (this.newEquipment.id && !this.allowCodeRegeneration) return;
    const category = this.newEquipment.category;
    const sucursal = this.newEquipment.sucursal;
    const name = this.newEquipment.name?.trim();
    if (!category || !sucursal || !name || name.length < 3) {
      if (!this.newEquipment.id) this.newEquipment.codigo = '';
      return;
    }
    const categoryCode = this.categoryCodeMap[category] || 'XX';
    const sucursalCode = this.sucursalCodeMap[sucursal] || 'XX';
    const nameLettersOnly = name.replace(/[^A-Z]/g, '');
    if (nameLettersOnly.length < 3) {
      if (!this.newEquipment.id) this.newEquipment.codigo = '';
      return;
    }
    const nameCode = nameLettersOnly.substring(0, 3);
    const prefix = `AF.${categoryCode}.${sucursalCode}.${nameCode}`;
    const sequentialNumber = this.getNextSequentialNumber(prefix);
    this.newEquipment.codigo = `${prefix}.${sequentialNumber}`;
  }

  private getNextSequentialNumber(prefix: string): string {
    const currentId = this.newEquipment.id;
    const similarEquipment = this.equipmentList.filter(eq => 
      eq.codigo && eq.codigo.startsWith(prefix + '.') && eq.id !== currentId
    );
    if (similarEquipment.length === 0) return '001';
    const numbers = similarEquipment.map(eq => {
      const parts = eq.codigo.split('.');
      return parseInt(parts[parts.length - 1], 10) || 0;
    });
    return (Math.max(...numbers) + 1).toString().padStart(3, '0');
  }

  loadEquipment(): void {
    this.loading = true;
    this.firebaseService.getEquipment().pipe(takeUntil(this.destroy$)).subscribe({
      next: (equipment) => {
        this.equipmentList = equipment;
        this.updateNameSuggestions();
        this.filterEquipment();
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  onSearch(event: Event): void {
    this.searchTerm = (event.target as HTMLInputElement).value.toLowerCase();
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
        eq.codigo.toLowerCase().includes(this.searchTerm) ||
        eq.marca.toLowerCase().includes(this.searchTerm) ||
        eq.responsable?.toLowerCase().includes(this.searchTerm) ||
        eq.area.toLowerCase().includes(this.searchTerm) ||
        eq.sucursal.toLowerCase().includes(this.searchTerm)
      );
    }
    if (this.selectedFilter !== 'todos') filtered = filtered.filter(eq => eq.status === this.selectedFilter);
    this.filteredEquipment = this.sortEquipment(filtered);
  }

  private sortEquipment(equipment: Equipment[]): Equipment[] {
    const sorted = [...equipment];
    switch (this.selectedSort) {
      case 'name-asc': return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'name-desc': return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case 'serial-asc': return sorted.sort((a, b) => a.serialNumber.localeCompare(b.serialNumber));
      case 'serial-desc': return sorted.sort((a, b) => b.serialNumber.localeCompare(a.serialNumber));
      case 'codigo-asc': return sorted.sort((a, b) => a.codigo.localeCompare(b.codigo));
      case 'codigo-desc': return sorted.sort((a, b) => b.codigo.localeCompare(a.codigo));
      case 'sucursal-asc': return sorted.sort((a, b) => a.sucursal.localeCompare(b.sucursal));
      case 'date-newest': return sorted.sort((a, b) => (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0));
      case 'date-oldest': return sorted.sort((a, b) => (a.createdAt ? new Date(a.createdAt).getTime() : 0) - (b.createdAt ? new Date(b.createdAt).getTime() : 0));
      default: return sorted;
    }
  }

  async openScanQR(): Promise<void> {
    this.showQRScanner = true;
    this.scannerError = '';
    this.isScanning = false;
    this.cdr.detectChanges();
    
    this.startQRScannerTimeout = setTimeout(() => this.startQRScanner(), 300);
  }

  private async startQRScanner(): Promise<void> {
    try {
      if (!this.qrReader?.nativeElement) {
        throw new Error('Elemento QR reader no disponible');
      }

      this.html5QrCode = new Html5Qrcode('qr-reader');
      
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
          // Solo procesar si no estamos ya escaneando
          if (!this.isScanning) {
            this.isScanning = true;
            console.log('✅ Código detectado:', decodedText);
            this.ngZone.run(() => {
              this.processScannedCode(decodedText);
            });
          }
        },
        () => {} // Ignorar errores de frame
      );
      
      console.log('📷 Scanner iniciado correctamente');
    } catch (error: any) {
      console.error('❌ Error al iniciar scanner:', error);
      this.ngZone.run(() => {
        this.scannerError = error?.message || 'No se pudo acceder a la cámara.';
      });
    }
  }

  private processScannedCode(code: string): void {
    console.log('🔍 Procesando código:', code);
    console.log('📋 Equipos en lista:', this.equipmentList.length);
    
    // Primero cerrar el scanner
    this.stopQRScanner();
    this.showQRScanner = false;
    
    // Buscar el equipo
    const existing = this.equipmentList.find(eq => {
      const matchCodigo = eq.codigo === code;
      const matchQR = eq.qrCode === code;
      const matchSerial = eq.serialNumber === code;
      console.log(`  - ${eq.name}: codigo=${matchCodigo}, qrCode=${matchQR}, serial=${matchSerial}`);
      return matchCodigo || matchQR || matchSerial;
    });

    // Pequeño delay para asegurar que el scanner se cerró
    setTimeout(() => {
      this.ngZone.run(() => {
        if (existing) {
          console.log('✅ Equipo encontrado:', existing.name);
          this.viewedEquipment = existing;
          this.showViewModal = true;
        } else {
          console.log('➕ Equipo no encontrado, abriendo formulario para crear nuevo');
          this.newEquipment = this.getEmptyEquipment();
          this.newEquipment.qrCode = code;
          this.allowCodeRegeneration = false;
          this.showAddModal = true;
        }
        this.isScanning = false;
        this.cdr.detectChanges();
      });
    }, 200);
  }

  onCodeScanned(code: string): void {
    this.processScannedCode(code);
  }

  simulateQRScan(): void {
    const testCode = 'TEST-' + Date.now().toString().slice(-6);
    console.log('🧪 Simulando escaneo con código:', testCode);
    this.processScannedCode(testCode);
  }

  closeQRScanner(): void {
    this.showQRScanner = false;
    this.isScanning = false;
    this.stopQRScanner();
    this.cdr.detectChanges();
  }

  private stopQRScanner(): void {
    if (this.html5QrCode) {
      this.html5QrCode.stop()
        .then(() => {
          console.log('📷 Scanner detenido');
          this.html5QrCode?.clear();
          this.html5QrCode = null;
        })
        .catch((err) => {
          console.log('⚠️ Error al detener scanner:', err);
          this.html5QrCode = null;
        })
        .finally(() => {
          this.isScanning = false;
        });
    }
  }

  openAddModal(): void {
    this.newEquipment = this.getEmptyEquipment();
    this.allowCodeRegeneration = false;
    this.showNameSuggestions = false;
    this.selectedSuggestionIndex = -1;
    this.showAddModal = true;
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.showNameSuggestions = false;
    this.newEquipment = {};
    this.allowCodeRegeneration = false;
  }

  async saveEquipment(): Promise<void> {
    if (this.savingEquipment) return;
    if (!this.newEquipment.codigo || !this.newEquipment.name || !this.newEquipment.serialNumber || !this.newEquipment.marca || !this.newEquipment.model) {
      alert('Completa todos los campos obligatorios (*).');
      return;
    }
    if (!/^[A-Z0-9\s]+$/.test(this.newEquipment.name)) {
      alert('El nombre solo debe contener MAYÚSCULAS y NÚMEROS');
      return;
    }
    if (!this.newEquipment.id || this.allowCodeRegeneration) {
      if (this.equipmentList.find(eq => eq.codigo === this.newEquipment.codigo && eq.id !== this.newEquipment.id)) {
        alert('Ya existe un equipo con ese código.');
        this.generateEquipmentCode();
        return;
      }
    }
    if (this.equipmentList.find(eq => eq.serialNumber === this.newEquipment.serialNumber && eq.id !== this.newEquipment.id)) {
      alert('Ya existe un equipo con ese número de serie');
      return;
    }
    this.savingEquipment = true;
    try {
      if (this.newEquipment.id) {
        await this.firebaseService.updateEquipment(this.newEquipment.id, this.newEquipment as any);
        alert('Equipo actualizado');
      } else {
        await this.firebaseService.addEquipment(this.newEquipment as any);
        alert('Equipo agregado');
      }
      this.closeAddModal();
    } catch { alert('Error al guardar'); }
    finally { this.savingEquipment = false; }
  }

  closeStatusModal(): void { this.showStatusModal = false; this.selectedEquipment = null; }

  closeViewModal(): void { this.showViewModal = false; this.viewedEquipment = null; }

  editFromView(): void {
    if (this.viewedEquipment) {
      this.newEquipment = { ...this.viewedEquipment };
      this.allowCodeRegeneration = false;
      this.closeViewModal();
      this.showAddModal = true;
    }
  }

  viewEquipment(equipment: Equipment): void { this.viewedEquipment = equipment; this.showViewModal = true; }

  async editEquipment(equipment: Equipment): Promise<void> {
    this.newEquipment = { ...equipment };
    this.allowCodeRegeneration = false;
    this.showAddModal = true;
  }

  async deleteEquipment(equipment: Equipment): Promise<void> {
    if (confirm(`¿Eliminar ${equipment.name}?`)) {
      try { await this.firebaseService.deleteEquipment(equipment.id); alert('Eliminado'); }
      catch { alert('Error al eliminar'); }
    }
  }

  exportToExcel(): void {
    const esc = (t: string) => t.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m));
    let html = '<table><thead><tr><th>CODIGO</th><th>AÑO</th><th>NOMBRE</th><th>SUCURSAL</th><th>AREA</th><th>N° SERIE</th><th>MARCA</th><th>MODELO</th><th>STATUS</th><th>ACCESORIOS</th><th>RESPONSABLE</th><th>OBSERVACIONES</th></tr></thead><tbody>';
    this.filteredEquipment.forEach(eq => {
      html += `<tr><td>${esc(eq.codigo)}</td><td>${esc(eq.anio)}</td><td>${esc(eq.name)}</td><td>${esc(eq.sucursal)}</td><td>${esc(eq.area)}</td><td>${esc(eq.serialNumber)}</td><td>${esc(eq.marca)}</td><td>${esc(eq.model)}</td><td>${esc(eq.status)}</td><td>${esc(eq.accesorios || '-')}</td><td>${esc(eq.responsable || '-')}</td><td>${esc(eq.observaciones || '-')}</td></tr>`;
    });
    html += '</tbody></table>';
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `inventario_${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
  }

  exportToPDF(): void {
    const esc = (t: string) => t.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m));
    let html = `<html><head><style>body{font-family:Arial;font-size:10px}h1{color:#333;font-size:18px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:6px;text-align:left}th{background:#6366f1;color:white;font-size:9px}td{font-size:9px}</style></head><body><h1>Inventario</h1><p>Fecha: ${new Date().toLocaleDateString()}</p><table><thead><tr><th>CODIGO</th><th>AÑO</th><th>NOMBRE</th><th>SUCURSAL</th><th>AREA</th><th>N° SERIE</th><th>MARCA</th><th>MODELO</th><th>STATUS</th><th>ACCESORIOS</th><th>RESPONSABLE</th><th>OBS</th></tr></thead><tbody>`;
    this.filteredEquipment.forEach(eq => {
      html += `<tr><td>${esc(eq.codigo)}</td><td>${esc(eq.anio)}</td><td>${esc(eq.name)}</td><td>${esc(eq.sucursal)}</td><td>${esc(eq.area)}</td><td>${esc(eq.serialNumber)}</td><td>${esc(eq.marca)}</td><td>${esc(eq.model)}</td><td>${esc(eq.status)}</td><td>${esc(eq.accesorios || '-')}</td><td>${esc(eq.responsable || '-')}</td><td>${esc(eq.observaciones || '-')}</td></tr>`;
    });
    html += '</tbody></table></body></html>';
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 250); }
  }
}
