// src/app/pages/analytics/analytics.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../app/enviroments/enviroment';

interface Stats {
  broadcasts: number;
  sent: number;
  failed: number;
  responses: number;
  interested: number;
  negative: number;
  responseRate: string;
  interestRate: string;
}

interface Lead {
  id: string;
  from: string;
  body: string;
  timestamp: string;
  interest: string;
  matchedKeyword: string;
  broadcastName: string;
  replied: boolean;
  repliedAt?: string;
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.css']
})
export class AnalyticsComponent implements OnInit, OnDestroy {
  stats: Stats = {
    broadcasts: 0,
    sent: 0,
    failed: 0,
    responses: 0,
    interested: 0,
    negative: 0,
    responseRate: '0',
    interestRate: '0'
  };

  leads: Lead[] = [];
  filteredLeads: Lead[] = [];
  
  cargando = true;
  filtro: 'todos' | 'pendientes' | 'respondidos' = 'todos';
  busqueda = '';
  
  private destroy$ = new Subject<void>();
  private socket: Socket | null = null;
  private readonly API = `${environment.apiUrl}/api`;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.cargarDatos();
    this.inicializarSocket();
    setInterval(() => this.cargarDatos(), 15000);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.socket) this.socket.disconnect();
  }

  inicializarSocket() {
    try {
      this.socket = io(environment.apiUrl, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => console.log('✅ Socket conectado al backend'));
      this.socket.on('disconnect', () => console.log('❌ Socket desconectado'));

      this.socket.on('whatsapp:message', () => this.cargarDatos());
      this.socket.on('analytics:response', () => this.cargarDatos());
      this.socket.on('analytics:interested', () => this.cargarDatos());

    } catch (error) {
      console.error('❌ Error inicializando socket:', error);
    }
  }

  cargarDatos() {
    this.http.get<{ success: boolean; stats: Stats }>(`${this.API}/analytics/stats`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.stats = response.stats;
          this.cargando = false;
        },
        error: (error) => {
          console.error('❌ Error cargando estadísticas:', error);
          this.cargando = false;
        }
      });

    this.http.get<{ success: boolean; leads: Lead[] }>(`${this.API}/analytics/interested`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.leads = response.leads || [];
          this.aplicarFiltros();
        },
        error: (error) => console.error('❌ Error cargando leads:', error)
      });
  }

  aplicarFiltros() {
    let resultado = this.leads;

    if (this.filtro === 'pendientes') {
      resultado = resultado.filter(l => !l.replied);
    } else if (this.filtro === 'respondidos') {
      resultado = resultado.filter(l => l.replied);
    }

    if (this.busqueda.trim()) {
      const busquedaBaja = this.busqueda.toLowerCase();
      resultado = resultado.filter(l =>
        l.from.includes(busquedaBaja) ||
        l.body.toLowerCase().includes(busquedaBaja) ||
        l.matchedKeyword.toLowerCase().includes(busquedaBaja)
      );
    }

    this.filteredLeads = resultado;
  }

  onFiltroChange(nuevoFiltro: 'todos' | 'pendientes' | 'respondidos') {
    this.filtro = nuevoFiltro;
    this.aplicarFiltros();
  }

  onBusquedaChange(texto: string) {
    this.busqueda = texto;
    this.aplicarFiltros();
  }

  marcarComoRespondido(leadId: string) {
    this.http.post(`${this.API}/analytics/replied/${leadId}`, {})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.cargarDatos(),
        error: (error) => console.error('❌ Error:', error)
      });
  }

  copiarNumero(telefono: string) {
    navigator.clipboard.writeText(telefono);
    alert('✅ Teléfono copiado: ' + telefono);
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleString('es-ES');
  }

  obtenerColorKeyword(keyword: string): string {
    const keywords: { [key: string]: string } = {
      'info': '#4CAF50',
      'precio': '#2196F3',
      'interesado': '#FF9800',
      'si': '#9C27B0',
      'me interesa': '#FF9800'
    };
    return keywords[keyword.toLowerCase()] || '#0066cc';
  }

  get leadsPendientes(): number { return this.leads.filter(l => !l.replied).length; }
  get leadsRespondidos(): number { return this.leads.filter(l => l.replied).length; }
  get totalLeads(): number { return this.leads.length; }

  getSuccessRate(): number {
    if (this.stats.sent === 0) return 0;
    return Math.round(((this.stats.sent - this.stats.failed) / this.stats.sent) * 100);
  }

  getResponsePercentage(): number { return parseFloat(this.stats.responseRate); }
  getInterestPercentage(): number { return parseFloat(this.stats.interestRate); }

  getNegativePercentage(): number {
    if (this.stats.responses === 0) return 0;
    return Math.round((this.stats.negative / this.stats.responses) * 100);
  }
}