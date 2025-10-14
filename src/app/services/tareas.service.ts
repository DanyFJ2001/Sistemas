// src/app/services/tareas.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Tarea {
  id: number;
  titulo: string;
  descripcion: string;
  remitente: string;
  telefono: string;
  grupoId?: string;
  fecha: string;
  estado: 'pendiente' | 'en_progreso' | 'completada';
  prioridad: 'alta' | 'media' | 'baja';
  categoria: string;
  menciones?: string[];
  tieneFecha?: boolean;
  origen: 'whatsapp' | 'whatsapp-grupo' | 'manual';
  fechaActualizacion?: string;
  fechaCompletada?: string;
}

export interface TareasResponse {
  success: boolean;
  total: number;
  tareas: Tarea[];
}

export interface TareaResponse {
  success: boolean;
  tarea?: Tarea;
  mensaje?: string;
}

export interface EstadisticasResponse {
  success: boolean;
  stats: {
    total: number;
    pendientes: number;
    enProgreso: number;
    completadas: number;
    porPrioridad: {
      alta: number;
      media: number;
      baja: number;
    };
    porCategoria: {
      [key: string]: number;
    };
  };
}

export interface EstadoBotResponse {
  success: boolean;
  whatsapp: string;
  tareas: number;
  ultimaActualizacion: string;
}

@Injectable({
  providedIn: 'root'
})
export class TareasService {
  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  // Obtener todas las tareas con filtros opcionales
  obtenerTareas(filtros?: {
    estado?: string;
    prioridad?: string;
    categoria?: string;
    orden?: 'asc' | 'desc';
  }): Observable<TareasResponse> {
    let params = new HttpParams();
    
    if (filtros) {
      if (filtros.estado) params = params.set('estado', filtros.estado);
      if (filtros.prioridad) params = params.set('prioridad', filtros.prioridad);
      if (filtros.categoria) params = params.set('categoria', filtros.categoria);
      if (filtros.orden) params = params.set('orden', filtros.orden);
    }

    return this.http.get<TareasResponse>(`${this.apiUrl}/tareas`, { params });
  }

  // Obtener una tarea específica
  obtenerTareaPorId(id: number): Observable<TareaResponse> {
    return this.http.get<TareaResponse>(`${this.apiUrl}/tareas/${id}`);
  }

  // Crear nueva tarea
  crearTarea(tarea: Partial<Tarea>): Observable<TareaResponse> {
    return this.http.post<TareaResponse>(`${this.apiUrl}/tareas`, tarea);
  }

  // Actualizar tarea
  actualizarTarea(id: number, datos: Partial<Tarea>): Observable<TareaResponse> {
    return this.http.put<TareaResponse>(`${this.apiUrl}/tareas/${id}`, datos);
  }

  // Eliminar tarea
  eliminarTarea(id: number): Observable<TareaResponse> {
    return this.http.delete<TareaResponse>(`${this.apiUrl}/tareas/${id}`);
  }

  // Cambiar estado de tarea
  cambiarEstado(id: number, estado: string): Observable<TareaResponse> {
    return this.actualizarTarea(id, { estado: estado as any });
  }

  // Marcar como completada
  completarTarea(id: number): Observable<TareaResponse> {
    return this.actualizarTarea(id, { 
      estado: 'completada',
      fechaCompletada: new Date().toISOString()
    });
  }

  // Obtener estadísticas
  obtenerEstadisticas(): Observable<EstadisticasResponse> {
    return this.http.get<EstadisticasResponse>(`${this.apiUrl}/estadisticas`);
  }

  // Obtener estado del bot
  obtenerEstadoBot(): Observable<EstadoBotResponse> {
    return this.http.get<EstadoBotResponse>(`${this.apiUrl}/estado`);
  }
}