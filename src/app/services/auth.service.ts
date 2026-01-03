// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User,
  browserLocalPersistence,
  setPersistence
} from 'firebase/auth';
import { Observable, BehaviorSubject } from 'rxjs';
import { filter, take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth: any;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  // NUEVO: Estado de inicialización
  private authInitializedSubject = new BehaviorSubject<boolean>(false);
  public authInitialized$ = this.authInitializedSubject.asObservable();

  constructor() {
    this.initFirebaseAuth();
  }

  private async initFirebaseAuth(): Promise<void> {
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

    const app = initializeApp(firebaseConfig);
    this.auth = getAuth(app);

    // Configurar persistencia local
    try {
      await setPersistence(this.auth, browserLocalPersistence);
    } catch (error) {
      console.error('Error configurando persistencia:', error);
    }

    // Escuchar cambios en el estado de autenticación
    onAuthStateChanged(this.auth, (user) => {
      this.currentUserSubject.next(user);
      
      // Marcar como inicializado después del primer check
      if (!this.authInitializedSubject.value) {
        this.authInitializedSubject.next(true);
      }
      
      if (user) {
        console.log('✅ Usuario autenticado:', user.email);
      } else {
        console.log('❌ Usuario no autenticado');
      }
    });
  }

  // Login con email y password
  async login(email: string, password: string): Promise<User> {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      return userCredential.user;
    } catch (error: any) {
      console.error('Error en login:', error);
      throw this.handleAuthError(error);
    }
  }

  // Logout
  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
      this.currentUserSubject.next(null);
    } catch (error) {
      console.error('Error en logout:', error);
      throw error;
    }
  }

  // Obtener usuario actual
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  // Verificar si está autenticado
  isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }

  // NUEVO: Esperar a que Firebase termine de inicializar
  waitForAuthInit(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.authInitializedSubject.value) {
        resolve(this.isAuthenticated());
      } else {
        this.authInitialized$.pipe(
          filter(initialized => initialized),
          take(1)
        ).subscribe(() => {
          resolve(this.isAuthenticated());
        });
      }
    });
  }

  // Obtener email del usuario
  getUserEmail(): string | null {
    return this.currentUserSubject.value?.email || null;
  }

  // Manejo de errores de Firebase Auth
  private handleAuthError(error: any): Error {
    let message = 'Error al iniciar sesión';
    switch (error.code) {
      case 'auth/invalid-email':
        message = 'El correo electrónico no es válido';
        break;
      case 'auth/user-disabled':
        message = 'Esta cuenta ha sido deshabilitada';
        break;
      case 'auth/user-not-found':
        message = 'No existe una cuenta con este correo';
        break;
      case 'auth/wrong-password':
        message = 'Contraseña incorrecta';
        break;
      case 'auth/invalid-credential':
        message = 'Credenciales inválidas. Verifica tu correo y contraseña';
        break;
      case 'auth/too-many-requests':
        message = 'Demasiados intentos fallidos. Intenta más tarde';
        break;
      case 'auth/network-request-failed':
        message = 'Error de conexión. Verifica tu internet';
        break;
      default:
        message = error.message || 'Error al iniciar sesión';
    }
    return new Error(message);
  }
}