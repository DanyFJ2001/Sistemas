import { Component, OnDestroy, OnInit } from '@angular/core';
import { Tarea, TareasService } from '../../services/tareas.service';
import { interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-tareas',
  standalone: true,
  imports: [FormsModule,CommonModule],
  templateUrl: './tareas.component.html',
  styleUrl: './tareas.component.css'
})
export class TareasComponent implements OnInit,OnDestroy{

tareas: Tarea[] = [];
  tareasFiltradas: Tarea[] = [];
  cargando = true;
  error: string | null = null;
  
  // Filtros
  filtroEstado: string = 'todos';
  filtroPrioridad: string = 'todos';
  filtroCategoria: string = 'todos';
  busqueda: string = '';
  
  // Estadísticas
  estadisticas: any = null;
  estadoBot: string = 'desconectado';
  
  // Auto-actualización
  private actualizacionSub?: Subscription;
  autoActualizar = true;
  
  // Vista
  vistaActual: 'lista' | 'kanban' | 'tarjetas' = 'tarjetas';

  constructor(private tareasService: TareasService) {}

  ngOnInit(): void {
    this.cargarTareas();
    this.cargarEstadisticas();
    this.verificarEstadoBot();
    this.iniciarAutoActualizacion();
  }

  ngOnDestroy(): void {
    if (this.actualizacionSub) {
      this.actualizacionSub.unsubscribe();
    }
  }

  cargarTareas(): void {
    this.cargando = true;
    this.error = null;

    this.tareasService.obtenerTareas().subscribe({
      next: (response) => {
        this.tareas = response.tareas;
        this.aplicarFiltros();
        this.cargando = false;
      },
      error: (err) => {
        this.error = 'Error al cargar las tareas. Verifica que el servidor esté corriendo en http://localhost:3000';
        console.error('Error:', err);
        this.cargando = false;
      }
    });
  }

  aplicarFiltros(): void {
    this.tareasFiltradas = this.tareas.filter(tarea => {
      const cumpleEstado = this.filtroEstado === 'todos' || tarea.estado === this.filtroEstado;
      const cumplePrioridad = this.filtroPrioridad === 'todos' || tarea.prioridad === this.filtroPrioridad;
      const cumpleCategoria = this.filtroCategoria === 'todos' || tarea.categoria === this.filtroCategoria;
      const cumpleBusqueda = !this.busqueda || 
        tarea.titulo.toLowerCase().includes(this.busqueda.toLowerCase()) ||
        tarea.descripcion.toLowerCase().includes(this.busqueda.toLowerCase()) ||
        tarea.remitente.toLowerCase().includes(this.busqueda.toLowerCase());
      
      return cumpleEstado && cumplePrioridad && cumpleCategoria && cumpleBusqueda;
    });
  }

  cambiarEstadoTarea(tarea: Tarea, nuevoEstado: string): void {
    this.tareasService.cambiarEstado(tarea.id, nuevoEstado).subscribe({
      next: () => {
        console.log('✅ Estado actualizado');
        this.cargarTareas();
        this.cargarEstadisticas();
      },
      error: (err) => {
        console.error('❌ Error:', err);
        alert('Error al actualizar el estado');
      }
    });
  }

  completarTarea(tarea: Tarea): void {
    if (confirm(`¿Marcar como completada: "${tarea.titulo}"?`)) {
      this.tareasService.completarTarea(tarea.id).subscribe({
        next: () => {
          this.cargarTareas();
          this.cargarEstadisticas();
        },
        error: (err) => {
          console.error('❌ Error:', err);
          alert('Error al completar la tarea');
        }
      });
    }
  }

  eliminarTarea(tarea: Tarea): void {
    if (confirm(`¿Eliminar la tarea: "${tarea.titulo}"?`)) {
      this.tareasService.eliminarTarea(tarea.id).subscribe({
        next: () => {
          this.cargarTareas();
          this.cargarEstadisticas();
        },
        error: (err) => {
          console.error('❌ Error:', err);
          alert('Error al eliminar la tarea');
        }
      });
    }
  }

  cargarEstadisticas(): void {
    this.tareasService.obtenerEstadisticas().subscribe({
      next: (response) => {
        this.estadisticas = response.stats;
      },
      error: (err) => {
        console.error('Error al cargar estadísticas:', err);
      }
    });
  }

  verificarEstadoBot(): void {
    this.tareasService.obtenerEstadoBot().subscribe({
      next: (response) => {
        this.estadoBot = response.whatsapp;
      },
      error: () => {
        this.estadoBot = 'error';
      }
    });
  }

  iniciarAutoActualizacion(): void {
    this.actualizacionSub = interval(10000)
      .pipe(switchMap(() => this.tareasService.obtenerTareas()))
      .subscribe({
        next: (response) => {
          if (this.autoActualizar) {
            this.tareas = response.tareas;
            this.aplicarFiltros();
          }
        }
      });
  }

  toggleAutoActualizar(): void {
    this.autoActualizar = !this.autoActualizar;
  }

  cambiarVista(vista: 'lista' | 'kanban' | 'tarjetas'): void {
    this.vistaActual = vista;
  }

  getColorPrioridad(prioridad: string): string {
    switch (prioridad) {
      case 'alta': return 'red';
      case 'media': return 'orange';
      case 'baja': return 'green';
      default: return 'gray';
    }
  }

  getEmojiPrioridad(prioridad: string): string {
    switch (prioridad) {
      case 'alta': return '🔥';
      case 'media': return '⚡';
      case 'baja': return '📌';
      default: return '📝';
    }
  }

  getIconoCategoria(categoria: string): string {
    const iconos: any = {
      'soporte-tecnico': '🔧',
      'reunion': '📅',
      'diseño': '🎨',
      'documentacion': '📄',
      'atencion-cliente': '👥',
      'general': '📋'
    };
    return iconos[categoria] || '📋';
  }

  formatearFecha(fecha: string): string {
    const date = new Date(fecha);
    const ahora = new Date();
    const diff = ahora.getTime() - date.getTime();
    const minutos = Math.floor(diff / 60000);
    const horas = Math.floor(diff / 3600000);
    const dias = Math.floor(diff / 86400000);

    if (minutos < 1) return 'Hace un momento';
    if (minutos < 60) return `Hace ${minutos} min`;
    if (horas < 24) return `Hace ${horas}h`;
    if (dias < 7) return `Hace ${dias}d`;
    
    return date.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: 'short'
    });
  }

  getTareasPorEstado(estado: string): Tarea[] {
    return this.tareasFiltradas.filter(t => t.estado === estado);
  }
}
