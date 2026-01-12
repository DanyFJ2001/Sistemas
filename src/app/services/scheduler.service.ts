// src/app/services/scheduler.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

export interface DifusionProgramada {
  id: string;
  name: string;
  contacts: string[];
  message: string;
  scheduledFor: string;
  status: 'scheduled' | 'executed' | 'failed' | 'cancelled';
  useVariations: boolean;
  variationsCount: number;
  config?: {
    delayMin?: number;
    delayMax?: number;
    batchSize?: number;
  };
  createdAt: string;
  executedAt?: string;
  failedAt?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SchedulerService {
  private API = 'http://localhost:3000/api/scheduled-broadcasts';
  private socket: Socket | null = null;

  // BehaviorSubjects
  private difusionesSubject = new BehaviorSubject<DifusionProgramada[]>([]);
  public difusiones$ = this.difusionesSubject.asObservable();

  private pendientesSubject = new BehaviorSubject<DifusionProgramada[]>([]);
  public pendientes$ = this.pendientesSubject.asObservable();

  private ejecutadasSubject = new BehaviorSubject<DifusionProgramada[]>([]);
  public ejecutadas$ = this.ejecutadasSubject.asObservable();

  private statsSubject = new BehaviorSubject<any | null>(null);
  public stats$ = this.statsSubject.asObservable();

  private progressSubject = new BehaviorSubject<any | null>(null);
  public progress$ = this.progressSubject.asObservable();

  constructor(private http: HttpClient) {
    this.inicializarSocket();
  }

  // ========== SOCKET.IO ==========
  private inicializarSocket(): void {
    if (this.socket) return;

    this.socket = io('http://localhost:3000', {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    // Eventos del scheduler
    this.socket.on('scheduler:progress', (data: any) => {
      console.log('📅 Scheduler evento:', data.phase);
      this.progressSubject.next(data);

      // Actualizar listas según el evento
      if (data.phase === 'scheduled_created') {
        this.cargarPendientes();
      } else if (data.phase === 'scheduled_executed' || data.phase === 'scheduled_failed') {
        this.cargarPendientes();
        this.cargarEjecutadas();
      }
    });

    console.log('🔌 Socket.IO (Scheduler) conectado');
  }

  // ========== CRUD - PROGRAMADAS ==========

  /**
   * Crea una nueva difusión programada
   */
  crearDifusionProgramada(datos: {
    name: string;
    contacts: string[];
    message: string;
    scheduledFor: string;
    useVariations?: boolean;
    variationsCount?: number;
    customDelayMin?: number;
    customDelayMax?: number;
    customBatchSize?: number;
  }): Observable<any> {
    return this.http.post(`${this.API}/create`, datos);
  }

  /**
   * Obtiene todas las difusiones programadas
   */
  obtenerTodas(status?: string): Observable<any> {
    let url = `${this.API}/all`;
    if (status) {
      url += `?status=${status}`;
    }
    return this.http.get<any>(url);
  }

  /**
   * Obtiene solo las pendientes (no ejecutadas)
   */
  obtenerPendientes(): Observable<any> {
    return this.http.get<any>(`${this.API}/pending`);
  }

  /**
   * Obtiene solo las ejecutadas
   */
  obtenerEjecutadas(limit: number = 20): Observable<any> {
    return this.http.get<any>(`${this.API}/executed?limit=${limit}`);
  }

  /**
   * Obtiene una difusión por ID
   */
  obtenerPorId(id: string): Observable<any> {
    return this.http.get<any>(`${this.API}/${id}`);
  }

  /**
   * Actualiza una difusión programada (solo si está pendiente)
   */
  actualizar(id: string, datos: Partial<DifusionProgramada>): Observable<any> {
    return this.http.put(`${this.API}/${id}`, datos);
  }

  /**
   * Cancela una difusión programada
   */
  cancelar(id: string): Observable<any> {
    return this.http.post(`${this.API}/${id}/cancel`, {});
  }

  /**
   * Obtiene estadísticas
   */
  obtenerStats(): Observable<any> {
    return this.http.get(`${this.API}/stats/overview`);
  }

  // ========== MÉTODOS AUXILIARES ==========

  /**
   * Carga las difusiones pendientes en el BehaviorSubject
   */
  cargarPendientes(): void {
    this.obtenerPendientes().subscribe({
      next: (response) => {
        this.pendientesSubject.next(response.broadcasts || []);
      },
      error: (error) => {
        console.error('Error cargando pendientes:', error);
      }
    });
  }

  /**
   * Carga las difusiones ejecutadas en el BehaviorSubject
   */
  cargarEjecutadas(limit: number = 20): void {
    this.obtenerEjecutadas(limit).subscribe({
      next: (response) => {
        this.ejecutadasSubject.next(response.broadcasts || []);
      },
      error: (error) => {
        console.error('Error cargando ejecutadas:', error);
      }
    });
  }

  /**
   * Carga las estadísticas
   */
  cargarStats(): void {
    this.obtenerStats().subscribe({
      next: (response) => {
        this.statsSubject.next(response.stats);
      },
      error: (error) => {
        console.error('Error cargando stats:', error);
      }
    });
  }

  /**
   * Obtiene el estado actual de una difusión
   */
  getEstadoDifusion(id: string): string {
    const pendientes = this.pendientesSubject.value;
    const pendiente = pendientes.find(d => d.id === id);
    return pendiente ? 'Pendiente' : 'Ejecutada/Cancelada';
  }

  /**
   * Formatea la fecha de programación para mostrar
   */
  formatearFechaProgramada(fechaISO: string): string {
    const fecha = new Date(fechaISO);
    return fecha.toLocaleString('es-EC', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Obtiene el tiempo restante hasta la ejecución
   */
  getTiempoRestante(fechaISO: string): string {
    const ahora = new Date();
    const fecha = new Date(fechaISO);
    const diff = fecha.getTime() - ahora.getTime();

    if (diff <= 0) return 'Ejecutada';

    const horas = Math.floor(diff / (1000 * 60 * 60));
    const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (horas > 0) {
      return `${horas}h ${minutos}m`;
    }
    return `${minutos}m`;
  }

  /**
   * Verifica si una difusión está próxima a ejecutarse (en los próximos 5 minutos)
   */
  estaProxima(fechaISO: string): boolean {
    const ahora = new Date();
    const fecha = new Date(fechaISO);
    const diff = fecha.getTime() - ahora.getTime();
    return diff > 0 && diff <= 5 * 60 * 1000; // 5 minutos
  }

  // ========== UTILIDADES ==========

  desconectar(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}