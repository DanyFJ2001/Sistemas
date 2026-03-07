// src/app/services/whatsapp.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../app/enviroments/enviroment';

export interface EstadoWhatsApp {
  success: boolean;
  estado: string;
  isReady: boolean;
}

export interface QRResponse {
  success: boolean;
  qr: string;
  estado: string;
}

export interface ContactoWhatsApp {
  phone: string;
  formattedPhone: string;
  name: string;
  isMyContact: boolean;
  lastMessage?: {
    body: string;
    timestamp: number;
    fromMe: boolean;
  };
  unreadCount: number;
}

export interface ProgresoEnvio {
  phase: string;
  current?: number;
  total?: number;
  percent?: number;
  currentContact?: string;
  sent?: number;
  failed?: number;
  message?: string;
  delay?: number;
  batchNumber?: number;
  pauseDuration?: number;
  status?: string;
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class WhatsappService {
  private API = `${environment.apiUrl}/api`;
  private socket: Socket | null = null;

  private estadoSubject = new BehaviorSubject<string>('desconectado');
  public estado$ = this.estadoSubject.asObservable();

  private qrSubject = new BehaviorSubject<string | null>(null);
  public qr$ = this.qrSubject.asObservable();

  private progresoSubject = new BehaviorSubject<ProgresoEnvio | null>(null);
  public progreso$ = this.progresoSubject.asObservable();

  private mensajeSubject = new BehaviorSubject<any | null>(null);
  public mensaje$ = this.mensajeSubject.asObservable();

  constructor(private http: HttpClient) {
    this.inicializarSocket();
  }

  private inicializarSocket(): void {
    if (this.socket) return;

    this.socket = io(environment.apiUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('Socket conectado al backend');
    });

    this.socket.on('whatsapp:qr', (data: any) => {
      if (data.qr) {
        this.qrSubject.next(data.qr);
        this.estadoSubject.next('qr_ready');
      }
    });

    this.socket.on('whatsapp:estado', (data: any) => {
      if (data.estado) {
        this.estadoSubject.next(data.estado);
      }
    });

    this.socket.on('whatsapp:ready', () => {
      this.estadoSubject.next('conectado');
      this.qrSubject.next(null);
    });

    this.socket.on('whatsapp:disconnected', () => {
      this.estadoSubject.next('desconectado');
      this.qrSubject.next(null);
    });

    this.socket.on('whatsapp:message', (data: any) => {
      this.mensajeSubject.next(data);
    });

    this.socket.on('whatsapp:error', (data: any) => {
      console.error('Error WhatsApp:', data.error);
    });

    this.socket.on('broadcast:progress', (data: ProgresoEnvio) => {
      this.progresoSubject.next(data);
    });

    this.socket.on('scheduler:progress', (data: any) => {
      this.progresoSubject.next(data);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket desconectado del servidor');
    });
  }

  obtenerQR(): Observable<QRResponse> {
    return this.http.get<QRResponse>(`${this.API}/whatsapp/qr`);
  }

  obtenerEstado(): Observable<EstadoWhatsApp> {
    return this.http.get<EstadoWhatsApp>(`${this.API}/whatsapp/estado`);
  }

  obtenerContactos(): Observable<any> {
    return this.http.get<any>(`${this.API}/whatsapp/contacts`);
  }

  obtenerChatInfo(phone: string): Observable<any> {
    return this.http.get<any>(`${this.API}/whatsapp/chat/${phone}`);
  }

  enviarMensaje(phone: string, mensaje: string): Observable<any> {
    return this.http.post(`${this.API}/whatsapp/send`, { phone, message: mensaje });
  }

  iniciarBroadcast(datos: {
    name: string;
    contacts: string[];
    message: string;
    useVariations: boolean;
    variationsCount: number;
    customDelayMin?: number;
    customDelayMax?: number;
    customBatchSize?: number;
    imagenBase64?: string;
  }): Observable<any> {
    return this.http.post(`${this.API}/broadcast/start`, datos);
  }

  obtenerEstadoBroadcast(): Observable<any> {
    return this.http.get(`${this.API}/broadcast/status`);
  }

  pausarBroadcast(): Observable<any> {
    return this.http.post(`${this.API}/broadcast/pause`, {});
  }

  reanudarBroadcast(): Observable<any> {
    return this.http.post(`${this.API}/broadcast/resume`, {});
  }

  cancelarBroadcast(): Observable<any> {
    return this.http.post(`${this.API}/broadcast/cancel`, {});
  }

  obtenerHistorialBroadcast(limit: number = 20): Observable<any> {
    return this.http.get(`${this.API}/broadcast/history?limit=${limit}`);
  }

  generarMensajeIA(prompt: string, businessName?: string, industry?: string): Observable<any> {
    return this.http.post(`${this.API}/ai/generate`, { prompt, businessName, industry });
  }

  generarVariaciones(mensaje: string, count: number = 5): Observable<any> {
    return this.http.post(`${this.API}/ai/variations`, { message: mensaje, count });
  }

  chatIA(mensaje: string, history: any[] = []): Observable<any> {
    return this.http.post(`${this.API}/ai/chat`, { message: mensaje, history });
  }

  obtenerEstadisticas(): Observable<any> {
    return this.http.get(`${this.API}/analytics/stats`);
  }

  obtenerLeadsInteresados(): Observable<any> {
    return this.http.get(`${this.API}/analytics/interested`);
  }

  obtenerLeadsPendientes(): Observable<any> {
    return this.http.get(`${this.API}/analytics/pending`);
  }

  obtenerRespuestas(limit: number = 50): Observable<any> {
    return this.http.get(`${this.API}/analytics/responses?limit=${limit}`);
  }

  marcarComoRespondido(responseId: string): Observable<any> {
    return this.http.post(`${this.API}/analytics/replied/${responseId}`, {});
  }

  desconectar(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  reconectar(): void {
    if (this.socket && !this.socket.connected) {
      this.socket.connect();
    }
  }

  getEstadoActual(): string {
    return this.estadoSubject.value;
  }

  getQRActual(): string | null {
    return this.qrSubject.value;
  }

  estaConectado(): boolean {
    return this.estadoSubject.value === 'conectado';
  }
}