// src/app/pages/contabilidad/contabilidad.component.ts
import { Component, OnInit, OnDestroy, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import * as XLSX from 'xlsx';
import JsBarcode from 'jsbarcode';

// Firebase imports
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, update, remove, onValue, push } from 'firebase/database';

export interface Producto {
  id: string;
  producto: string;
  codigo: string;
  referencia: string;
  combo: string;
  refe: string;
  cantidad: number;
  cantidadPistoleada: number;
  uMedida: string;
  costo: number;
  grupoII: string;
  grupoIII: string;
  estado: string;
  estadoPistola: 'pistoleado' | 'no_pistoleado' | 'parcial';
  fechaPistoleado?: string;
  barcodeDataUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

@Component({
  selector: 'app-contabilidad',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contabilidad.component.html',
  styleUrl: './contabilidad.component.css'
})
export class ContabilidadComponent implements OnInit, OnDestroy {
  @ViewChild('barcodeCanvas') barcodeCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('scannerInput') scannerInput!: ElementRef<HTMLInputElement>;

  private destroy$ = new Subject<void>();
  private database: any;

  // Para usar Math en el template
  Math = Math;

  productos: Producto[] = [];
  productosFiltrados: Producto[] = [];
  
  // Estado de carga
  loading = false;
  loadingMessage = '';
  fileLoaded = false;
  fileName = '';

  // Filtros
  searchTerm = '';
  filtroEstado: 'todos' | 'pistoleado' | 'no_pistoleado' | 'parcial' = 'todos';

  // Scanner
  scannerBuffer = '';
  scannerTimeout: any;
  lastScanTime = 0;
  scannerEnabled = true;

  // Modal de cantidad
  showCantidadModal = false;
  productoSeleccionado: Producto | null = null;
  cantidadIngresada: number = 1;
  operacionModal: 'sumar' | 'restar' = 'sumar'; // NUEVO: Tipo de operación

  // Modal de código de barras
  showBarcodeModal = false;
  productoBarcode: Producto | null = null;

  // Modal de resultados de importación
  showImportResultModal = false;
  importResult = {
    nuevos: 0,
    existentes: 0,
    errores: 0
  };

  // Estadísticas
  stats = {
    total: 0,
    pistoleados: 0,
    noPistoleados: 0,
    parciales: 0,
    porcentaje: 0
  };

  // Sonidos
  private audioSuccess: HTMLAudioElement | null = null;
  private audioError: HTMLAudioElement | null = null;

  constructor() {
    this.initFirebase();
  }

  ngOnInit(): void {
    this.initAudio();
    this.loadProductosFromFirebase();
  }

  ngOnDestroy(): void {
    if (this.scannerTimeout) {
      clearTimeout(this.scannerTimeout);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ========== FIREBASE ==========

  private initFirebase(): void {
    const firebaseConfig = {
      apiKey: "AIzaSyDzgcUjSj2i53ITnBAyGrBpLSLRxqBmiIE",
      authDomain: "prueba-bfc8a.firebaseapp.com",
      databaseURL: "https://prueba-bfc8a-default-rtdb.firebaseio.com",
      projectId: "prueba-bfc8a",
      storageBucket: "prueba-bfc8a.firebasestorage.app",
      messagingSenderId: "885825894999",
      appId: "1:885825894999:web:8a54a876f9d21715d50112",
      measurementId: "G-ER59DQF2D7"
    };

    try {
      // Verificar si ya existe una app con este nombre
      const existingApps = getApps();
      const appName = 'contabilidad-app';
      
      let app;
      const existingApp = existingApps.find(a => a.name === appName);
      
      if (existingApp) {
        app = existingApp;
      } else {
        app = initializeApp(firebaseConfig, appName);
      }
      
      this.database = getDatabase(app);
    } catch (error) {
      console.error('Error inicializando Firebase:', error);
    }
  }

  private loadProductosFromFirebase(): void {
    this.loading = true;
    this.loadingMessage = 'Cargando productos desde la base de datos...';

    const productosRef = ref(this.database, 'productos_contabilidad');
    
    onValue(productosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        this.productos = Object.keys(data).map(key => {
          const prod = data[key];
          const producto: Producto = {
            id: key,
            producto: prod.producto || '',
            codigo: prod.codigo || '',
            referencia: prod.referencia || '',
            combo: prod.combo || '',
            refe: prod.refe || '',
            cantidad: prod.cantidad || 0,
            cantidadPistoleada: prod.cantidadPistoleada || 0,
            uMedida: prod.uMedida || 'UNIDAD',
            costo: prod.costo || 0,
            grupoII: prod.grupoII || '',
            grupoIII: prod.grupoIII || '',
            estado: prod.estado || 'Activo',
            estadoPistola: prod.estadoPistola || 'no_pistoleado',
            fechaPistoleado: prod.fechaPistoleado || undefined,
            createdAt: prod.createdAt || new Date().toISOString(),
            updatedAt: prod.updatedAt || new Date().toISOString()
          };
          // Generar código de barras
          this.generateBarcode(producto);
          return producto;
        });

        this.fileLoaded = this.productos.length > 0;
        this.updateStats();
        this.filterProducts();
      } else {
        this.productos = [];
        this.fileLoaded = false;
      }
      this.loading = false;
      this.loadingMessage = '';
    }, (error) => {
      console.error('Error cargando productos:', error);
      this.loading = false;
      this.loadingMessage = '';
      this.showNotification('Error al cargar productos desde Firebase', 'error');
    });
  }

  private async saveProductoToFirebase(producto: Producto): Promise<string> {
    const productosRef = ref(this.database, 'productos_contabilidad');
    const newProductoRef = push(productosRef);
    
    const productoToSave = {
      ...producto,
      id: newProductoRef.key,
      barcodeDataUrl: undefined, // No guardar el dataURL en Firebase
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Eliminar el barcodeDataUrl antes de guardar
    delete (productoToSave as any).barcodeDataUrl;
    
    await set(newProductoRef, productoToSave);
    return newProductoRef.key || '';
  }

  private async updateProductoInFirebase(producto: Producto): Promise<void> {
    const productoRef = ref(this.database, `productos_contabilidad/${producto.id}`);
    
    const productoToUpdate = {
      ...producto,
      barcodeDataUrl: undefined,
      updatedAt: new Date().toISOString()
    };
    
    delete (productoToUpdate as any).barcodeDataUrl;
    
    await update(productoRef, productoToUpdate);
  }

  private async deleteProductoFromFirebase(id: string): Promise<void> {
    const productoRef = ref(this.database, `productos_contabilidad/${id}`);
    await remove(productoRef);
  }

  private productoExisteEnFirebase(codigo: string): boolean {
    return this.productos.some(p => p.codigo.toUpperCase() === codigo.toUpperCase());
  }

  // ========== AUDIO FEEDBACK ==========
  
  private initAudio(): void {
    // Crear sonidos de feedback
    this.audioSuccess = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleUcJJ4jPxqJ1TQolh8K9jmA+Gh91t7mIVjUdY6yxfEwxF1SgqXJDKhJGkJ1pOiQOOYGQXS4ZCyx0gU8jEwch');
    this.audioError = new Audio('data:audio/wav;base64,UklGRl9vAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YTtvAAB4eHh4eHh4eHh4eHh4eHh4');
  }

  private playSuccessSound(): void {
    if (this.audioSuccess) {
      this.audioSuccess.currentTime = 0;
      this.audioSuccess.play().catch(() => {});
    }
  }

  private playErrorSound(): void {
    if (this.audioError) {
      this.audioError.currentTime = 0;
      this.audioError.play().catch(() => {});
    }
  }

  // ========== CARGA DE EXCEL ==========

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.fileName = file.name;
    this.loading = true;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        this.processExcelData(jsonData as any[][]);
        this.fileLoaded = true;
        this.loading = false;
      } catch (error) {
        console.error('Error al procesar Excel:', error);
        alert('Error al procesar el archivo Excel');
        this.loading = false;
      }
    };

    reader.readAsArrayBuffer(file);
  }

  private async processExcelData(data: any[][]): Promise<void> {
    if (data.length < 2) {
      alert('El archivo está vacío o no tiene datos');
      this.loading = false;
      return;
    }

    // Encontrar los índices de las columnas
    const headers = data[0].map((h: string) => h?.toString().toLowerCase().trim() || '');
    
    const columnMap: { [key: string]: number } = {};
    const expectedColumns = ['producto', 'codigo', 'referencia', 'combo', 'refe', 'cantidad', 'u. medida', 'costo', 'grupo ii', 'grupo iii', 'estado'];
    
    headers.forEach((header: string, index: number) => {
      expectedColumns.forEach(col => {
        if (header.includes(col.replace('.', '').replace(' ', ''))) {
          columnMap[col] = index;
        }
      });
    });

    // Resetear contadores de importación
    this.importResult = { nuevos: 0, existentes: 0, errores: 0 };

    // Procesar filas
    const productosNuevos: Producto[] = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0 || !row[columnMap['codigo'] || 1]) continue;

      const codigo = row[columnMap['codigo'] || 1]?.toString().trim() || '';
      
      // Verificar si ya existe en Firebase
      if (this.productoExisteEnFirebase(codigo)) {
        this.importResult.existentes++;
        console.log(`⏭️ Producto ya existe: ${codigo}`);
        continue;
      }

      const producto: Producto = {
        id: '', // Se asignará en Firebase
        producto: row[columnMap['producto'] || 0]?.toString() || '',
        codigo: codigo,
        referencia: row[columnMap['referencia'] || 2]?.toString() || '',
        combo: row[columnMap['combo'] || 3]?.toString() || '',
        refe: row[columnMap['refe'] || 4]?.toString() || '',
        cantidad: parseFloat(row[columnMap['cantidad'] || 5]) || 0,
        cantidadPistoleada: 0,
        uMedida: row[columnMap['u. medida'] || 6]?.toString() || 'UNIDAD',
        costo: parseFloat(row[columnMap['costo'] || 7]?.toString().replace(',', '.')) || 0,
        grupoII: row[columnMap['grupo ii'] || 8]?.toString() || '',
        grupoIII: row[columnMap['grupo iii'] || 9]?.toString() || '',
        estado: row[columnMap['estado'] || 10]?.toString() || 'Activo',
        estadoPistola: 'no_pistoleado'
      };

      productosNuevos.push(producto);
    }

    // Guardar productos nuevos en Firebase
    if (productosNuevos.length > 0) {
      this.loadingMessage = `Guardando ${productosNuevos.length} productos nuevos en Firebase...`;
      
      for (const producto of productosNuevos) {
        try {
          await this.saveProductoToFirebase(producto);
          this.importResult.nuevos++;
        } catch (error) {
          console.error('Error guardando producto:', producto.codigo, error);
          this.importResult.errores++;
        }
      }
    }

    this.loading = false;
    this.loadingMessage = '';
    
    // Mostrar resultados de importación
    this.showImportResultModal = true;
    
    // Los productos se cargarán automáticamente por el listener de Firebase
  }

  // ========== GENERACIÓN DE CÓDIGOS DE BARRAS ==========

  private generateBarcode(producto: Producto): void {
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, producto.codigo, {
        format: 'CODE128',
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 12,
        margin: 10,
        background: '#ffffff',
        lineColor: '#000000'
      });
      producto.barcodeDataUrl = canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Error generando código de barras para:', producto.codigo, error);
    }
  }

  // ========== SCANNER DE CÓDIGO DE BARRAS ==========

  @HostListener('document:keypress', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (!this.scannerEnabled || this.showCantidadModal) return;

    const currentTime = Date.now();
    
    // Los scanners típicamente envían caracteres muy rápido (menos de 50ms entre caracteres)
    if (currentTime - this.lastScanTime > 100) {
      this.scannerBuffer = '';
    }
    
    this.lastScanTime = currentTime;

    if (event.key === 'Enter') {
      if (this.scannerBuffer.length > 0) {
        this.processScan(this.scannerBuffer);
        this.scannerBuffer = '';
      }
    } else {
      this.scannerBuffer += event.key;
    }

    // Timeout de seguridad
    if (this.scannerTimeout) {
      clearTimeout(this.scannerTimeout);
    }
    this.scannerTimeout = setTimeout(() => {
      if (this.scannerBuffer.length > 3) {
        this.processScan(this.scannerBuffer);
      }
      this.scannerBuffer = '';
    }, 200);
  }

  private processScan(codigo: string): void {
    const cleanCode = codigo.trim().toUpperCase();
    console.log('🔍 Código escaneado:', cleanCode);

    const producto = this.productos.find(p => 
      p.codigo.toUpperCase() === cleanCode ||
      p.codigo.toUpperCase().includes(cleanCode) ||
      cleanCode.includes(p.codigo.toUpperCase())
    );

    if (producto) {
      this.playSuccessSound();
      this.productoSeleccionado = producto;
      this.cantidadIngresada = 1;
      this.operacionModal = 'sumar'; // Por defecto sumar al escanear
      this.showCantidadModal = true;
      this.highlightProduct(producto.id);
    } else {
      this.playErrorSound();
      this.showNotification(`Código no encontrado: ${cleanCode}`, 'error');
    }
  }

  // ========== MODAL DE CANTIDAD ==========

  // NUEVO: Método para cambiar la operación
  setOperacion(op: 'sumar' | 'restar'): void {
    this.operacionModal = op;
    // Ajustar cantidad sugerida según la operación
    if (op === 'sumar' && this.productoSeleccionado) {
      this.cantidadIngresada = Math.min(1, this.productoSeleccionado.cantidad - this.productoSeleccionado.cantidadPistoleada);
      if (this.cantidadIngresada < 1) this.cantidadIngresada = 1;
    } else if (op === 'restar' && this.productoSeleccionado) {
      this.cantidadIngresada = Math.min(1, this.productoSeleccionado.cantidadPistoleada);
      if (this.cantidadIngresada < 1) this.cantidadIngresada = 1;
    }
  }

  // NUEVO: Calcular el resultado previo
  calcularResultado(): number {
    if (!this.productoSeleccionado) return 0;
    
    if (this.operacionModal === 'sumar') {
      return this.productoSeleccionado.cantidadPistoleada + this.cantidadIngresada;
    } else {
      return Math.max(0, this.productoSeleccionado.cantidadPistoleada - this.cantidadIngresada);
    }
  }

  async confirmarCantidad(): Promise<void> {
    if (!this.productoSeleccionado) return;

    const cantidad = this.cantidadIngresada || 1;
    
    // MODIFICADO: Aplicar operación según el tipo seleccionado
    if (this.operacionModal === 'sumar') {
      this.productoSeleccionado.cantidadPistoleada += cantidad;
    } else {
      // Restar - asegurar que no quede negativo
      this.productoSeleccionado.cantidadPistoleada = Math.max(0, this.productoSeleccionado.cantidadPistoleada - cantidad);
    }
    
    this.productoSeleccionado.fechaPistoleado = new Date().toISOString();

    // Actualizar estado según la cantidad pistoleada
    if (this.productoSeleccionado.cantidadPistoleada >= this.productoSeleccionado.cantidad) {
      this.productoSeleccionado.estadoPistola = 'pistoleado';
    } else if (this.productoSeleccionado.cantidadPistoleada > 0) {
      this.productoSeleccionado.estadoPistola = 'parcial';
    } else {
      this.productoSeleccionado.estadoPistola = 'no_pistoleado';
    }

    // Guardar en Firebase
    try {
      await this.updateProductoInFirebase(this.productoSeleccionado);
      
      // MODIFICADO: Mensaje según la operación
      const signo = this.operacionModal === 'sumar' ? '+' : '-';
      const emoji = this.operacionModal === 'sumar' ? '✅' : '➖';
      
      this.showNotification(
        `${emoji} ${this.productoSeleccionado.referencia}: ${signo}${cantidad} (Total: ${this.productoSeleccionado.cantidadPistoleada}/${this.productoSeleccionado.cantidad})`,
        'success'
      );
    } catch (error) {
      console.error('Error guardando en Firebase:', error);
      this.showNotification('Error al guardar en la base de datos', 'error');
    }

    this.closeCantidadModal();
    this.updateStats();
    this.filterProducts();
  }

  closeCantidadModal(): void {
    this.showCantidadModal = false;
    this.productoSeleccionado = null;
    this.cantidadIngresada = 1;
    this.operacionModal = 'sumar'; // NUEVO: Resetear a sumar por defecto
  }

  // ========== ACCIONES DE PRODUCTO ==========

  marcarPistoleado(producto: Producto): void {
    this.productoSeleccionado = producto;
    this.cantidadIngresada = producto.cantidad - producto.cantidadPistoleada;
    if (this.cantidadIngresada < 1) this.cantidadIngresada = 1;
    this.operacionModal = 'sumar';
    this.showCantidadModal = true;
  }

  async desmarcarPistoleado(producto: Producto): Promise<void> {
    if (confirm(`¿Desmarcar "${producto.referencia}" como no pistoleado?`)) {
      producto.cantidadPistoleada = 0;
      producto.estadoPistola = 'no_pistoleado';
      producto.fechaPistoleado = undefined;
      
      try {
        await this.updateProductoInFirebase(producto);
        this.showNotification(`✅ ${producto.referencia} desmarcado`, 'info');
      } catch (error) {
        console.error('Error actualizando en Firebase:', error);
        this.showNotification('Error al actualizar en la base de datos', 'error');
      }
      
      this.updateStats();
      this.filterProducts();
    }
  }

  verCodigoBarras(producto: Producto): void {
    this.productoBarcode = producto;
    this.showBarcodeModal = true;
  }

  closeBarcodeModal(): void {
    this.showBarcodeModal = false;
    this.productoBarcode = null;
  }

  private highlightProduct(id: string): void {
    setTimeout(() => {
      const element = document.getElementById(`producto-${id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('highlight-scan');
        setTimeout(() => element.classList.remove('highlight-scan'), 2000);
      }
    }, 100);
  }

  // ========== FILTRADO ==========

  onSearch(event: Event): void {
    this.searchTerm = (event.target as HTMLInputElement).value.toLowerCase();
    this.filterProducts();
  }

  onFilterChange(filtro: 'todos' | 'pistoleado' | 'no_pistoleado' | 'parcial'): void {
    this.filtroEstado = filtro;
    this.filterProducts();
  }

  filterProducts(): void {
    let filtered = [...this.productos];

    if (this.searchTerm) {
      filtered = filtered.filter(p =>
        p.producto.toLowerCase().includes(this.searchTerm) ||
        p.codigo.toLowerCase().includes(this.searchTerm) ||
        p.referencia.toLowerCase().includes(this.searchTerm) ||
        p.refe.toLowerCase().includes(this.searchTerm)
      );
    }

    if (this.filtroEstado !== 'todos') {
      filtered = filtered.filter(p => p.estadoPistola === this.filtroEstado);
    }

    this.productosFiltrados = filtered;
  }

  private updateStats(): void {
    this.stats.total = this.productos.length;
    this.stats.pistoleados = this.productos.filter(p => p.estadoPistola === 'pistoleado').length;
    this.stats.noPistoleados = this.productos.filter(p => p.estadoPistola === 'no_pistoleado').length;
    this.stats.parciales = this.productos.filter(p => p.estadoPistola === 'parcial').length;
    this.stats.porcentaje = this.stats.total > 0 
      ? Math.round((this.stats.pistoleados / this.stats.total) * 100) 
      : 0;
  }

  // ========== EXPORTACIÓN ==========

  exportarExcel(): void {
    const dataToExport = this.productos.map(p => ({
      'Producto': p.producto,
      'Código': p.codigo,
      'Referencia': p.referencia,
      'Combo': p.combo,
      'REFE': p.refe,
      'Cantidad Original': p.cantidad,
      'Cantidad Pistoleada': p.cantidadPistoleada,
      'Diferencia': p.cantidad - p.cantidadPistoleada,
      'U. Medida': p.uMedida,
      'Costo': p.costo,
      'Grupo II': p.grupoII,
      'Grupo III': p.grupoIII,
      'Estado Original': p.estado,
      'Estado Pistola': p.estadoPistola === 'pistoleado' ? 'PISTOLEADO' : 
                        p.estadoPistola === 'parcial' ? 'PARCIAL' : 'NO PISTOLEADO',
      'Fecha Pistoleado': p.fechaPistoleado ? new Date(p.fechaPistoleado).toLocaleString() : ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');

    // Ajustar anchos de columna
    const colWidths = [
      { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 15 },
      { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
      { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 20 }
    ];
    ws['!cols'] = colWidths;

    const fecha = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Inventario_Pistoleado_${fecha}.xlsx`);
  }

  exportarSoloPistoleados(): void {
    const pistoleados = this.productos.filter(p => p.estadoPistola !== 'no_pistoleado');
    
    const dataToExport = pistoleados.map(p => ({
      'Producto': p.producto,
      'Código': p.codigo,
      'Referencia': p.referencia,
      'Cantidad Original': p.cantidad,
      'Cantidad Pistoleada': p.cantidadPistoleada,
      'Estado': p.estadoPistola === 'pistoleado' ? 'COMPLETO' : 'PARCIAL',
      'Fecha': p.fechaPistoleado ? new Date(p.fechaPistoleado).toLocaleString() : ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pistoleados');

    const fecha = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Productos_Pistoleados_${fecha}.xlsx`);
  }

  // ========== IMPRESIÓN DE CÓDIGOS ==========

imprimirCodigosBarras(): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  // Configuración para etiquetas Zebra 6cm x 3.5cm
  const etiquetaAncho = 60; // mm
  const etiquetaAlto = 35;  // mm

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Códigos de Barras - SEGURILAB</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        @page {
          size: ${etiquetaAncho}mm ${etiquetaAlto}mm;
          margin: 0;
        }
        
        body { 
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
        }
        
        .etiqueta {
          width: ${etiquetaAncho}mm;
          height: ${etiquetaAlto}mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2mm 4mm;
          page-break-after: always;
          box-sizing: border-box;
        }
        
        .etiqueta:last-child {
          page-break-after: auto;
        }
        
        .barcode-item {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        
        .barcode-item img { 
          max-width: 90%;
          max-height: 24mm;
          height: auto;
          object-fit: contain;
        }
        
        .product-name {
          font-size: 8pt;
          font-weight: bold;
          margin-bottom: 2mm;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100%;
        }
        
        .product-code {
          font-size: 7pt;
          margin-top: 1mm;
        }
        
        @media print {
          body { -webkit-print-color-adjust: exact; }
          .etiqueta { border: none; }
        }
        
        /* Vista previa en pantalla */
        @media screen {
          body { 
            background: #f0f0f0; 
            padding: 10mm;
          }
          .etiqueta { 
            border: 1px dashed #999;
            background: white;
            margin-bottom: 5mm;
          }
        }
      </style>
    </head>
    <body>
  `;

  // Filtrar productos con código de barras
  const productosConBarcode = this.productos.filter(p => p.barcodeDataUrl);
  
  // 1 código por etiqueta
  productosConBarcode.forEach(p => {
    html += `
      <div class="etiqueta">
        <div class="barcode-item">
          <div class="product-name">${p.referencia || p.producto}</div>
          <img src="${p.barcodeDataUrl}" alt="${p.codigo}">
          <div class="product-code">${p.codigo}</div>
        </div>
      </div>
    `;
  });

  html += `
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 500);
}

  // ========== UTILIDADES ==========

  toggleScanner(): void {
    this.scannerEnabled = !this.scannerEnabled;
    this.showNotification(
      this.scannerEnabled ? '🔓 Scanner activado' : '🔒 Scanner desactivado',
      'info'
    );
  }

  async resetearTodo(): Promise<void> {
    if (confirm('¿Desea resetear todos los productos a "No Pistoleado"? Esto actualizará la base de datos.')) {
      this.loading = true;
      this.loadingMessage = 'Reseteando productos...';
      
      try {
        for (const producto of this.productos) {
          producto.cantidadPistoleada = 0;
          producto.estadoPistola = 'no_pistoleado';
          producto.fechaPistoleado = undefined;
          await this.updateProductoInFirebase(producto);
        }
        this.showNotification('✅ Todos los productos han sido reseteados', 'success');
      } catch (error) {
        console.error('Error reseteando productos:', error);
        this.showNotification('Error al resetear productos', 'error');
      }
      
      this.loading = false;
      this.loadingMessage = '';
      this.updateStats();
      this.filterProducts();
    }
  }

  limpiarArchivo(): void {
    // Solo resetear el estado del archivo para permitir subir otro Excel
    // NO elimina los productos de Firebase
    this.fileName = '';
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
    this.showNotification('📄 Puedes subir otro archivo Excel para agregar más productos', 'info');
  }

  async eliminarTodosLosProductos(): Promise<void> {
    if (!confirm('⚠️ ¿Estás SEGURO de eliminar TODOS los productos?\n\nEsta acción NO se puede deshacer.')) {
      return;
    }
    
    // Segunda confirmación
    if (!confirm('🚨 ÚLTIMA ADVERTENCIA:\n\nSe eliminarán ' + this.productos.length + ' productos de la base de datos.\n\n¿Continuar?')) {
      return;
    }

    this.loading = true;
    this.loadingMessage = 'Eliminando todos los productos...';
    
    try {
      const productosRef = ref(this.database, 'productos_contabilidad');
      await remove(productosRef);
      
      this.productos = [];
      this.productosFiltrados = [];
      this.fileLoaded = false;
      this.fileName = '';
      this.updateStats();
      this.showNotification('✅ Todos los productos han sido eliminados', 'success');
    } catch (error) {
      console.error('Error eliminando productos:', error);
      this.showNotification('Error al eliminar productos', 'error');
    }
    
    this.loading = false;
    this.loadingMessage = '';
  }

  async eliminarProducto(producto: Producto): Promise<void> {
    if (confirm(`¿Eliminar el producto "${producto.referencia}" (${producto.codigo})?`)) {
      try {
        await this.deleteProductoFromFirebase(producto.id);
        this.showNotification(`✅ Producto ${producto.codigo} eliminado`, 'success');
      } catch (error) {
        console.error('Error eliminando producto:', error);
        this.showNotification('Error al eliminar el producto', 'error');
      }
    }
  }

  closeImportResultModal(): void {
    this.showImportResultModal = false;
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info'): void {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 25px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      animation: slideIn 0.3s ease;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    `;

    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'pistoleado': return 'estado-pistoleado';
      case 'parcial': return 'estado-parcial';
      default: return 'estado-no-pistoleado';
    }
  }

  getEstadoLabel(estado: string): string {
    switch (estado) {
      case 'pistoleado': return '✅ Pistoleado';
      case 'parcial': return '⚠️ Parcial';
      default: return '⏳ No Pistoleado';
    }
  }
}