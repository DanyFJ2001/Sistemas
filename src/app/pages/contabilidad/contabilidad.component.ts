// src/app/pages/contabilidad/contabilidad.component.ts
import { Component, OnInit, OnDestroy, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import * as XLSX from 'xlsx';
import JsBarcode from 'jsbarcode';
import { HttpClient, HttpHeaders } from '@angular/common/http';

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

export interface ProductoFactura {
  nombre: string;
  codigo?: string;
  cantidad: number;
  precio?: number;
  total?: number;
}

@Component({
  selector: 'app-contabilidad',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './contabilidad.component.html',
  styleUrl: './contabilidad.component.scss'
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
  operacionModal: 'sumar' | 'restar' = 'restar';
  cantidadMaximaDisponible: number = 0;

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

  // Modal de factura
  showFacturaModal = false;
  facturaFile: File | null = null;
  loadingFactura = false;
  productosDetectados: ProductoFactura[] = [];
  facturaFileName = '';

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

  // API Key para OpenRouter
  private readonly OPENROUTER_API_KEY = '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'; // Reemplazar con tu API key

  constructor(private http: HttpClient) {
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
            uMedida: this.parseUnidadMedida(prod.uMedida),
            costo: prod.costo || 0,
            grupoII: prod.grupoII || '',
            grupoIII: prod.grupoIII || '',
            estado: prod.estado || 'Activo',
            estadoPistola: prod.estadoPistola || 'no_pistoleado',
            fechaPistoleado: prod.fechaPistoleado || undefined,
            createdAt: prod.createdAt || new Date().toISOString(),
            updatedAt: prod.updatedAt || new Date().toISOString()
          };
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
      barcodeDataUrl: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
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

  // ========== PARSEO SEGURO DE NÚMEROS ==========

  private parseCantidadSegura(value: any): number {
    if (value === null || value === undefined || value === '') return 0;
    
    // Si ya es un número, redondearlo a 2 decimales
    if (typeof value === 'number') {
      return Math.round(value * 100) / 100;
    }
    
    // Si es string, limpiar y convertir
    const cleanValue = value.toString()
      .replace(',', '.') // Reemplazar coma decimal por punto
      .replace(/[^\d.-]/g, ''); // Eliminar caracteres no numéricos excepto punto y menos
    
    const numero = parseFloat(cleanValue);
    
    // Validar que sea un número válido
    if (isNaN(numero)) return 0;
    
    // Redondear a 2 decimales para evitar imprecisiones de punto flotante
    return Math.round(numero * 100) / 100;
  }

  // ========== PARSEO SEGURO DE UNIDAD DE MEDIDA ==========

  private parseUnidadMedida(value: any): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    
    const texto = value.toString().trim();
    
    // Si es un número puro, NO es una unidad de medida válida
    if (!isNaN(parseFloat(texto)) && isFinite(Number(texto))) {
      return '';
    }
    
    // Si está vacío o solo tiene espacios
    if (texto.length === 0) {
      return '';
    }
    
    // Retornar el texto en mayúsculas
    return texto.toUpperCase();
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

    const headers = data[0].map((h: string) => h?.toString().toLowerCase().trim() || '');
    
    const columnMap: { [key: string]: number } = {};
    
    // Mapeo mejorado de columnas
    headers.forEach((header: string, index: number) => {
      const headerLower = header.toLowerCase().trim();
      
      if (headerLower.includes('producto') && !headerLower.includes('codigo')) {
        columnMap['producto'] = index;
      } else if (headerLower.includes('codigo') || headerLower.includes('código')) {
        columnMap['codigo'] = index;
      } else if (headerLower.includes('referencia')) {
        columnMap['referencia'] = index;
      } else if (headerLower.includes('combo')) {
        columnMap['combo'] = index;
      } else if (headerLower === 'refe') {
        columnMap['refe'] = index;
      } else if (headerLower.includes('cantidad') && !headerLower.includes('pistol')) {
        columnMap['cantidad'] = index;
      } else if (headerLower.includes('medida') || headerLower.includes('u.') || headerLower === 'um' || headerLower === 'unidad') {
        columnMap['u. medida'] = index;
      } else if (headerLower.includes('costo') || headerLower.includes('precio')) {
        columnMap['costo'] = index;
      } else if (headerLower.includes('grupo ii') || headerLower === 'grupoii' || headerLower === 'grupo 2') {
        columnMap['grupo ii'] = index;
      } else if (headerLower.includes('grupo iii') || headerLower === 'grupoiii' || headerLower === 'grupo 3') {
        columnMap['grupo iii'] = index;
      } else if (headerLower === 'estado') {
        columnMap['estado'] = index;
      }
    });

    console.log('📋 Headers encontrados:', headers);
    console.log('📋 Mapeo de columnas detectado:', columnMap);

    this.importResult = { nuevos: 0, existentes: 0, errores: 0 };

    const productosNuevos: Producto[] = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      // Obtener código de la columna mapeada o índice 1 por defecto
      const codigoIndex = columnMap['codigo'] ?? 1;
      const codigo = row[codigoIndex]?.toString().trim() || '';
      
      if (!codigo) continue;
      
      if (this.productoExisteEnFirebase(codigo)) {
        this.importResult.existentes++;
        console.log(`⏭️ Producto ya existe: ${codigo}`);
        continue;
      }

      // Obtener unidad de medida y validar
      const uMedidaIndex = columnMap['u. medida'];
      const uMedidaRaw = uMedidaIndex !== undefined ? row[uMedidaIndex] : '';
      const uMedida = this.parseUnidadMedida(uMedidaRaw);

      const producto: Producto = {
        id: '',
        producto: row[columnMap['producto'] ?? 0]?.toString() || '',
        codigo: codigo,
        referencia: row[columnMap['referencia'] ?? 2]?.toString() || '',
        combo: row[columnMap['combo'] ?? 3]?.toString() || '',
        refe: row[columnMap['refe'] ?? 4]?.toString() || '',
        cantidad: this.parseCantidadSegura(row[columnMap['cantidad'] ?? 5]),
        cantidadPistoleada: 0,
        uMedida: uMedida,
        costo: this.parseCantidadSegura(row[columnMap['costo'] ?? 7]),
        grupoII: row[columnMap['grupo ii'] ?? 8]?.toString() || '',
        grupoIII: row[columnMap['grupo iii'] ?? 9]?.toString() || '',
        estado: row[columnMap['estado'] ?? 10]?.toString() || 'Activo',
        estadoPistola: 'no_pistoleado'
      };

      productosNuevos.push(producto);
    }

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
    this.showImportResultModal = true;
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
      
      // Calcular cantidad disponible para pistolar
      this.cantidadMaximaDisponible = producto.cantidad - producto.cantidadPistoleada;
      this.cantidadIngresada = Math.min(1, this.cantidadMaximaDisponible);
      
      this.operacionModal = 'restar'; // Por defecto restar (pistolar)
      this.showCantidadModal = true;
      this.highlightProduct(producto.id);
    } else {
      this.playErrorSound();
      this.showNotification(`Código no encontrado: ${cleanCode}`, 'error');
    }
  }

  // ========== MODAL DE CANTIDAD ==========

  setOperacion(op: 'sumar' | 'restar'): void {
    this.operacionModal = op;
    
    if (!this.productoSeleccionado) return;
    
    if (op === 'restar') {
      // Al pistolar (restar), máximo lo que queda disponible
      this.cantidadMaximaDisponible = this.productoSeleccionado.cantidad - this.productoSeleccionado.cantidadPistoleada;
      this.cantidadIngresada = Math.min(1, this.cantidadMaximaDisponible);
    } else {
      // Al devolver (sumar), máximo lo que ya fue pistoleado
      this.cantidadMaximaDisponible = this.productoSeleccionado.cantidadPistoleada;
      this.cantidadIngresada = Math.min(1, this.cantidadMaximaDisponible);
    }
    
    if (this.cantidadIngresada < 1 && this.cantidadMaximaDisponible > 0) {
      this.cantidadIngresada = 1;
    }
  }

  calcularResultado(): number {
    if (!this.productoSeleccionado) return 0;
    
    if (this.operacionModal === 'restar') {
      // Pistolar: aumenta cantidadPistoleada
      return this.productoSeleccionado.cantidadPistoleada + this.cantidadIngresada;
    } else {
      // Devolver: disminuye cantidadPistoleada
      return Math.max(0, this.productoSeleccionado.cantidadPistoleada - this.cantidadIngresada);
    }
  }

  async confirmarCantidad(): Promise<void> {
    if (!this.productoSeleccionado) return;

    const cantidad = this.cantidadIngresada || 1;
    
    // Validaciones según la operación
    if (this.operacionModal === 'restar') {
      // Pistolar: no puede exceder cantidad disponible
      const disponible = this.productoSeleccionado.cantidad - this.productoSeleccionado.cantidadPistoleada;
      if (cantidad > disponible) {
        this.showNotification(`⚠️ Solo hay ${disponible} unidades disponibles para pistolar`, 'error');
        return;
      }
      this.productoSeleccionado.cantidadPistoleada += cantidad;
    } else {
      // Devolver: no puede exceder lo pistoleado
      if (cantidad > this.productoSeleccionado.cantidadPistoleada) {
        this.showNotification(`⚠️ Solo hay ${this.productoSeleccionado.cantidadPistoleada} unidades pistoleadas`, 'error');
        return;
      }
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

    try {
      await this.updateProductoInFirebase(this.productoSeleccionado);
      
      const signo = this.operacionModal === 'restar' ? '📦' : '↩️';
      const accion = this.operacionModal === 'restar' ? 'Pistoleado' : 'Devuelto';
      
      this.showNotification(
        `${signo} ${accion}: ${this.productoSeleccionado.referencia} x${cantidad} (${this.productoSeleccionado.cantidadPistoleada}/${this.productoSeleccionado.cantidad})`,
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
    this.operacionModal = 'restar';
    this.cantidadMaximaDisponible = 0;
  }

  // ========== ACCIONES DE PRODUCTO ==========

  marcarPistoleado(producto: Producto): void {
    this.productoSeleccionado = producto;
    this.cantidadMaximaDisponible = producto.cantidad - producto.cantidadPistoleada;
    this.cantidadIngresada = Math.min(1, this.cantidadMaximaDisponible);
    if (this.cantidadIngresada < 1 && this.cantidadMaximaDisponible > 0) {
      this.cantidadIngresada = 1;
    }
    this.operacionModal = 'restar';
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

  // ========== PROCESAMIENTO DE FACTURAS CON IA ==========

  abrirModalFactura(): void {
    this.showFacturaModal = true;
    this.productosDetectados = [];
    this.facturaFile = null;
    this.facturaFileName = '';
  }

  onFacturaSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    this.facturaFile = input.files[0];
    this.facturaFileName = this.facturaFile.name;
  }

  async procesarFactura(): Promise<void> {
    if (!this.facturaFile) {
      this.showNotification('Por favor selecciona una factura PDF', 'error');
      return;
    }

    this.loadingFactura = true;
    this.loadingMessage = 'Procesando factura con IA...';

    try {
      // Convertir PDF a base64
      const base64 = await this.convertirPdfABase64(this.facturaFile);
      
      // Llamar a la API de OpenRouter para análisis
      const productosDetectados = await this.analizarFacturaConIA(base64);
      
      this.productosDetectados = productosDetectados;
      this.loadingFactura = false;
      this.loadingMessage = '';
      
      if (productosDetectados.length === 0) {
        this.showNotification('No se detectaron productos en la factura', 'error');
      } else {
        this.showNotification(`✅ ${productosDetectados.length} productos detectados`, 'success');
      }
    } catch (error) {
      console.error('Error procesando factura:', error);
      this.loadingFactura = false;
      this.loadingMessage = '';
      this.showNotification('Error al procesar la factura con IA', 'error');
    }
  }

  private convertirPdfABase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Extraer solo la parte base64 (después de "data:application/pdf;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private async analizarFacturaConIA(base64Pdf: string): Promise<ProductoFactura[]> {
    // Primero extraer texto del PDF
    const textoPdf = await this.extraerTextoPdf(base64Pdf);
    
    if (!textoPdf || textoPdf.trim().length < 50) {
      console.error('No se pudo extraer texto del PDF');
      throw new Error('El PDF no contiene texto extraíble. Intenta con un PDF que no sea imagen escaneada.');
    }

    console.log('📄 Texto extraído del PDF:', textoPdf.substring(0, 500) + '...');

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://segurilab.com',
      'X-Title': 'SeguriLab Inventory'
    });

    const prompt = `Analiza el siguiente texto de una factura y extrae ÚNICAMENTE los productos con sus cantidades.

TEXTO DE LA FACTURA:
---
${textoPdf}
---

Devuelve SOLO un JSON con este formato exacto (sin explicaciones adicionales):
{
  "productos": [
    {
      "nombre": "descripción del producto",
      "codigo": "código del producto",
      "cantidad": número,
      "precio": número,
      "total": número
    }
  ]
}

Reglas importantes:
- Solo productos/artículos comprados
- NO incluir: subtotales, IVA, descuentos, totales, servicios
- La cantidad debe ser un número
- Si no encuentras productos, devuelve: {"productos": []}`;

    // Lista de modelos GRATUITOS a intentar (actualizados enero 2026)
    const modelos = [
      'deepseek/deepseek-chat:free',                              // DeepSeek V3 - muy bueno
      'deepseek/deepseek-r1-distill-llama-70b:free',              // DeepSeek R1
      'nvidia/nemotron-3-nano-30b-a3b:free',  
      "openai/gpt-oss-120b" ,                   // Nvidia Nemotron
                              // Llama 4
      'google/gemini-2.0-flash-exp:free'                          // Gemini (backup)
    ];

    let ultimoError: any = null;

    for (const modelo of modelos) {
      try {
        console.log(`🤖 Intentando con modelo: ${modelo}`);
        
        const body = {
          model: modelo,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 2000
        };

        const response = await this.http.post<any>(
          'https://openrouter.ai/api/v1/chat/completions',
          body,
          { headers }
        ).toPromise();

        // Verificar que hay respuesta
        if (!response?.choices?.[0]?.message?.content) {
          console.warn(`⚠️ Modelo ${modelo} devolvió respuesta vacía`);
          continue;
        }

        const contenido = response.choices[0].message.content;
        console.log('📝 Respuesta de IA:', contenido);

        // Verificar que el contenido no esté vacío
        if (!contenido || contenido.trim().length < 10) {
          console.warn(`⚠️ Modelo ${modelo} devolvió contenido muy corto o vacío`);
          continue;
        }
        
        // Limpiar la respuesta (eliminar markdown si existe)
        let jsonText = contenido.trim();
        
        // Buscar el JSON en la respuesta
        const jsonMatch = jsonText.match(/\{[\s\S]*"productos"[\s\S]*\}/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        }

        // Verificar que tenemos algo que parsear
        if (!jsonText || jsonText.length < 10) {
          console.warn(`⚠️ No se encontró JSON válido en la respuesta de ${modelo}`);
          continue;
        }
        
        const resultado = JSON.parse(jsonText);
        console.log('✅ Productos detectados:', resultado.productos);
        return resultado.productos || [];
        
      } catch (error: any) {
        const errorMsg = error.status || error.message || 'Error desconocido';
        console.warn(`⚠️ Error con modelo ${modelo}:`, errorMsg);
        ultimoError = error;
        
        // Si es error 429 (rate limit), esperar un poco antes del siguiente
        if (error.status === 429) {
          console.log('⏳ Rate limit alcanzado, esperando 2s antes de probar siguiente modelo...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Continuar con el siguiente modelo
        continue;
      }
    }

    // Si ningún modelo funcionó
    console.error('❌ Todos los modelos fallaron');
    throw ultimoError || new Error('No se pudo procesar la factura con ningún modelo disponible');
  }

  // Método para extraer texto de un PDF usando pdf.js (cargado dinámicamente)
  private async extraerTextoPdf(base64Pdf: string): Promise<string> {
    try {
      // Cargar pdf.js dinámicamente si no está disponible
      if (!(window as any).pdfjsLib) {
        await this.cargarPdfJs();
      }

      const pdfjsLib = (window as any).pdfjsLib;
      
      // Convertir base64 a ArrayBuffer
      const binaryString = atob(base64Pdf);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Cargar el PDF
      const loadingTask = pdfjsLib.getDocument({ data: bytes });
      const pdf = await loadingTask.promise;

      let textoCompleto = '';

      // Extraer texto de cada página
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        textoCompleto += pageText + '\n';
      }

      return textoCompleto;
    } catch (error) {
      console.error('Error extrayendo texto del PDF:', error);
      return '';
    }
  }

  // Cargar pdf.js desde CDN
  private cargarPdfJs(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Verificar si ya está cargado
      if ((window as any).pdfjsLib) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        const pdfjsLib = (window as any).pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        console.log('✅ PDF.js cargado correctamente');
        resolve();
      };
      script.onerror = () => reject(new Error('No se pudo cargar PDF.js'));
      document.head.appendChild(script);
    });
  }

  async aplicarProductosDetectados(): Promise<void> {
    if (this.productosDetectados.length === 0) {
      this.showNotification('No hay productos detectados para aplicar', 'error');
      return;
    }

    this.loadingFactura = true;
    this.loadingMessage = 'Aplicando productos detectados...';

    let aplicados = 0;
    let noEncontrados: string[] = [];

    for (const prodFactura of this.productosDetectados) {
      // Buscar producto en inventario por código o nombre
      const productoEncontrado = this.buscarProductoPorNombre(prodFactura);
      
      if (productoEncontrado) {
        // Aumentar la cantidad
        productoEncontrado.cantidad += prodFactura.cantidad;
        
        try {
          await this.updateProductoInFirebase(productoEncontrado);
          aplicados++;
        } catch (error) {
          console.error('Error actualizando producto:', productoEncontrado.codigo, error);
        }
      } else {
        noEncontrados.push(`${prodFactura.nombre} (${prodFactura.codigo || 'sin código'})`);
      }
    }

    this.loadingFactura = false;
    this.loadingMessage = '';
    this.closeFacturaModal();

    if (aplicados > 0) {
      this.showNotification(`✅ ${aplicados} productos actualizados`, 'success');
    }
    
    if (noEncontrados.length > 0) {
      console.warn('Productos no encontrados:', noEncontrados);
      this.showNotification(`⚠️ ${noEncontrados.length} productos no encontrados en inventario`, 'error');
    }

    this.updateStats();
    this.filterProducts();
  }

  private buscarProductoPorNombre(prodFactura: ProductoFactura): Producto | null {
    const nombreLimpio = this.limpiarTexto(prodFactura.nombre);
    const codigoLimpio = prodFactura.codigo ? this.limpiarTexto(prodFactura.codigo) : '';
    
    // Búsqueda por código primero (más precisa)
    if (codigoLimpio) {
      const porCodigo = this.productos.find(p => 
        this.limpiarTexto(p.codigo) === codigoLimpio ||
        this.limpiarTexto(p.codigo).includes(codigoLimpio) ||
        codigoLimpio.includes(this.limpiarTexto(p.codigo))
      );
      if (porCodigo) {
        console.log(`✅ Encontrado por código: ${prodFactura.codigo} -> ${porCodigo.codigo}`);
        return porCodigo;
      }
    }
    
    // Búsqueda exacta por nombre
    let encontrado = this.productos.find(p => 
      this.limpiarTexto(p.producto) === nombreLimpio ||
      this.limpiarTexto(p.referencia) === nombreLimpio
    );

    if (encontrado) {
      console.log(`✅ Encontrado por nombre exacto: ${prodFactura.nombre} -> ${encontrado.referencia}`);
      return encontrado;
    }

    // Búsqueda por similitud (contiene)
    encontrado = this.productos.find(p => 
      this.limpiarTexto(p.producto).includes(nombreLimpio) ||
      nombreLimpio.includes(this.limpiarTexto(p.producto)) ||
      this.limpiarTexto(p.referencia).includes(nombreLimpio) ||
      nombreLimpio.includes(this.limpiarTexto(p.referencia))
    );

    if (encontrado) {
      console.log(`✅ Encontrado por similitud: ${prodFactura.nombre} -> ${encontrado.referencia}`);
    } else {
      console.log(`❌ No encontrado: ${prodFactura.nombre} (${prodFactura.codigo || 'sin código'})`);
    }

    return encontrado || null;
  }

  private limpiarTexto(texto: string): string {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
      .replace(/[^a-z0-9\s]/g, '') // Solo letras, números y espacios
      .trim();
  }

  closeFacturaModal(): void {
    this.showFacturaModal = false;
    this.facturaFile = null;
    this.facturaFileName = '';
    this.productosDetectados = [];
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

    const etiquetaAncho = 60;
    const etiquetaAlto = 35;

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

    const productosConBarcode = this.productos.filter(p => p.barcodeDataUrl);
    
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
      case 'pistoleado': return 'pistoleado';
      case 'parcial': return 'parcial';
      default: return 'no_pistoleado';
    }
  }

  getEstadoLabel(estado: string): string {
    switch (estado) {
      case 'pistoleado': return '✅ Pistoleado';
      case 'parcial': return '⚠️ Parcial';
      default: return '⏳ Pendiente';
    }
  }

  // Método para formatear números sin decimales innecesarios
  formatNumber(num: number): string {
    // Si el número es entero, mostrar sin decimales
    if (Number.isInteger(num)) {
      return num.toString();
    }
    // Si tiene decimales, mostrar máximo 2
    return num.toFixed(2).replace(/\.?0+$/, '');
  }
}