// src/app/pages/inventario/inventario.component.ts
import { Component, OnInit, OnDestroy, ViewChild, ElementRef, NgZone, ChangeDetectorRef } from '@angular/core';
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

  // URL de Google Sheets API
  private googleSheetUrl = 'https://script.google.com/macros/s/AKfycbynxjnxGhofaJNgS2XFdEsexkqb7b6zp28xkhn1keCRIvf5Y-sdkKxeQYTLR_i4-hB0/exec';

  loading = true;
  searchTerm = '';
  selectedFilter = 'todos';
  savingEquipment = false;
  syncingSheet = false;

  selectedSort = 'name-asc';
  sortOptions = [
    { value: 'name-asc', label: 'Nombre (A-Z)' },
    { value: 'name-desc', label: 'Nombre (Z-A)' },
    { value: 'codigo-asc', label: 'Código (A-Z)' },
    { value: 'codigo-desc', label: 'Código (Z-A)' },
    { value: 'sucursal-asc', label: 'Sucursal (A-Z)' },
    { value: 'date-newest', label: 'Más recientes' },
    { value: 'date-oldest', label: 'Más antiguos' },
  ];

  showQRScanner = false;
  scannerError = '';
  showAddModal = false;
  showViewModal = false;
  viewedEquipment: Equipment | null = null;
  newEquipment: Partial<Equipment> = {};
  
  allowCodeRegeneration = false;

  showNameSuggestions = false;
  filteredNameSuggestions: NameSuggestion[] = [];
  allNameSuggestions: NameSuggestion[] = [];
  selectedSuggestionIndex = -1;

  equipmentList: Equipment[] = [];
  filteredEquipment: Equipment[] = [];

  categories = ['EQUIPOS DE COMPUTO Y ELECTRONICOS', 'EQUIPOS MEDICOS', 'MUEBLES Y ENSERES','LABORATORIO'];

  private categoryCodeMap: { [key: string]: string } = {
    'EQUIPOS DE COMPUTO Y ELECTRONICOS': 'EC',
    'EQUIPOS MEDICOS': 'EM',
    'MUEBLES Y ENSERES': 'ME'
  };

  sucursales = ['CALDERON', 'CAMION', 'CARAPUNGO', 'COCA', 'ECOGRAFIAS', 'JIPIJAPA', 'LABORATORIO', 'MICHELENA', 'NACIONES UNIDAS', 'PRADERAS', 'LAGO AGRIO','LAS NAVES'];

  private sucursalCodeMap: { [key: string]: string } = {
    'CALDERON': 'CA', 'CAMION': 'CM', 'CARAPUNGO': 'CP', 'COCA': 'CO', 'ECOGRAFIAS': 'EG',
    'JIPIJAPA': 'JP', 'LABORATORIO': 'LA', 'MICHELENA': 'MI', 'NACIONES UNIDAS': 'NU',
    'PRADERAS': 'PR', 'LAGO AGRIO': 'LG', 'LAS NAVES': 'LN'
  };

  private sucursalColorMap: { [key: string]: string } = {
    'CALDERON': '#e74c3c', 'CAMION': '#9b59b6', 'CARAPUNGO': '#3498db', 'COCA': '#1abc9c',
    'ECOGRAFIAS': '#f39c12', 'JIPIJAPA': '#2ecc71', 'LABORATORIO': '#e91e63',
    'MICHELENA': '#00bcd4', 'NACIONES UNIDAS': '#ff5722', 'PRADERAS': '#8bc34a', 'LAGO AGRIO': '#673ab7'
  };

  areas = ['Administración', 'Sistemas', 'Recursos Humanos', 'Contabilidad', 'Gestion de la Calidad',
    'Comercial', 'Operaciones', 'Laboratorio', 'Salud Ocupacional', 'Recepción', 'Gerencia Comercial'];

  constructor(
    private firebaseService: FirebaseService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadEquipment();
  }

  ngOnDestroy(): void {
    if (this.startQRScannerTimeout) clearTimeout(this.startQRScannerTimeout);
    this.destroy$.next();
    this.destroy$.complete();
    this.stopQRScanner();
  }

  private getEmptyEquipment(): Partial<Equipment> {
    return {
      codigo: '',
      qrCode: '',
      anio: new Date().getFullYear().toString(),
      name: '',
      sucursal: 'JIPIJAPA',
      area: 'Administración',
      serialNumber: '',
      marca: '',
      model: '',
      status: 'disponible',
      accesorios: '',
      responsable: '',
      observaciones: '',
      category: 'EQUIPOS DE COMPUTO Y ELECTRONICOS',
      purchaseDate: '',
    };
  }

  // ========== FUNCIONES DE VISTA ==========
  
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

  getCategoryCode(category: string): string {
    return this.categoryCodeMap[category] || 'XX';
  }

  getCategoryColor(category: string): string {
    const code = this.categoryCodeMap[category];
    switch (code) {
      case 'EC': return '#1e40af';
      case 'EM': return '#065f46';
      case 'ME': return '#92400e';
      default: return '#475569';
    }
  }

  // ========== AUTOCOMPLETADO DE NOMBRES ==========

  private updateNameSuggestions(): void {
    const nameCountMap = new Map<string, number>();
    this.equipmentList.forEach(eq => {
      const name = eq.name?.trim().toUpperCase();
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

  // ========== GENERACIÓN DE CÓDIGO ==========

  onFieldChange(): void {
    this.generateEquipmentCode();
  }

  toggleCodeRegeneration(): void {
    if (this.allowCodeRegeneration) {
      this.generateEquipmentCode();
    }
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

  // ========== CARGA Y FILTRADO ==========

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
        eq.name?.toLowerCase().includes(this.searchTerm) ||
        eq.model?.toLowerCase().includes(this.searchTerm) ||
        eq.serialNumber?.toLowerCase().includes(this.searchTerm) ||
        eq.codigo?.toLowerCase().includes(this.searchTerm) ||
        eq.marca?.toLowerCase().includes(this.searchTerm) ||
        eq.responsable?.toLowerCase().includes(this.searchTerm) ||
        eq.area?.toLowerCase().includes(this.searchTerm) ||
        eq.sucursal?.toLowerCase().includes(this.searchTerm)
      );
    }
    if (this.selectedFilter !== 'todos') {
      filtered = filtered.filter(eq => eq.status === this.selectedFilter);
    }
    this.filteredEquipment = this.sortEquipment(filtered);
  }

  private sortEquipment(equipment: Equipment[]): Equipment[] {
    const sorted = [...equipment];
    switch (this.selectedSort) {
      case 'name-asc': return sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      case 'name-desc': return sorted.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
      case 'codigo-asc': return sorted.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));
      case 'codigo-desc': return sorted.sort((a, b) => (b.codigo || '').localeCompare(a.codigo || ''));
      case 'sucursal-asc': return sorted.sort((a, b) => (a.sucursal || '').localeCompare(b.sucursal || ''));
      case 'date-newest': return sorted.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      case 'date-oldest': return sorted.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      default: return sorted;
    }
  }

  // ========== QR SCANNER ==========

  async openScanQR(): Promise<void> {
    this.showQRScanner = true;
    this.scannerError = '';
    this.isScanning = false;
    this.cdr.detectChanges();
    this.startQRScannerTimeout = setTimeout(() => this.startQRScanner(), 300);
  }

  private async startQRScanner(): Promise<void> {
    try {
      if (!this.qrReader?.nativeElement) throw new Error('Elemento QR reader no disponible');
      this.html5QrCode = new Html5Qrcode('qr-reader');
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) throw new Error('No se encontraron cámaras');
      
      await this.html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (!this.isScanning) {
            this.isScanning = true;
            console.log('Código detectado:', decodedText);
            this.ngZone.run(() => this.processScannedCode(decodedText));
          }
        },
        () => {}
      );
    } catch (error: any) {
      this.ngZone.run(() => {
        this.scannerError = error?.message || 'Error de cámara';
      });
    }
  }

  private processScannedCode(code: string): void {
    this.stopQRScanner();
    this.showQRScanner = false;

    const existing = this.equipmentList.find(eq =>
      eq.codigo === code || eq.qrCode === code || eq.serialNumber === code
    );

    setTimeout(() => {
      this.ngZone.run(() => {
        if (existing) {
          console.log('Equipo encontrado:', existing.name);
          this.viewedEquipment = existing;
          this.showViewModal = true;
        } else {
          console.log('Equipo no encontrado, creando nuevo');
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

  simulateQRScan(): void {
    const testCode = 'TEST-' + Date.now().toString().slice(-6);
    console.log('Simulando escaneo:', testCode);
    this.processScannedCode(testCode);
  }

  closeQRScanner(): void {
    this.showQRScanner = false;
    this.isScanning = false;
    this.stopQRScanner();
  }

  private stopQRScanner(): void {
    if (this.html5QrCode) {
      this.html5QrCode.stop().then(() => {
        this.html5QrCode?.clear();
        this.html5QrCode = null;
      }).catch(() => {
        this.html5QrCode = null;
      });
    }
  }

  // ========== MODALES ==========

  openAddModal(): void {
    this.newEquipment = this.getEmptyEquipment();
    this.allowCodeRegeneration = false;
    this.showNameSuggestions = false;
    this.showAddModal = true;
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.showNameSuggestions = false;
    this.newEquipment = {};
    this.allowCodeRegeneration = false;
  }

  closeViewModal(): void {
    this.showViewModal = false;
    this.viewedEquipment = null;
  }

  editFromView(): void {
    if (this.viewedEquipment) {
      this.newEquipment = { ...this.viewedEquipment };
      this.allowCodeRegeneration = false;
      this.closeViewModal();
      this.showAddModal = true;
    }
  }

  viewEquipment(equipment: Equipment): void {
    this.viewedEquipment = equipment;
    this.showViewModal = true;
  }

  editEquipment(equipment: Equipment): void {
    this.newEquipment = { ...equipment };
    this.allowCodeRegeneration = false;
    this.showAddModal = true;
  }

  async deleteEquipment(equipment: Equipment): Promise<void> {
    if (confirm(`¿Eliminar ${equipment.name}?`)) {
      try {
        await this.firebaseService.deleteEquipment(equipment.id);
        alert('Equipo eliminado');
      } catch {
        alert('Error al eliminar');
      }
    }
  }

  async saveEquipment(): Promise<void> {
    if (this.savingEquipment) return;

    if (!this.newEquipment.codigo || !this.newEquipment.name || !this.newEquipment.serialNumber ||
        !this.newEquipment.marca || !this.newEquipment.model) {
      alert('Completa todos los campos obligatorios (*)');
      return;
    }

    if (!/^[A-Z0-9\s]+$/.test(this.newEquipment.name)) {
      alert('El nombre solo debe contener MAYÚSCULAS y NÚMEROS');
      return;
    }

    const duplicateCode = this.equipmentList.find(eq =>
      eq.codigo === this.newEquipment.codigo && eq.id !== this.newEquipment.id
    );
    if (duplicateCode && (!this.newEquipment.id || this.allowCodeRegeneration)) {
      alert('Ya existe un equipo con ese código');
      this.generateEquipmentCode();
      return;
    }

    const duplicateSerial = this.equipmentList.find(eq =>
      eq.serialNumber === this.newEquipment.serialNumber && eq.id !== this.newEquipment.id
    );
    if (duplicateSerial) {
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
    } catch {
      alert('Error al guardar');
    } finally {
      this.savingEquipment = false;
    }
  }

  // ========== SYNC CON GOOGLE SHEETS ==========

  private buildGoogleSheetParams(eq: Equipment): URLSearchParams {
    return new URLSearchParams({
      action: 'insert',
      codigo: eq.codigo || '',
      ano: eq.anio || new Date().getFullYear().toString(),
      cod_definitivo: eq.codigo || '',
      nombre_equipo: eq.name || '',
      sucursal: eq.sucursal || '',
      area_ubicacion: eq.area || '',
      serie_lote: eq.serialNumber || '',
      marca: eq.marca || '',
      modelo: eq.model || '',
      status: eq.status || '',
      accesorios: eq.accesorios || '',
      responsable: eq.responsable || '',
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
  }

  private async sendToGoogleSheet(params: URLSearchParams): Promise<boolean> {
    try {
      await fetch(`${this.googleSheetUrl}?${params.toString()}`, {
        method: 'GET',
        mode: 'no-cors'
      });
      return true;
    } catch (error) {
      console.error('Error de red:', error);
      return false;
    }
  }

  async syncToGoogleSheet(equipment?: Equipment): Promise<void> {
    const eq = equipment || this.filteredEquipment[0];
    
    if (!eq) {
      alert('No hay equipo para enviar');
      return;
    }

    this.syncingSheet = true;
    const params = this.buildGoogleSheetParams(eq);
    const success = await this.sendToGoogleSheet(params);
    this.syncingSheet = false;
    
    if (success) {
      alert(`✅ Equipo "${eq.name}" enviado a Google Sheets\n\nRevisa tu hoja para confirmar.`);
    } else {
      alert('❌ Error de conexión. Revisa tu internet.');
    }
  }

  async syncAllToGoogleSheet(): Promise<void> {
    if (this.filteredEquipment.length === 0) {
      alert('No hay equipos para enviar');
      return;
    }

    if (!confirm(`¿Enviar ${this.filteredEquipment.length} equipos a Google Sheets?`)) return;

    this.syncingSheet = true;
    let enviados = 0;

    for (const eq of this.filteredEquipment) {
      const params = this.buildGoogleSheetParams(eq);
      const success = await this.sendToGoogleSheet(params);
      if (success) enviados++;
      await new Promise(resolve => setTimeout(resolve, 600));
    }

    this.syncingSheet = false;
    alert(`✅ Proceso completado!\n\nEquipos procesados: ${enviados}\n\nRevisa tu Google Sheet para confirmar.`);
  }

  async syncTestToGoogleSheet(): Promise<void> {
    this.syncingSheet = true;

    const params = new URLSearchParams({
      action: 'insert',
      codigo: 'TEST-' + Date.now().toString().slice(-6),
      ano: '2025',
      cod_definitivo: 'AF.EC.JP.TES.001',
      nombre_equipo: 'EQUIPO DE PRUEBA',
      sucursal: 'JIPIJAPA',
      area_ubicacion: 'Sistemas',
      serie_lote: 'SN-TEST-' + Math.random().toString(36).substring(7).toUpperCase(),
      marca: 'MARCA PRUEBA',
      modelo: 'MODELO TEST',
      status: 'disponible',
      accesorios: 'Teclado, Mouse',
      responsable: 'Usuario Test',
      fecha_elaboracion: new Date().toISOString().split('T')[0],
      fecha_mantenimiento: '',
      grupo: 'EQUIPOS DE COMPUTO Y ELECTRONICOS',
      sub_grupo: '',
      nombre_general: 'COMPUTADORA PRUEBA',
      ciudad: 'Quito',
      fecha_compra: '2025-01-01',
      nro_factura: 'TEST-001',
      costo: '100',
      proveedor: 'Test',
      empresa: 'SEGURILAB',
      analisis: 'PRUEBA - ELIMINAR',
      periodo_contable: '2025'
    });

    const success = await this.sendToGoogleSheet(params);
    this.syncingSheet = false;
    
    if (success) {
      alert('✅ Registro de PRUEBA enviado!\n\nRevisa tu Google Sheet.');
    } else {
      alert('❌ Error de conexión');
    }
  }

  // ========== EXPORTACIÓN ==========

  exportToExcel(): void {
    const esc = (t: string) => (t || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m] || m));
    let html = '<table><tr><th>CODIGO</th><th>AÑO</th><th>NOMBRE</th><th>SUCURSAL</th><th>AREA</th><th>N° SERIE</th><th>MARCA</th><th>MODELO</th><th>ESTADO</th><th>RESPONSABLE</th></tr>';
    this.filteredEquipment.forEach(eq => {
      html += `<tr><td>${esc(eq.codigo)}</td><td>${esc(eq.anio)}</td><td>${esc(eq.name)}</td><td>${esc(eq.sucursal)}</td><td>${esc(eq.area)}</td><td>${esc(eq.serialNumber)}</td><td>${esc(eq.marca)}</td><td>${esc(eq.model)}</td><td>${esc(eq.status)}</td><td>${esc(eq.responsable || '')}</td></tr>`;
    });
    html += '</table>';
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `inventario_${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
  }

  exportToPDF(): void {
    const esc = (t: string) => (t || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m] || m));
    let html = `<html><head><style>body{font-family:Arial,sans-serif;font-size:10px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:5px;text-align:left}th{background:#6366f1;color:white}</style></head><body><h2>Inventario de Equipos</h2><p>Fecha: ${new Date().toLocaleDateString()}</p><table><tr><th>CÓDIGO</th><th>NOMBRE</th><th>SUCURSAL</th><th>ÁREA</th><th>SERIE</th><th>MARCA</th><th>MODELO</th><th>ESTADO</th></tr>`;
    this.filteredEquipment.forEach(eq => {
      html += `<tr><td>${esc(eq.codigo)}</td><td>${esc(eq.name)}</td><td>${esc(eq.sucursal)}</td><td>${esc(eq.area)}</td><td>${esc(eq.serialNumber)}</td><td>${esc(eq.marca)}</td><td>${esc(eq.model)}</td><td>${esc(eq.status)}</td></tr>`;
    });
    html += '</table></body></html>';
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 300); }
  }
}