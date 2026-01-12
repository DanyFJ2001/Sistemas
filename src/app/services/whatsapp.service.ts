// src/app/services/whatsapp.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

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
  private API = 'http://localhost:3000/api';
  private socket: Socket | null = null;
  
  // BehaviorSubjects para estado en tiempo real
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

  // ========== SOCKET.IO ==========
  private inicializarSocket(): void {
    if (this.socket) return;

    this.socket = io('http://localhost:3000', {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    // Eventos de WhatsApp
    this.socket.on('whatsapp:qr', (data: any) => {
      console.log('📱 QR recibido');
      this.qrSubject.next(data.qr);
    });

    this.socket.on('whatsapp:estado', (data: any) => {
      console.log('📱 Estado:', data.estado);
      this.estadoSubject.next(data.estado);
    });

    this.socket.on('whatsapp:ready', (data: any) => {
      console.log('✅ WhatsApp listo');
      this.estadoSubject.next('conectado');
      this.qrSubject.next(null);
    });

    this.socket.on('whatsapp:disconnected', (data: any) => {
      console.log('❌ WhatsApp desconectado');
      this.estadoSubject.next('desconectado');
    });

    this.socket.on('whatsapp:message', (data: any) => {
      console.log('📨 Mensaje recibido:', data);
      this.mensajeSubject.next(data);
    });

    // Eventos de Broadcast
    this.socket.on('broadcast:progress', (data: ProgresoEnvio) => {
      this.progresoSubject.next(data);
    });

    // Eventos de Scheduler
    this.socket.on('scheduler:progress', (data: any) => {
      console.log('📅 Scheduler:', data.phase);
      this.progresoSubject.next(data);
    });

    console.log('🔌 Socket.IO conectado');
  }

  // ========== WHATSAPP - QR Y ESTADO ==========
  
  obtenerQR(): Observable<QRResponse> {
    return this.http.get<QRResponse>(`${this.API}/whatsapp/qr`);
  }

  obtenerEstado(): Observable<EstadoWhatsApp> {
    return this.http.get<EstadoWhatsApp>(`${this.API}/whatsapp/estado`);
  }

  // ========== WHATSAPP - CONTACTOS ==========
  
  obtenerContactos(): Observable<any> {
    return this.http.get<any>(`${this.API}/whatsapp/contacts`);
  }

  obtenerChatInfo(phone: string): Observable<any> {
    return this.http.get<any>(`${this.API}/whatsapp/chat/${phone}`);
  }

  // ========== ENVÍO INDIVIDUAL ==========
  
  enviarMensaje(phone: string, mensaje: string): Observable<any> {
    return this.http.post(`${this.API}/whatsapp/send`, {
      phone,
      message: mensaje
    });
  }

  // ========== BROADCAST - DIFUSIONES MASIVAS ==========
  
  iniciarBroadcast(datos: {
    name: string;
    contacts: string[];
    message: string;
    useVariations: boolean;
    variationsCount: number;
    customDelayMin?: number;
    customDelayMax?: number;
    customBatchSize?: number;
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

  // ========== AI - GENERACIÓN DE MENSAJES ==========
  
  generarMensajeIA(prompt: string, businessName?: string, industry?: string): Observable<any> {
    return this.http.post(`${this.API}/ai/generate`, {
      prompt,
      businessName,
      industry
    });
  }

  generarVariaciones(mensaje: string, count: number = 5): Observable<any> {
    return this.http.post(`${this.API}/ai/variations`, {
      message: mensaje,
      count
    });
  }

  chatIA(mensaje: string, history: any[] = []): Observable<any> {
    return this.http.post(`${this.API}/ai/chat`, {
      message: mensaje,
      history
    });
  }

  // ========== ANALYTICS ==========
  
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

  // ========== UTILIDADES ==========
  
  desconectar(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getEstadoActual(): string {
    return this.estadoSubject.value;
  }

  getQRActual(): string | null {
    return this.qrSubject.value;
  }
}