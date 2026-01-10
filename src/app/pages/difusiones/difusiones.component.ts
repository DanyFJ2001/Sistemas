// src/app/pages/difusiones/difusiones.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ContactosService, BaseContactos, Contacto } from '../../services/contactos.service';

interface ContactoSeleccionable extends Contacto {
  seleccionado: boolean;
}

@Component({
  selector: 'app-difusiones',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './difusiones.component.html',
  styleUrl: './difusiones.component.css'
})
export class DifusionesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // ========== ESTADO DE CONEXIÓN WHATSAPP ==========
  whatsappConectado = false;
  qrCodeUrl: string | null = null;
  estadoConexion: 'desconectado' | 'esperando_qr' | 'escaneando' | 'conectado' = 'desconectado';
  mensajeEstado = 'No conectado';

  // ========== BASES DE CONTACTOS (desde Firebase) ==========
  basesDisponibles: BaseContactos[] = [];
  baseSeleccionadaId: string = '';
  baseSeleccionada: BaseContactos | null = null;
  cargandoBases = true;

  // ========== CONTACTOS DE LA BASE SELECCIONADA ==========
  contactos: ContactoSeleccionable[] = [];
  contactosFiltrados: ContactoSeleccionable[] = [];
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

  constructor(private contactosService: ContactosService) {}

  ngOnInit(): void {
    this.cargarBases();
    this.cargarHistorial();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ========== CARGAR BASES DESDE FIREBASE ==========
  cargarBases(): void {
    this.cargandoBases = true;
    
    this.contactosService.getBases()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (bases) => {
          this.basesDisponibles = bases;
          this.cargandoBases = false;
          console.log(`📚 ${bases.length} bases cargadas`);
        },
        error: (error) => {
          console.error('Error cargando bases:', error);
          this.cargandoBases = false;
        }
      });
  }

  // ========== SELECCIONAR UNA BASE ==========
  onBaseSeleccionada(): void {
    if (!this.baseSeleccionadaId) {
      this.contactos = [];
      this.contactosFiltrados = [];
      this.baseSeleccionada = null;
      return;
    }

    const base = this.basesDisponibles.find(b => b.id === this.baseSeleccionadaId);
    if (base) {
      this.baseSeleccionada = base;
      // Convertir contactos a seleccionables
      this.contactos = base.contactos.map(c => ({
        ...c,
        seleccionado: false
      }));
      this.contactosFiltrados = [...this.contactos];
      this.todosSeleccionados = false;
      console.log(`✅ Base "${base.nombre}" cargada con ${base.totalContactos} contactos`);
    }
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

  get contactosSeleccionados(): ContactoSeleccionable[] {
    return this.contactos.filter(c => c.seleccionado);
  }

  // ========== MENSAJE E IMAGEN ==========

  onImagenSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    
    if (!archivo) return;

    if (!archivo.type.startsWith('image/')) {
      alert('Solo se permiten imágenes');
      return;
    }

    this.imagenAdjunta = archivo;
    
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
    console.log('Base:', this.baseSeleccionada?.nombre);
    console.log('Contactos:', this.contactosSeleccionados.length);
    console.log('Mensaje:', this.mensajeTexto);

    this.simularEnvio();
  }

  private simularEnvio(): void {
    const total = this.contactosSeleccionados.length;
    let enviados = 0;

    const intervalo = setInterval(() => {
      enviados++;
      this.progresoEnvio = Math.round((enviados / total) * 100);
      
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
    this.enviando = false;
    alert('Envío cancelado');
  }

  // ========== HISTORIAL ==========

  private cargarHistorial(): void {
    const historialGuardado = localStorage.getItem('historial_difusiones');
    if (historialGuardado) {
      this.historialEnvios = JSON.parse(historialGuardado);
    }
  }

  private guardarEnHistorial(): void {
    const registro = {
      fecha: new Date().toISOString(),
      base: this.baseSeleccionada?.nombre || 'Sin nombre',
      contactos: this.contactosSeleccionados.length,
      enviados: this.mensajesEnviados,
      fallidos: this.mensajesFallidos,
      mensaje: this.mensajeTexto.substring(0, 50) + '...',
      conImagen: !!this.imagenAdjunta
    };

    this.historialEnvios.unshift(registro);
    
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