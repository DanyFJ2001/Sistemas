// src/app/services/contactos.service.ts
import { Injectable } from '@angular/core';
import { getApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, update, remove, onValue, push, get, Database } from 'firebase/database';
import { Observable, BehaviorSubject } from 'rxjs';

export interface Contacto {
  telefono: string;
  nombre?: string;
  empresa?: string;
  email?: string;
}

export interface BaseContactos {
  id: string;
  nombre: string;
  descripcion?: string;
  contactos: Contacto[];
  totalContactos: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface ResultadoLimpieza {
  contactosOriginales: number;
  contactosLimpios: number;
  duplicadosEliminados: number;
  invalidosEliminados: number;
}

@Injectable({
  providedIn: 'root'
})
export class ContactosService {
  private database!: Database;
  private basesSubject = new BehaviorSubject<BaseContactos[]>([]);
  public bases$ = this.basesSubject.asObservable();

  constructor() {
    this.initFirebase();
  }

  private initFirebase(): void {
    try {
      const apps = getApps();
      if (apps.length > 0) {
        const app = getApp();
        this.database = getDatabase(app);
        console.log('✅ ContactosService: Firebase conectado');
      } else {
        console.error('❌ No hay app de Firebase inicializada');
      }
    } catch (error) {
      console.error('Error inicializando Firebase:', error);
    }
    this.escucharBases();
  }

  private escucharBases(): void {
    if (!this.database) {
      setTimeout(() => this.escucharBases(), 1000);
      return;
    }
    const basesRef = ref(this.database, 'bases_contactos');
    onValue(basesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const basesArray: BaseContactos[] = Object.keys(data).map(key => ({
          id: key,
          nombre: data[key].nombre || '',
          descripcion: data[key].descripcion || '',
          contactos: data[key].contactos || [],
          totalContactos: data[key].totalContactos || 0,
          createdAt: data[key].createdAt || new Date().toISOString(),
          updatedAt: data[key].updatedAt || new Date().toISOString(),
          createdBy: data[key].createdBy || ''
        }));
        basesArray.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        this.basesSubject.next(basesArray);
      } else {
        this.basesSubject.next([]);
      }
    });
  }

  // ========== CRUD BÁSICO ==========

  getBases(): Observable<BaseContactos[]> {
    return this.bases$;
  }

  async getBaseById(id: string): Promise<BaseContactos | null> {
    const baseRef = ref(this.database, `bases_contactos/${id}`);
    const snapshot = await get(baseRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      return { id, ...data };
    }
    return null;
  }

  async crearBase(nombre: string, contactos: Contacto[], descripcion?: string): Promise<BaseContactos> {
    // Limpiar duplicados antes de guardar
    const { contactos: contactosLimpios } = this.limpiarContactos(contactos);
    
    const basesRef = ref(this.database, 'bases_contactos');
    const newBaseRef = push(basesRef);
    const nuevaBase: BaseContactos = {
      id: newBaseRef.key || Date.now().toString(),
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || '',
      contactos: contactosLimpios,
      totalContactos: contactosLimpios.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await set(newBaseRef, nuevaBase);
    return nuevaBase;
  }

  async actualizarBase(id: string, updates: Partial<BaseContactos>): Promise<void> {
    const baseRef = ref(this.database, `bases_contactos/${id}`);
    await update(baseRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  }

  async eliminarBase(id: string): Promise<void> {
    const baseRef = ref(this.database, `bases_contactos/${id}`);
    await remove(baseRef);
  }

  buscarBases(termino: string): BaseContactos[] {
    const bases = this.basesSubject.value;
    const busqueda = termino.toLowerCase().trim();
    if (!busqueda) return bases;
    return bases.filter(b => b.nombre.toLowerCase().includes(busqueda));
  }

  // ========== LIMPIEZA DE DUPLICADOS ==========

  /**
   * Limpia una lista de contactos: elimina duplicados e inválidos
   * Retorna los contactos limpios y estadísticas
   */
  limpiarContactos(contactos: Contacto[]): { contactos: Contacto[], resultado: ResultadoLimpieza } {
    const originales = contactos.length;
    const telefonosVistos = new Set<string>();
    const contactosLimpios: Contacto[] = [];
    let invalidosEliminados = 0;

    for (const contacto of contactos) {
      const telefonoLimpio = this.limpiarTelefono(contacto.telefono);
      
      // Verificar si es válido
      if (!this.esTelefonoValido(telefonoLimpio)) {
        invalidosEliminados++;
        continue;
      }
      
      // Verificar si es duplicado
      if (telefonosVistos.has(telefonoLimpio)) {
        continue;
      }
      
      telefonosVistos.add(telefonoLimpio);
      contactosLimpios.push({
        ...contacto,
        telefono: telefonoLimpio
      });
    }

    const duplicadosEliminados = originales - contactosLimpios.length - invalidosEliminados;

    return {
      contactos: contactosLimpios,
      resultado: {
        contactosOriginales: originales,
        contactosLimpios: contactosLimpios.length,
        duplicadosEliminados,
        invalidosEliminados
      }
    };
  }

  /**
   * Limpia los duplicados de una base existente en Firebase
   */
  async limpiarDuplicadosDeBase(baseId: string): Promise<ResultadoLimpieza> {
    const base = await this.getBaseById(baseId);
    if (!base) {
      throw new Error('Base no encontrada');
    }

    const { contactos, resultado } = this.limpiarContactos(base.contactos);

    await this.actualizarBase(baseId, {
      contactos,
      totalContactos: contactos.length
    });

    console.log(`✅ Base "${base.nombre}" limpiada:`, resultado);
    return resultado;
  }

  /**
   * Combina múltiples bases eliminando duplicados entre todas
   */
  combinarBasesYLimpiar(bases: BaseContactos[]): { contactos: Contacto[], resultado: ResultadoLimpieza } {
    const todosLosContactos: Contacto[] = [];
    bases.forEach(base => {
      todosLosContactos.push(...base.contactos);
    });
    return this.limpiarContactos(todosLosContactos);
  }

  // ========== UTILIDADES DE TELÉFONO ==========

  limpiarTelefono(telefono: string): string {
    if (!telefono) return '';
    
    let limpio = telefono.toString().replace(/\D/g, '');
    
    // Ecuador: Si empieza con 0, cambiar por 593
    if (limpio.startsWith('0')) {
      limpio = '593' + limpio.substring(1);
    }
    
    // Si tiene 9-10 dígitos sin código, agregar 593
    if (limpio.length === 9 || limpio.length === 10) {
      limpio = '593' + limpio;
    }
    
    return limpio;
  }

  esTelefonoValido(telefono: string): boolean {
    if (!telefono) return false;
    const limpio = telefono.replace(/\D/g, '');
    return limpio.length >= 10 && limpio.length <= 15;
  }

  // ========== ESTADÍSTICAS ==========

  obtenerEstadisticas(contactos: Contacto[]): {
    total: number;
    conNombre: number;
    sinNombre: number;
    ecuador: number;
    otros: number;
  } {
    return {
      total: contactos.length,
      conNombre: contactos.filter(c => c.nombre && c.nombre.trim()).length,
      sinNombre: contactos.filter(c => !c.nombre || !c.nombre.trim()).length,
      ecuador: contactos.filter(c => c.telefono.startsWith('593')).length,
      otros: contactos.filter(c => !c.telefono.startsWith('593')).length
    };
  }
}