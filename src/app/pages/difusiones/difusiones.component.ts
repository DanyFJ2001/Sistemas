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

  // ========== PROGRAMACIONES GUARDADAS ==========
  programacionesActivas: any[] = [];
  // ========== PREVISUALIZACIÓN ==========
showPreviewModal = false;
mensajePreview = '';
contactoPreview: ContactoSeleccionable | null = null;

  constructor(private contactosService: ContactosService) {}

  ngOnInit(): void {
    this.cargarBases();
    this.cargarHistorial();
    this.cargarProgramaciones();
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
  iniciarConexionWhatsApp(): void {
    console.log('🔄 Iniciando conexión WhatsApp...');
    this.estadoConexion = 'esperando_qr';
    this.mensajeEstado = 'Generando código QR...';
    
    setTimeout(() => {
      this.estadoConexion = 'escaneando';
      this.mensajeEstado = 'Escanea el código QR con WhatsApp';
    }, 1000);
  }

  desconectarWhatsApp(): void {
    console.log('🔌 Desconectando WhatsApp...');
    this.whatsappConectado = false;
    this.estadoConexion = 'desconectado';
    this.mensajeEstado = 'Desconectado';
    this.qrCodeUrl = null;
  }

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
      // Construir el prompt para la IA
      const prompt = this.construirPromptIA();
      
      // TODO: Reemplazar con tu llamada real a la API de IA
      // const response = await this.iaService.generarMensaje(prompt);
      // this.mensajeTexto = response.mensaje;

      // Simulación temporal
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
Genera un mensaje de WhatsApp para difusión masiva con las siguientes características:

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
- Si es posible, usar la variable {{nombre}} para personalizar
- Incluir llamado a la acción claro
- Formato adecuado para WhatsApp (sin HTML)
    `.trim();
  }

  private async simularGeneracionIA(): Promise<void> {
    // Simulación - eliminar cuando conectes la API real
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mensajesEjemplo: { [key: string]: string } = {
      'promocion': '¡Hola {{nombre}}! 🎉\n\nTenemos una promoción especial para ti. Por tiempo limitado, obtén un 20% de descuento en todos nuestros servicios.\n\n📅 Válido hasta fin de mes\n📞 Agenda tu cita ahora\n\n¡Te esperamos!',
      'recordatorio': '¡Hola {{nombre}}! 📋\n\nTe recordamos que tienes una cita programada con nosotros.\n\n⏰ Por favor confirma tu asistencia respondiendo este mensaje.\n\n¡Te esperamos!',
      'informativo': '¡Hola {{nombre}}! 📢\n\nQueremos informarte sobre nuestros nuevos servicios disponibles.\n\nVisita nuestras instalaciones o contáctanos para más información.\n\n¡Estamos para servirte!',
      'seguimiento': '¡Hola {{nombre}}! 👋\n\n¿Cómo te fue con nuestro servicio? Tu opinión es muy importante para nosotros.\n\n⭐ Cuéntanos tu experiencia\n\n¡Gracias por confiar en nosotros!',
      'bienvenida': '¡Bienvenido/a {{nombre}}! 🙌\n\nNos alegra tenerte con nosotros. Estamos aquí para ayudarte en lo que necesites.\n\n📱 Guarda este número para futuras consultas\n\n¡Gracias por elegirnos!',
      'encuesta': '¡Hola {{nombre}}! 📊\n\nQueremos mejorar para ti. ¿Podrías dedicarnos 2 minutos para responder una breve encuesta?\n\n👉 Tu opinión cuenta\n\n¡Gracias por tu tiempo!'
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
      // TODO: Llamar a la API para generar variantes
      // const variantes = await this.iaService.generarVariantes(this.mensajeTexto);
      
      // Por ahora mostrar alerta
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

  // Tomar el primer contacto seleccionado o uno de ejemplo
  this.contactoPreview = this.contactosSeleccionados[0] || { 
    nombre: 'Cliente Ejemplo', 
    telefono: '593999999999',
    seleccionado: true 
  };
  
  this.mensajePreview = this.reemplazarVariables(this.mensajeTexto, this.contactoPreview);
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

    // Validar horarios si está programado
    if (this.programarEnvio && !this.validarHorarios()) {
      return;
    }

    // Si es programado para después, guardar la programación
    if (this.programarEnvio && this.tipoProgramacion !== 'ahora') {
      this.guardarProgramacion();
      return;
    }

    // Verificar horario permitido
    if (this.programarEnvio && !this.estaEnHorarioPermitido()) {
      alert(`⚠️ Fuera de horario permitido.\nHorario configurado: ${this.horaInicio} - ${this.horaFin}`);
      return;
    }

    if (!confirm(`¿Enviar mensaje a ${this.contactosSeleccionados.length} contactos?`)) {
      return;
    }

    this.ejecutarEnvio();
  }

  private ejecutarEnvio(): void {
    this.enviando = true;
    this.cancelarEnvioFlag = false;
    this.progresoEnvio = 0;
    this.mensajesEnviados = 0;
    this.mensajesFallidos = 0;
    this.enviosPendientes = this.contactosSeleccionados.length;

    console.log('📤 Iniciando envío masivo...');
    console.log('Base:', this.baseSeleccionada?.nombre);
    console.log('Contactos:', this.contactosSeleccionados.length);
    console.log('Intervalo:', this.intervaloSegundos, 'segundos');

    this.enviarMensajesSecuencial();
  }

  private async enviarMensajesSecuencial(): Promise<void> {
    const contactos = [...this.contactosSeleccionados];
    const total = contactos.length;

    for (let i = 0; i < contactos.length; i++) {
      if (this.cancelarEnvioFlag) {
        console.log('⛔ Envío cancelado por el usuario');
        break;
      }

      const contacto = contactos[i];
      const mensajePersonalizado = this.reemplazarVariables(this.mensajeTexto, contacto);

      try {
        // TODO: Llamar al backend real para enviar el mensaje
        // await this.whatsappService.enviarMensaje(contacto.telefono, mensajePersonalizado, this.imagenAdjunta);
        
        // Simulación
        await this.simularEnvioIndividual();
        
        if (Math.random() > 0.1) {
          this.mensajesEnviados++;
        } else {
          this.mensajesFallidos++;
        }
      } catch (error) {
        console.error(`Error enviando a ${contacto.telefono}:`, error);
        this.mensajesFallidos++;
      }

      this.progresoEnvio = Math.round(((i + 1) / total) * 100);
      this.enviosPendientes = total - (i + 1);

      // Esperar el intervalo entre mensajes (excepto el último)
      if (i < contactos.length - 1 && !this.cancelarEnvioFlag) {
        await this.esperar(this.intervaloSegundos * 1000);
      }
    }

    this.enviando = false;
    this.guardarEnHistorial();
    
    if (!this.cancelarEnvioFlag) {
      alert(`✅ Envío completado!\n\n✅ Enviados: ${this.mensajesEnviados}\n❌ Fallidos: ${this.mensajesFallidos}`);
    }
  }

  private simularEnvioIndividual(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 300));
  }

  private esperar(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  cancelarEnvio(): void {
    this.cancelarEnvioFlag = true;
    alert('⛔ Cancelando envío...\nEspera a que termine el mensaje actual.');
  }

  // ========== PROGRAMACIONES ==========
  private guardarProgramacion(): void {
    const programacion = {
      id: Date.now().toString(),
      fechaCreacion: new Date().toISOString(),
      tipo: this.tipoProgramacion,
      fechaEnvio: this.fechaEnvio,
      horaInicio: this.horaInicio,
      horaFin: this.horaFin,
      intervalo: this.intervaloSegundos,
      diasSemana: this.tipoProgramacion === 'recurrente' 
        ? this.diasSemana.filter(d => d.activo).map(d => d.valor) 
        : [],
      base: {
        id: this.baseSeleccionada?.id,
        nombre: this.baseSeleccionada?.nombre
      },
      contactosIds: this.contactosSeleccionados.map(c => c.telefono),
      totalContactos: this.contactosSeleccionados.length,
      mensaje: this.mensajeTexto,
      conImagen: !!this.imagenAdjunta,
      estado: 'activa'
    };

    this.programacionesActivas.push(programacion);
    localStorage.setItem('programaciones_difusion', JSON.stringify(this.programacionesActivas));

    const tipoTexto = this.tipoProgramacion === 'programado' 
      ? `para el ${this.fechaEnvio}` 
      : `recurrente (${this.getDiasActivos()})`;

    alert(`✅ Programación guardada ${tipoTexto}\n\nHorario: ${this.horaInicio} - ${this.horaFin}\nContactos: ${this.contactosSeleccionados.length}`);
  }

  private cargarProgramaciones(): void {
    const guardadas = localStorage.getItem('programaciones_difusion');
    if (guardadas) {
      this.programacionesActivas = JSON.parse(guardadas);
    }
  }

  eliminarProgramacion(id: string): void {
    if (!confirm('¿Eliminar esta programación?')) return;
    
    this.programacionesActivas = this.programacionesActivas.filter(p => p.id !== id);
    localStorage.setItem('programaciones_difusion', JSON.stringify(this.programacionesActivas));
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