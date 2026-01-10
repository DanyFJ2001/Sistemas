// src/app/pages/bases-contactos/bases-contactos.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ContactosService, BaseContactos, Contacto } from '../../services/contactos.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-bases-contactos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contactos.component.html',
  styleUrl: './contactos.component.css'
})
export class BasesContactosComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // ========== ESTADO ==========
  loading = true;
  guardando = false;
  procesandoExcel = false;

  // ========== BASES ==========
  bases: BaseContactos[] = [];
  basesFiltradas: BaseContactos[] = [];
  busqueda = '';

  // ========== MODAL NUEVA BASE ==========
  showModal = false;
  nombreBase = '';
  descripcionBase = '';
  contactosExtraidos: Contacto[] = [];
  archivoSeleccionado: File | null = null;
  columnasDetectadas: string[] = [];
  columnaSeleccionada = '';
  columnaNombre = '';
  previewData: any[] = [];

  // ========== MODAL VER BASE ==========
  showViewModal = false;
  baseSeleccionada: BaseContactos | null = null;

  // ========== ESTADÍSTICAS ==========
  stats = {
    totalBases: 0,
    totalContactos: 0
  };

  constructor(private contactosService: ContactosService) {}

  ngOnInit(): void {
    this.cargarBases();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ========== CARGAR BASES ==========
  cargarBases(): void {
    this.loading = true;
    
    this.contactosService.getBases()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (bases) => {
          this.bases = bases;
          this.filtrarBases();
          this.calcularStats();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error cargando bases:', error);
          this.loading = false;
        }
      });
  }

  filtrarBases(): void {
    if (!this.busqueda.trim()) {
      this.basesFiltradas = [...this.bases];
    } else {
      this.basesFiltradas = this.contactosService.buscarBases(this.busqueda);
    }
  }

  calcularStats(): void {
    this.stats.totalBases = this.bases.length;
    this.stats.totalContactos = this.bases.reduce((sum, base) => sum + base.totalContactos, 0);
  }

  // ========== MODAL NUEVA BASE ==========
  abrirModal(): void {
    this.showModal = true;
    this.limpiarFormulario();
  }

  cerrarModal(): void {
    this.showModal = false;
    this.limpiarFormulario();
  }

  limpiarFormulario(): void {
    this.nombreBase = '';
    this.descripcionBase = '';
    this.contactosExtraidos = [];
    this.archivoSeleccionado = null;
    this.columnasDetectadas = [];
    this.columnaSeleccionada = '';
    this.columnaNombre = '';
    this.previewData = [];
  }

  // ========== PROCESAR EXCEL ==========
  onArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    
    if (!archivo) return;

    const extension = archivo.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(extension || '')) {
      alert('Por favor sube un archivo Excel (.xlsx, .xls) o CSV');
      return;
    }

    this.archivoSeleccionado = archivo;
    this.procesandoExcel = true;
    this.procesarExcel(archivo);
  }

  private procesarExcel(archivo: File): void {
    const reader = new FileReader();
    
    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Tomar la primera hoja
        const primeraHoja = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[primeraHoja];
        
        // Convertir a JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length === 0) {
          alert('El archivo está vacío');
          this.procesandoExcel = false;
          return;
        }

        // Primera fila son los headers
        const headers = jsonData[0] as string[];
        this.columnasDetectadas = headers.map((h, i) => h?.toString() || `Columna ${i + 1}`);
        
        // Datos para preview (primeras 5 filas)
        this.previewData = jsonData.slice(1, 6).map(row => {
          const obj: any = {};
          headers.forEach((header, i) => {
            obj[header?.toString() || `col${i}`] = (row as any[])[i];
          });
          return obj;
        });

        // Intentar detectar automáticamente la columna de teléfono
        this.detectarColumnaTelefono(headers);
        
        // Guardar todos los datos para extraer después
        (this as any).datosCompletos = jsonData.slice(1); // Sin headers
        (this as any).headers = headers;

        console.log(`📊 Excel procesado: ${jsonData.length - 1} filas, ${headers.length} columnas`);
        this.procesandoExcel = false;
        
      } catch (error) {
        console.error('Error procesando Excel:', error);
        alert('Error al procesar el archivo. Verifica que sea un Excel válido.');
        this.procesandoExcel = false;
      }
    };

    reader.readAsArrayBuffer(archivo);
  }

  private detectarColumnaTelefono(headers: string[]): void {
    // Buscar columnas que parezcan teléfonos
    const palabrasClave = ['telefono', 'teléfono', 'phone', 'celular', 'movil', 'móvil', 'tel', 'whatsapp', 'numero', 'número'];
    
    for (const header of headers) {
      const headerLower = header?.toString().toLowerCase() || '';
      if (palabrasClave.some(palabra => headerLower.includes(palabra))) {
        this.columnaSeleccionada = header;
        console.log(`📱 Columna de teléfono detectada: ${header}`);
        break;
      }
    }

    // Buscar columna de nombre
    const palabrasNombre = ['nombre', 'name', 'cliente', 'contacto', 'razon', 'razón'];
    for (const header of headers) {
      const headerLower = header?.toString().toLowerCase() || '';
      if (palabrasNombre.some(palabra => headerLower.includes(palabra))) {
        this.columnaNombre = header;
        console.log(`👤 Columna de nombre detectada: ${header}`);
        break;
      }
    }
  }

  extraerContactos(): void {
    if (!this.columnaSeleccionada) {
      alert('Selecciona la columna que contiene los teléfonos');
      return;
    }

    const datosCompletos = (this as any).datosCompletos as any[];
    const headers = (this as any).headers as string[];
    const indexTelefono = headers.indexOf(this.columnaSeleccionada);
    const indexNombre = this.columnaNombre ? headers.indexOf(this.columnaNombre) : -1;

    if (indexTelefono === -1) {
      alert('No se encontró la columna seleccionada');
      return;
    }

    const contactos: Contacto[] = [];
    const telefonosUnicos = new Set<string>();

    datosCompletos.forEach((fila: any[]) => {
      const telefonoRaw = fila[indexTelefono]?.toString() || '';
      const telefono = this.contactosService.limpiarTelefono(telefonoRaw);
      
      // Validar y evitar duplicados
      if (this.contactosService.esTelefonoValido(telefono) && !telefonosUnicos.has(telefono)) {
        telefonosUnicos.add(telefono);
        
        const contacto: Contacto = {
          telefono: telefono,
          nombre: indexNombre >= 0 ? fila[indexNombre]?.toString() || '' : ''
        };
        
        contactos.push(contacto);
      }
    });

    this.contactosExtraidos = contactos;
    console.log(`✅ ${contactos.length} contactos extraídos (de ${datosCompletos.length} filas)`);
    
    if (contactos.length === 0) {
      alert('No se encontraron teléfonos válidos en la columna seleccionada');
    }
  }

  // ========== GUARDAR BASE ==========
  async guardarBase(): Promise<void> {
    if (!this.nombreBase.trim()) {
      alert('Ingresa un nombre para la base');
      return;
    }

    if (this.contactosExtraidos.length === 0) {
      alert('No hay contactos para guardar. Primero extrae los contactos del Excel.');
      return;
    }

    this.guardando = true;

    try {
      await this.contactosService.crearBase(
        this.nombreBase,
        this.contactosExtraidos,
        this.descripcionBase
      );
      
      alert(`✅ Base "${this.nombreBase}" guardada con ${this.contactosExtraidos.length} contactos`);
      this.cerrarModal();
      
    } catch (error) {
      console.error('Error guardando base:', error);
      alert('Error al guardar la base. Intenta de nuevo.');
    } finally {
      this.guardando = false;
    }
  }

  // ========== VER BASE ==========
  verBase(base: BaseContactos): void {
    this.baseSeleccionada = base;
    this.showViewModal = true;
  }

  cerrarViewModal(): void {
    this.showViewModal = false;
    this.baseSeleccionada = null;
  }

  // ========== ELIMINAR BASE ==========
  async eliminarBase(base: BaseContactos): Promise<void> {
    if (!confirm(`¿Eliminar la base "${base.nombre}" con ${base.totalContactos} contactos?`)) {
      return;
    }

    try {
      await this.contactosService.eliminarBase(base.id);
      alert('Base eliminada');
    } catch (error) {
      console.error('Error eliminando:', error);
      alert('Error al eliminar la base');
    }
  }

  // ========== UTILIDADES ==========
  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-EC', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatearTelefono(telefono: string): string {
    if (telefono.length >= 12) {
      return `+${telefono.slice(0,3)} ${telefono.slice(3,5)} ${telefono.slice(5,8)} ${telefono.slice(8)}`;
    }
    return telefono;
  }
}