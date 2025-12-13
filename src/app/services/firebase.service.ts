// src/app/services/firebase.service.ts
import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, update, remove, onValue, push } from 'firebase/database';
import { Observable, BehaviorSubject } from 'rxjs';

export interface Equipment {
  id: string;
  codigo: string;              // CODIGO (código de barras escaneado)
  anio: string;                 // AÑO
  name: string;                 // NOMBRE DEL EQUIPO
  sucursal: string;             // SUCURSAL
  area: string;                 // AREA
  serialNumber: string;         // NUMERO DE SERIE
  marca: string;                // MARCA
  model: string;                // MODELO
  status: 'disponible' | 'asignado' | 'mantenimiento';  // STATUS
  accesorios: string;           // ACCESORIOS
  responsable: string;          // RESPONSABLE (antes assignedTo)
  observaciones: string;        // OBSERVACIONES
  
  // Campos adicionales del sistema
  category: string;
  qrCode?: string;
  purchaseDate?: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private app: any;
  private database: any;
  private equipmentSubject = new BehaviorSubject<Equipment[]>([]);
  public equipment$ = this.equipmentSubject.asObservable();

  constructor() {
    this.initFirebase();
  }

  private initFirebase(): void {
    const firebaseConfig = {
      apiKey: "AIzaSyDzgcUjSj2i53ITnBAyGrBpLSLRxqBmiIE",
      authDomain: "prueba-bfc8a.firebaseapp.com",
      databaseURL: "https://prueba-bfc8a-default-rtdb.firebaseio.com",
      projectId: "prueba-bfc8a",
      storageBucket: "prueba-bfc8a.firebasestorage.app",
      messagingSenderId: "885825894999",
      appId: "1:885825894999:web:8a54a876f9d21715d50112",
      measurementId: "G-ER59DQF2D7"
    };

    this.app = initializeApp(firebaseConfig);
    this.database = getDatabase(this.app);
    
    // Escuchar cambios en tiempo real
    this.listenToEquipment();
  }

  private listenToEquipment(): void {
    const equipmentRef = ref(this.database, 'equipment');
    
    onValue(equipmentRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const equipmentArray: Equipment[] = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        this.equipmentSubject.next(equipmentArray);
      } else {
        this.equipmentSubject.next([]);
      }
    });
  }

  // Obtener todos los equipos
  getEquipment(): Observable<Equipment[]> {
    return this.equipment$;
  }

  // Agregar equipo
  async addEquipment(equipment: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Equipment> {
    try {
      const equipmentRef = ref(this.database, 'equipment');
      const newEquipmentRef = push(equipmentRef);
      
      const newEquipment: Equipment = {
        ...equipment,
        id: newEquipmentRef.key || this.generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await set(newEquipmentRef, newEquipment);
      return newEquipment;
    } catch (error) {
      console.error('Error al agregar equipo:', error);
      throw error;
    }
  }

  // Actualizar equipo
  async updateEquipment(id: string, updates: Partial<Equipment>): Promise<void> {
    try {
      const equipmentRef = ref(this.database, `equipment/${id}`);
      await update(equipmentRef, {
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error al actualizar equipo:', error);
      throw error;
    }
  }

  // Eliminar equipo
  async deleteEquipment(id: string): Promise<void> {
    try {
      const equipmentRef = ref(this.database, `equipment/${id}`);
      await remove(equipmentRef);
    } catch (error) {
      console.error('Error al eliminar equipo:', error);
      throw error;
    }
  }

  // Buscar equipo por código de barras
  findEquipmentByCode(codigo: string): Equipment | undefined {
    const equipment = this.equipmentSubject.value;
    return equipment.find(eq => eq.codigo === codigo || eq.qrCode === codigo);
  }

  // Buscar equipo por serie
  findEquipmentBySerial(serialNumber: string): Equipment | undefined {
    const equipment = this.equipmentSubject.value;
    return equipment.find(eq => eq.serialNumber === serialNumber);
  }

  // Generar ID único
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Obtener estadísticas
  getStats(): Observable<any> {
    return new Observable(observer => {
      this.equipment$.subscribe(equipment => {
        const stats = {
          totalEquipment: equipment.length,
          assignedEquipment: equipment.filter(eq => eq.status === 'asignado').length,
          availableEquipment: equipment.filter(eq => eq.status === 'disponible').length,
          maintenanceEquipment: equipment.filter(eq => eq.status === 'mantenimiento').length
        };
        observer.next(stats);
      });
    });
  }
}