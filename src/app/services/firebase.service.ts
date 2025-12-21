// src/app/services/firebase.service.ts
import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, update, remove, onValue, push } from 'firebase/database';
import { Observable, BehaviorSubject } from 'rxjs';

export interface Equipment {
  id: string;
  codigo: string;           // Código generado automáticamente (AF.EC.MI.CPU.001)
  qrCode?: string;          // Código escaneado del QR/código de barras
  anio: string;             // Año del equipo
  name: string;             // Nombre del equipo (CPU, MONITOR, etc.)
  sucursal: string;         // Sucursal donde está el equipo
  area: string;             // Área dentro de la sucursal
  serialNumber: string;     // Número de serie del fabricante
  marca: string;            // Marca del equipo
  model: string;            // Modelo del equipo
  status: 'disponible' | 'asignado' | 'mantenimiento';
  category: string;         // Categoría (EQUIPOS DE COMPUTO, MEDICOS, MUEBLES)
  accesorios?: string;      // Accesorios incluidos
  responsable?: string;     // Persona responsable (si está asignado)
  observaciones?: string;   // Notas adicionales
  purchaseDate?: string;    // Fecha de compra
  assignedTo?: string;      // Legacy - mantener compatibilidad
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
          // Valores por defecto para campos que pueden no existir en registros antiguos
          codigo: data[key].codigo || '',
          qrCode: data[key].qrCode || '',
          anio: data[key].anio || new Date().getFullYear().toString(),
          name: data[key].name || '',
          sucursal: data[key].sucursal || 'JIPIJAPA',
          area: data[key].area || 'Administración',
          serialNumber: data[key].serialNumber || '',
          marca: data[key].marca || '',
          model: data[key].model || '',
          status: data[key].status || 'disponible',
          category: data[key].category || 'EQUIPOS DE COMPUTO Y ELECTRONICOS',
          accesorios: data[key].accesorios || '',
          responsable: data[key].responsable || '',
          observaciones: data[key].observaciones || '',
          purchaseDate: data[key].purchaseDate || '',
          assignedTo: data[key].assignedTo || '',
          createdAt: data[key].createdAt || new Date().toISOString(),
          updatedAt: data[key].updatedAt || new Date().toISOString(),
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

  // Buscar equipo por código o QR
  findEquipmentByCode(code: string): Equipment | undefined {
    const equipment = this.equipmentSubject.value;
    return equipment.find(eq => 
      eq.codigo === code || 
      eq.qrCode === code || 
      eq.serialNumber === code
    );
  }

  // Buscar equipo por QR (mantener compatibilidad)
  findEquipmentByQR(qrCode: string): Equipment | undefined {
    return this.findEquipmentByCode(qrCode);
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
