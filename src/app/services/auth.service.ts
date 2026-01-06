// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  getDatabase, 
  ref, 
  get
} from 'firebase/database';
import { BehaviorSubject } from 'rxjs';
import { UserProfile, UserRole, ROLE_PERMISSIONS } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth: any;
  private database: any;
  
  // Usuario de Firebase Auth
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  // Perfil del usuario con rol (NUEVO)
  private userProfileSubject = new BehaviorSubject<UserProfile | null>(null);
  public userProfile$ = this.userProfileSubject.asObservable();

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

    const app = initializeApp(firebaseConfig);
    this.auth = getAuth(app);
    this.database = getDatabase(app);

    // Escuchar cambios en el estado de autenticación
    onAuthStateChanged(this.auth, async (user) => {
      this.currentUserSubject.next(user);
      
      if (user) {
        console.log('✅ Usuario autenticado:', user.email);
        // NUEVO: Cargar el perfil con el rol
        await this.loadUserProfile(user.uid);
      } else {
        console.log('❌ Usuario no autenticado');
        this.userProfileSubject.next(null);
      }
    });
  }

  // ========== CARGAR PERFIL CON ROL (NUEVO) ==========
  
  private async loadUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const userRef = ref(this.database, `users/${uid}`);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        const profile = snapshot.val() as UserProfile;
        this.userProfileSubject.next(profile);
        console.log('📋 Perfil cargado:', profile.email, '| Rol:', profile.role);
        return profile;
      } else {
        console.warn('⚠️ No se encontró perfil para el usuario:', uid);
        return null;
      }
    } catch (error) {
      console.error('❌ Error cargando perfil:', error);
      return null;
    }
  }

  // ========== LOGIN ==========

  async login(email: string, password: string): Promise<UserProfile> {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      
      // Cargar el perfil con rol
      const profile = await this.loadUserProfile(userCredential.user.uid);
      
      if (!profile) {
        throw new Error('No se encontró tu perfil. Contacta al administrador.');
      }
      
      if (!profile.active) {
        await this.logout();
        throw new Error('Tu cuenta está desactivada. Contacta al administrador.');
      }
      
      return profile;
    } catch (error: any) {
      console.error('❌ Error en login:', error);
      throw this.handleAuthError(error);
    }
  }

  // ========== LOGOUT ==========

  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
      this.currentUserSubject.next(null);
      this.userProfileSubject.next(null);
    } catch (error) {
      console.error('❌ Error en logout:', error);
      throw error;
    }
  }

  // ========== MÉTODOS DE USUARIO ==========

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getUserEmail(): string | null {
    return this.currentUserSubject.value?.email || null;
  }

  isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }

  // ========== MÉTODOS DE ROL (NUEVOS) ==========

  // Obtener el perfil completo del usuario
  getCurrentProfile(): UserProfile | null {
    return this.userProfileSubject.value;
  }

  // Obtener solo el rol
  getUserRole(): UserRole | null {
    return this.userProfileSubject.value?.role || null;
  }

  // Verificar si tiene un permiso específico
  hasPermission(permission: string): boolean {
    const profile = this.userProfileSubject.value;
    if (!profile) return false;
    
    const permissions = ROLE_PERMISSIONS[profile.role] || [];
    return permissions.includes(permission);
  }

  // Verificar si tiene un rol específico
  hasRole(role: UserRole): boolean {
    return this.userProfileSubject.value?.role === role;
  }

  // Verificar si es administrador
  isAdmin(): boolean {
    return this.hasRole('admin');
  }

  // Verificar si es jefe de inventario
  isJefeInventario(): boolean {
    return this.hasRole('jefe_inventario');
  }

  // Verificar si es observador
  isObservador(): boolean {
    return this.hasRole('observador');
  }

  // ========== MANEJO DE ERRORES ==========

  private handleAuthError(error: any): Error {
    // Si ya es un Error con mensaje personalizado, devolverlo
    if (error instanceof Error && !error.message.includes('Firebase')) {
      return error;
    }

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