// src/app/pages/difusiones/difusiones.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Contacto {
  telefono: string;
  nombre?: string;
  seleccionado: boolean;
}

@Component({
  selector: 'app-difusiones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './difusiones.component.html',
  styleUrl: './difusiones.component.css'
})
export class DifusionesComponent implements OnInit, OnDestroy {

  // ========== ESTADO DE CONEXIÓN WHATSAPP ==========
  whatsappConectado = false;
  qrCodeUrl: string | null = null; // URL o base64 del QR
  estadoConexion: 'desconectado' | 'esperando_qr' | 'escaneando' | 'conectado' = 'desconectado';
  mensajeEstado = 'No conectado';

  // ========== CONTACTOS ==========
  contactos: Contacto[] = [];
  contactosFiltrados: Contacto[] = [];
  busquedaContacto = '';
  todosSeleccionados = false;

  // ========== MENSAJE ==========
  mensajeTexto = '';
  imagenAdjunta: File | null = null;
  imagenPreview: string | null = null;

  // ========== ENVÍO ==========
  enviando = false;
  progresoEnvio = 0;
  mensajesEnviados = 0;
  mensajesFallidos = 0;

  // ========== HISTORIAL ==========
  historialEnvios: any[] = [];

  constructor() {}

  ngOnInit(): void {
    // TODO: Inicializar conexión con backend de WhatsApp
    this.cargarHistorial();
  }

  ngOnDestroy(): void {
    // TODO: Limpiar conexiones
  }

  // ========== CONEXIÓN WHATSAPP ==========

  iniciarConexionWhatsApp(): void {
    // TODO: Llamar al backend para obtener QR
    console.log('🔄 Iniciando conexión WhatsApp...');
    this.estadoConexion = 'esperando_qr';
    this.mensajeEstado = 'Generando código QR...';
    
    // Simulación - reemplazar con llamada real al backend
    setTimeout(() => {
      this.estadoConexion = 'escaneando';
      this.mensajeEstado = 'Escanea el código QR con WhatsApp';
      // this.qrCodeUrl = 'URL_DEL_QR_DESDE_BACKEND';
    }, 1000);
  }

  desconectarWhatsApp(): void {
    // TODO: Llamar al backend para desconectar
    console.log('🔌 Desconectando WhatsApp...');
    this.whatsappConectado = false;
    this.estadoConexion = 'desconectado';
    this.mensajeEstado = 'Desconectado';
    this.qrCodeUrl = null;
  }

  // Simular conexión exitosa (para desarrollo)
  simularConexionExitosa(): void {
    this.whatsappConectado = true;
    this.estadoConexion = 'conectado';
    this.mensajeEstado = 'Conectado correctamente';
    this.qrCodeUrl = null;
  }

  // ========== CARGA DE EXCEL ==========

  onArchivoExcel(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    
    if (!archivo) return;

    // Validar extensión
    const extension = archivo.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(extension || '')) {
      alert('Por favor sube un archivo Excel (.xlsx, .xls) o CSV');
      return;
    }

    console.log('📁 Archivo seleccionado:', archivo.name);
    
    // TODO: Procesar el archivo Excel
    // Usar librería como SheetJS (xlsx) para leer el archivo
    // Detectar automáticamente la columna de teléfonos
    this.procesarArchivoExcel(archivo);
  }

  private procesarArchivoExcel(archivo: File): void {
    // TODO: Implementar lectura real del Excel
    // Por ahora, datos de prueba
    console.log('📊 Procesando archivo:', archivo.name);
    
    // Simulación de contactos extraídos
    const contactosPrueba: Contacto[] = [
      { telefono: '593991234567', nombre: 'Juan Pérez', seleccionado: false },
      { telefono: '593987654321', nombre: 'María García', seleccionado: false },
      { telefono: '593912345678', nombre: 'Carlos López', seleccionado: false },
      { telefono: '593998765432', seleccionado: false },
      { telefono: '593976543210', nombre: 'Ana Rodríguez', seleccionado: false },
    ];

    this.contactos = contactosPrueba;
    this.contactosFiltrados = [...this.contactos];
    
    alert(`✅ Se encontraron ${this.contactos.length} contactos en el archivo`);
  }

  // ========== GESTIÓN DE CONTACTOS ==========

  filtrarContactos(): void {
    const busqueda = this.busquedaContacto.toLowerCase().trim();
    
    if (!busqueda) {
      this.contactosFiltrados = [...this.contactos];
    } else {
      this.contactosFiltrados = this.contactos.filter(c => 
        c.telefono.includes(busqueda) || 
        c.nombre?.toLowerCase().includes(busqueda)
      );
    }
  }

  toggleSeleccionTodos(): void {
    this.todosSeleccionados = !this.todosSeleccionados;
    this.contactosFiltrados.forEach(c => c.seleccionado = this.todosSeleccionados);
  }

  get contactosSeleccionados(): Contacto[] {
    return this.contactos.filter(c => c.seleccionado);
  }

  eliminarContacto(contacto: Contacto): void {
    this.contactos = this.contactos.filter(c => c.telefono !== contacto.telefono);
    this.filtrarContactos();
  }

  limpiarContactos(): void {
    if (confirm('¿Eliminar todos los contactos?')) {
      this.contactos = [];
      this.contactosFiltrados = [];
    }
  }

  // ========== MENSAJE E IMAGEN ==========

  onImagenSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    
    if (!archivo) return;

    // Validar tipo
    if (!archivo.type.startsWith('image/')) {
      alert('Solo se permiten imágenes');
      return;
    }

    this.imagenAdjunta = archivo;
    
    // Preview
    const reader = new FileReader();
    reader.onload = (e) => {
      this.imagenPreview = e.target?.result as string;
    };
    reader.readAsDataURL(archivo);
  }

  eliminarImagen(): void {
    this.imagenAdjunta = null;
    this.imagenPreview = null;
  }

  // ========== ENVÍO DE MENSAJES ==========

  iniciarEnvio(): void {
    if (!this.whatsappConectado) {
      alert('Primero conecta WhatsApp');
      return;
    }

    if (this.contactosSeleccionados.length === 0) {
      alert('Selecciona al menos un contacto');
      return;
    }

    if (!this.mensajeTexto.trim() && !this.imagenAdjunta) {
      alert('Escribe un mensaje o adjunta una imagen');
      return;
    }

    if (!confirm(`¿Enviar mensaje a ${this.contactosSeleccionados.length} contactos?`)) {
      return;
    }

    this.enviando = true;
    this.progresoEnvio = 0;
    this.mensajesEnviados = 0;
    this.mensajesFallidos = 0;

    // TODO: Implementar envío real
    console.log('📤 Iniciando envío masivo...');
    console.log('Contactos:', this.contactosSeleccionados);
    console.log('Mensaje:', this.mensajeTexto);
    console.log('Imagen:', this.imagenAdjunta?.name);

    this.simularEnvio();
  }

  private simularEnvio(): void {
    // Simulación de envío - reemplazar con lógica real
    const total = this.contactosSeleccionados.length;
    let enviados = 0;

    const intervalo = setInterval(() => {
      enviados++;
      this.progresoEnvio = Math.round((enviados / total) * 100);
      
      // Simular éxito/fallo aleatorio
      if (Math.random() > 0.1) {
        this.mensajesEnviados++;
      } else {
        this.mensajesFallidos++;
      }

      if (enviados >= total) {
        clearInterval(intervalo);
        this.enviando = false;
        this.guardarEnHistorial();
        alert(`✅ Envío completado!\nEnviados: ${this.mensajesEnviados}\nFallidos: ${this.mensajesFallidos}`);
      }
    }, 500);
  }

  cancelarEnvio(): void {
    // TODO: Implementar cancelación real
    this.enviando = false;
    alert('Envío cancelado');
  }

  // ========== HISTORIAL ==========

  private cargarHistorial(): void {
    // TODO: Cargar desde localStorage o backend
    const historialGuardado = localStorage.getItem('historial_difusiones');
    if (historialGuardado) {
      this.historialEnvios = JSON.parse(historialGuardado);
    }
  }

  private guardarEnHistorial(): void {
    const registro = {
      fecha: new Date().toISOString(),
      contactos: this.contactosSeleccionados.length,
      enviados: this.mensajesEnviados,
      fallidos: this.mensajesFallidos,
      mensaje: this.mensajeTexto.substring(0, 50) + '...',
      conImagen: !!this.imagenAdjunta
    };

    this.historialEnvios.unshift(registro);
    
    // Mantener solo últimos 20 registros
    if (this.historialEnvios.length > 20) {
      this.historialEnvios = this.historialEnvios.slice(0, 20);
    }

    localStorage.setItem('historial_difusiones', JSON.stringify(this.historialEnvios));
  }

  limpiarHistorial(): void {
    if (confirm('¿Eliminar todo el historial?')) {
      this.historialEnvios = [];
      localStorage.removeItem('historial_difusiones');
    }
  }

  // ========== UTILIDADES ==========

  formatearTelefono(telefono: string): string {
    // Formato: +593 99 123 4567
    if (telefono.length >= 12) {
      return `+${telefono.slice(0,3)} ${telefono.slice(3,5)} ${telefono.slice(5,8)} ${telefono.slice(8)}`;
    }
    return telefono;
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleString('es-EC', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}