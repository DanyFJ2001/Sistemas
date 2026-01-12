
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ContactosService, BaseContactos, Contacto } from '../../services/contactos.service';
import { WhatsappService } from '../../services/whatsapp.service';
import { SchedulerService, DifusionProgramada } from '../../services/scheduler.service';

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

  // ========== VARIABLES PARA MENSAJES ==========
  variablesDisponibles = [
    { nombre: 'nombre', etiqueta: '{{nombre}}', descripcion: 'Nombre del contacto' },
    { nombre: 'telefono', etiqueta: '{{telefono}}', descripcion: 'Teléfono' },
    { nombre: 'fecha', etiqueta: '{{fecha}}', descripcion: 'Fecha actual' }
  ];

  // ========== ESTADO DE CONEXIÓN WHATSAPP ==========
  whatsappConectado = false;
  qrCodeUrl: string | null = null;
  estadoConexion: 'desconectado' | 'esperando_qr' | 'escaneando' | 'conectado' = 'desconectado';
  mensajeEstado = 'No conectado';
  qrImagen: string | null = null;

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

  // ========== IA - GENERADOR DE MENSAJES ==========
  usarIA = false;
  contextoNegocio = '';
  objetivoMensaje = '';
  instruccionesIA = '';
  generandoIA = false;
  tonoMensaje: 'formal' | 'amigable' | 'profesional' | 'casual' = 'profesional';

  // ========== PROGRAMACIÓN DE HORARIOS ==========
  programarEnvio = false;
  tipoProgramacion: 'ahora' | 'programado' | 'recurrente' = 'ahora';
  fechaEnvio = '';
  fechaMinima = new Date().toISOString().split('T')[0];
  horaInicio = '08:00';
  horaFin = '18:00';
  intervaloSegundos = 15;
  diasSemana = [
    { nombre: 'Lun', valor: 1, activo: true },
    { nombre: 'Mar', valor: 2, activo: true },
    { nombre: 'Mié', valor: 3, activo: true },
    { nombre: 'Jue', valor: 4, activo: true },
    { nombre: 'Vie', valor: 5, activo: true },
    { nombre: 'Sáb', valor: 6, activo: false },
    { nombre: 'Dom', valor: 0, activo: false }
  ];

  // ========== ENVÍO ==========
  enviando = false;
  progresoEnvio = 0;
  mensajesEnviados = 0;
  mensajesFallidos = 0;
  enviosPendientes = 0;
  private cancelarEnvioFlag = false;

  // ========== HISTORIAL ==========
  historialEnvios: any[] = [];

  // ========== PREVISUALIZACIÓN ==========
  showPreviewModal = false;
  mensajePreview = '';
  contactoPreview: ContactoSeleccionable | null = null;

  // ========== PROGRAMACIONES (NUEVAS) ==========
  programacionesActivas: DifusionProgramada[] = [];
  programacionesPendientes: DifusionProgramada[] = [];
  programacionesEjecutadas: DifusionProgramada[] = [];
  tabProgramaciones: 'pendientes' | 'ejecutadas' = 'pendientes';
  mostrarNuevaProgramacion = false;
  
  // Modal edición de programaciones
  showEditModal = false;
  programacionEnEdicion: DifusionProgramada | null = null;
  nuevaFechaProgramacion = '';

  constructor(
    private contactosService: ContactosService,
    private whatsappService: WhatsappService,
    private schedulerService: SchedulerService
  ) {}

  ngOnInit(): void {
    this.cargarBases();
    this.cargarHistorial();
    this.cargarProgramaciones();
    this.escucharEventosScheduler();
    this.verificarEstadoWhatsApp();
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
  
  iniciarConexionWhatsApp() {
    this.estadoConexion = 'esperando_qr';

    setTimeout(() => {
      this.whatsappService.obtenerQR().subscribe({
        next: res => {
          this.qrImagen = res.qr;
          this.estadoConexion = 'escaneando';
        }
      });
    }, 800);
  }

  verEstado() {
    this.whatsappService.obtenerEstado().subscribe(res => {
      this.whatsappConectado = res.isReady;
      if (this.whatsappConectado) this.qrImagen = null;
    });
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
    this.contactosFiltrados.forEach((c: any) => c.seleccionado = this.todosSeleccionados);
  }

  get contactosSeleccionados(): ContactoSeleccionable[] {
    return this.contactos.filter(c => c.seleccionado);
  }

  // ========== MENSAJE E IMAGEN ==========
  imagenBase64String: string | null = null;  // NUEVA: guardar imagen en base64

  onImagenSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    
    if (!archivo) return;

    if (!archivo.type.startsWith('image/')) {
      alert('Solo se permiten imágenes');
      return;
    }

    this.imagenAdjunta = archivo;
    
    // Convertir INMEDIATAMENTE a base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      this.imagenBase64String = base64;  // Guardar aquí
      this.imagenPreview = base64;        // Mostrar preview
      console.log('✅ Imagen convertida a base64:', base64.substring(0, 50) + '...');
    };
    reader.onerror = () => {
      alert('Error al leer la imagen');
      console.error('❌ Error FileReader:', reader.error);
    };
    reader.readAsDataURL(archivo);
  }

  eliminarImagen(): void {
    this.imagenAdjunta = null;
    this.imagenPreview = null;
    this.imagenBase64String = null;
  }

  // ========== VARIABLES EN MENSAJE ==========
  insertarVariable(variable: string): void {
    this.mensajeTexto += ` ${variable}`;
  }

  // ========== IA - GENERACIÓN DE MENSAJES ==========
  async generarMensajeIA(): Promise<void> {
    if (!this.contextoNegocio || !this.objetivoMensaje) {
      alert('Completa el contexto del negocio y el objetivo del mensaje');
      return;
    }

    this.generandoIA = true;

    try {
      const prompt = this.construirPromptIA();
      
      // TODO: Reemplazar con llamada real a la API
      await this.simularGeneracionIA();
      
      console.log('✨ Mensaje generado con IA');
    } catch (error) {
      console.error('Error generando mensaje:', error);
      alert('Error al generar el mensaje. Intenta de nuevo.');
    } finally {
      this.generandoIA = false;
    }
  }

  private construirPromptIA(): string {
    return `
Genera un mensaje de WhatsApp para difusión masiva (publicidad general, SIN personalización) con las siguientes características:

CONTEXTO DEL NEGOCIO:
${this.contextoNegocio}

OBJETIVO DEL MENSAJE:
${this.objetivoMensaje}

TONO:
${this.tonoMensaje}

INSTRUCCIONES ADICIONALES:
${this.instruccionesIA || 'Ninguna'}

REQUISITOS:
- Máximo 500 caracteres
- Incluir emoji relevantes pero sin exceso
- Dirigido al público en general, SIN variables ni personalizaciones
- Incluir llamado a la acción claro
- Formato adecuado para WhatsApp (sin HTML)
- Directo y profesional
    `.trim();
  }

  private async simularGeneracionIA(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mensajesEjemplo: { [key: string]: string } = {
      'promocion': '🎉 ¡Oferta especial para ti!\n\nDisfruta de un 20% de descuento en todos nuestros servicios.\n\n📅 Válido hasta fin de mes\n📞 Agenda tu cita ahora\n\n¡Te esperamos!',
      'recordatorio': '📋 Recordatorio importante\n\nTe invitamos a visitarnos para tu próxima consulta.\n\n⏰ Contáctanos para agendar\n\n¡Estamos aquí para ti!',
      'informativo': '📢 ¡Conoce nuestros servicios!\n\nOfrecemos soluciones de calidad para tu bienestar.\n\nVisita nuestras instalaciones o contáctanos para más información.\n\n¡Estamos para servirte!',
      'seguimiento': '👋 ¿Cómo estuvo tu experiencia?\n\nTu opinión es muy importante para nosotros.\n\n⭐ Cuéntanos tu experiencia\n\n¡Gracias por confiar en nosotros!',
      'bienvenida': '🙌 ¡Bienvenido!\n\nNos alegra tenerte con nosotros. Estamos aquí para ayudarte en lo que necesites.\n\n📱 Guarda nuestro número\n\n¡Gracias por elegirnos!',
      'encuesta': '📊 Ayúdanos a mejorar\n\nQueremos conocer tu opinión. ¿Podrías responder una breve encuesta?\n\n👉 Tu voz cuenta\n\n¡Gracias por tu tiempo!'
    };

    this.mensajeTexto = mensajesEjemplo[this.objetivoMensaje] || mensajesEjemplo['informativo'];
  }

  async generarVariantes(): Promise<void> {
    if (!this.mensajeTexto) {
      alert('Primero genera o escribe un mensaje');
      return;
    }

    this.generandoIA = true;

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      alert('🔄 Funcionalidad de variantes próximamente.\n\nAquí se mostrarán 3 variantes del mensaje para que elijas la mejor.');
      
    } catch (error) {
      console.error('Error generando variantes:', error);
    } finally {
      this.generandoIA = false;
    }
  }

  // ========== PROGRAMACIÓN DE HORARIOS ==========
  getDiasActivos(): string {
    const activos = this.diasSemana.filter(d => d.activo).map(d => d.nombre);
    if (activos.length === 0) return 'ningún día';
    if (activos.length === 7) return 'todos los días';
    if (activos.length === 5 && !this.diasSemana[5].activo && !this.diasSemana[6].activo) {
      return 'Lunes a Viernes';
    }
    return activos.join(', ');
  }

  validarHorarios(): boolean {
    if (this.horaInicio >= this.horaFin) {
      alert('La hora de inicio debe ser menor a la hora de fin');
      return false;
    }
    
    if (this.tipoProgramacion === 'recurrente') {
      const diasActivos = this.diasSemana.filter(d => d.activo);
      if (diasActivos.length === 0) {
        alert('Selecciona al menos un día de la semana');
        return false;
      }
    }

    if (this.tipoProgramacion === 'programado' && !this.fechaEnvio) {
      alert('Selecciona una fecha de envío');
      return false;
    }

    return true;
  }

  estaEnHorarioPermitido(): boolean {
    const ahora = new Date();
    const horaActual = ahora.getHours().toString().padStart(2, '0') + ':' + 
                       ahora.getMinutes().toString().padStart(2, '0');
    
    return horaActual >= this.horaInicio && horaActual <= this.horaFin;
  }

  // ========== PREVISUALIZACIÓN ==========
  previsualizarMensaje(): void {
    if (!this.mensajeTexto) {
      alert('Escribe un mensaje primero');
      return;
    }

    // Para previsualización, no reemplazamos variables (son mensajes públicos)
    this.mensajePreview = this.mensajeTexto;
    this.contactoPreview = { 
      nombre: 'Destinatario', 
      telefono: '593999999999',
      seleccionado: true 
    };
    
    this.showPreviewModal = true;
  }

  cerrarPreviewModal(): void {
    this.showPreviewModal = false;
  }

  getHoraActual(): string {
    return new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
  }

  private reemplazarVariables(mensaje: string, contacto: any): string {
    return mensaje
      .replace(/\{\{nombre\}\}/g, contacto.nombre || 'Cliente')
      .replace(/\{\{telefono\}\}/g, contacto.telefono || '')
      .replace(/\{\{fecha\}\}/g, new Date().toLocaleDateString('es-EC'));
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

    if (this.programarEnvio && !this.validarHorarios()) {
      return;
    }

    // Si es programado para después, guardar en backend
    if (this.programarEnvio && this.tipoProgramacion !== 'ahora') {
      this.guardarProgramacionEnBackend();
      return;
    }

    if (!confirm(`¿Enviar mensaje a ${this.contactosSeleccionados.length} contactos?`)) {
      return;
    }

    this.ejecutarEnvioInmediato();
  }

  private guardarProgramacionEnBackend(): void {
    if (!this.baseSeleccionada) {
      alert('Selecciona una base de contactos');
      return;
    }

    const fecha = new Date(`${this.fechaEnvio}T${this.horaInicio}`);
    
    const datos = {
      name: `Difusión ${this.baseSeleccionada.nombre} - ${this.fechaEnvio} ${this.horaInicio}`,
      contacts: this.contactosSeleccionados.map(c => c.telefono),
      message: this.mensajeTexto,
      scheduledFor: fecha.toISOString(),
      useVariations: true,
      variationsCount: 5
    };

    this.enviando = true;

    this.schedulerService.crearDifusionProgramada(datos)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            alert(`✅ Difusión programada para ${this.schedulerService.formatearFechaProgramada(datos.scheduledFor)}`);
            this.resetearFormulario();
            this.cargarProgramaciones();
          }
        },
        error: (error) => {
          console.error('Error guardando programación:', error);
          alert('Error al programar la difusión. Intenta de nuevo.');
        },
        complete: () => {
          this.enviando = false;
        }
      });
  }

  private ejecutarEnvioInmediato(): void {
    if (!this.baseSeleccionada) {
      alert('Selecciona una base de contactos');
      return;
    }

    this.enviando = true;
    this.cancelarEnvioFlag = false;
    this.progresoEnvio = 0;
    this.mensajesEnviados = 0;
    this.mensajesFallidos = 0;
    this.enviosPendientes = this.contactosSeleccionados.length;

    const datos: any = {
      name: `Difusión Inmediata - ${this.baseSeleccionada.nombre}`,
      contacts: this.contactosSeleccionados.map(c => c.telefono),
      message: this.mensajeTexto,
      useVariations: true,
      variationsCount: 5
    };

    // Agregar imagen si existe y está convertida a base64
    if (this.imagenBase64String) {
      datos.imagenBase64 = this.imagenBase64String;
      console.log('📷 Imagen incluida en broadcast:', this.imagenBase64String.substring(0, 50) + '...');
    } else {
      console.log('📝 Sin imagen, solo texto');
    }

    this.whatsappService.iniciarBroadcast(datos)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('📤 Broadcast iniciado:', response);
        },
        error: (error) => {
          console.error('Error iniciando broadcast:', error);
          alert('Error al enviar. Intenta de nuevo.');
          this.enviando = false;
        }
      });
  }

  private actualizarProgresoEnvio(progreso: any): void {
    if (progreso.phase === 'sending') {
      this.progresoEnvio = progreso.percent || 0;
      this.mensajesEnviados = progreso.sent || 0;
      this.mensajesFallidos = progreso.failed || 0;
    } else if (progreso.phase === 'completed') {
      this.enviando = false;
      this.progresoEnvio = 100;
      alert(`✅ Envío completado!\n\n✅ Enviados: ${progreso.sent}\n❌ Fallidos: ${progreso.failed}`);
      this.guardarEnHistorial();
    }
  }

  cancelarEnvio(): void {
    this.cancelarEnvioFlag = true;
    alert('⛔ Cancelando envío...\nEspera a que termine el mensaje actual.');
  }

  // ========== PROGRAMACIONES - NUEVOS MÉTODOS ==========

  private cargarProgramaciones(): void {
    this.schedulerService.cargarPendientes();
    this.schedulerService.cargarEjecutadas();
    this.schedulerService.cargarStats();

    this.schedulerService.pendientes$
      .pipe(takeUntil(this.destroy$))
      .subscribe(pendientes => {
        this.programacionesPendientes = pendientes;
        this.mostrarNuevaProgramacion = pendientes.length > 0;
      });

    this.schedulerService.ejecutadas$
      .pipe(takeUntil(this.destroy$))
      .subscribe(ejecutadas => {
        this.programacionesEjecutadas = ejecutadas;
      });
  }

  private escucharEventosScheduler(): void {
    this.schedulerService.progress$
      .pipe(takeUntil(this.destroy$))
      .subscribe(progress => {
        if (progress) {
          if (progress.phase === 'executing_scheduled') {
            console.log('🚀 Ejecutando difusión programada:', progress.message);
          } else if (progress.phase === 'scheduled_executed') {
            console.log('✅ Difusión ejecutada');
            this.cargarProgramaciones();
          } else if (progress.phase === 'scheduled_failed') {
            console.error('❌ Error en difusión:', progress.error);
          }
        }
      });
  }

  editarProgramacion(prog: DifusionProgramada): void {
    this.programacionEnEdicion = { ...prog };
    const fecha = new Date(prog.scheduledFor);
    this.nuevaFechaProgramacion = fecha.toISOString().slice(0, 16);
    this.showEditModal = true;
  }

  guardarEditProgramacion(): void {
    if (!this.programacionEnEdicion || !this.nuevaFechaProgramacion) {
      alert('Completa todos los campos');
      return;
    }

    const fecha = new Date(this.nuevaFechaProgramacion);
    
    this.schedulerService.actualizar(this.programacionEnEdicion.id, {
      ...this.programacionEnEdicion,
      scheduledFor: fecha.toISOString()
    }).pipe(takeUntil(this.destroy$))
    .subscribe({
      next: () => {
        alert('✅ Programación actualizada');
        this.cerrarEditModal();
        this.cargarProgramaciones();
      },
      error: (error) => {
        console.error('Error actualizando:', error);
        alert('Error al actualizar. Intenta de nuevo.');
      }
    });
  }

  cancelarProgramacion(id: string): void {
    if (!confirm('¿Cancelar esta programación?')) return;

    this.schedulerService.cancelar(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          alert('✅ Programación cancelada');
          this.cargarProgramaciones();
        },
        error: (error) => {
          console.error('Error cancelando:', error);
          alert('Error al cancelar. Intenta de nuevo.');
        }
      });
  }

  eliminarProgramacion(id: string): void {
    if (!confirm('¿Eliminar del historial?')) return;
    this.programacionesEjecutadas = this.programacionesEjecutadas.filter(p => p.id !== id);
  }

  cerrarEditModal(): void {
    this.showEditModal = false;
    this.programacionEnEdicion = null;
    this.nuevaFechaProgramacion = '';
  }

  getMinDateTime(): string {
    const ahora = new Date();
    return ahora.toISOString().slice(0, 16);
  }

  getTiempoRestante(fechaISO: string): string {
    return this.schedulerService.getTiempoRestante(fechaISO);
  }

  estaProxima(fechaISO: string): boolean {
    return this.schedulerService.estaProxima(fechaISO);
  }

  formatearFechaProgramada(fechaISO: string): string {
    return this.schedulerService.formatearFechaProgramada(fechaISO);
  }

  private resetearFormulario(): void {
    this.mensajeTexto = '';
    this.imagenAdjunta = null;
    this.imagenPreview = null;
    this.programarEnvio = false;
    this.fechaEnvio = '';
    this.horaInicio = '08:00';
    this.horaFin = '18:00';
    this.contactos.forEach(c => c.seleccionado = false);
    this.todosSeleccionados = false;
  }

  private verificarEstadoWhatsApp(): void {
    this.whatsappService.estado$
      .pipe(takeUntil(this.destroy$))
      .subscribe(estado => {
        this.estadoConexion = estado as any;
        this.whatsappConectado = estado === 'conectado';
        this.actualizarMensajeEstado(estado);
      });

    this.whatsappService.qr$
      .pipe(takeUntil(this.destroy$))
      .subscribe(qr => {
        this.qrImagen = qr;
      });

    this.whatsappService.progreso$
      .pipe(takeUntil(this.destroy$))
      .subscribe(progreso => {
        if (progreso) {
          this.actualizarProgresoEnvio(progreso);
        }
      });
  }

  private actualizarMensajeEstado(estado: string): void {
    const mensajes: { [key: string]: string } = {
      'desconectado': 'No conectado',
      'qr_ready': 'Escanea el QR',
      'autenticando': 'Autenticando...',
      'conectado': '✅ Conectado'
    };
    this.mensajeEstado = mensajes[estado] || 'Estado desconocido';
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
      id: Date.now().toString(),
      fecha: new Date().toISOString(),
      base: this.baseSeleccionada?.nombre || 'Sin nombre',
      contactos: this.contactosSeleccionados.length,
      enviados: this.mensajesEnviados,
      fallidos: this.mensajesFallidos,
      mensaje: this.mensajeTexto.substring(0, 50) + (this.mensajeTexto.length > 50 ? '...' : ''),
      conImagen: !!this.imagenAdjunta,
      programado: this.programarEnvio && this.tipoProgramacion !== 'ahora'
    };

    this.historialEnvios.unshift(registro);
    
    if (this.historialEnvios.length > 50) {
      this.historialEnvios = this.historialEnvios.slice(0, 50);
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