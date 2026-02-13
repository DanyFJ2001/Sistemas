import {
  Component, OnDestroy, HostListener, ElementRef, AfterViewInit, 
  ViewChild, CUSTOM_ELEMENTS_SCHEMA, OnInit
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-induccion',
  standalone: true,
  imports: [CommonModule, RouterModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './induccion.component.html',
  styleUrls: ['./induccion.component.css']
})
export class InduccionComponent implements OnInit, AfterViewInit, OnDestroy {

  // ══════════════════════════════════════════════════════════
  // 🤖 CONFIGURACIÓN DEL ROBOT LOTTIE
  // ══════════════════════════════════════════════════════════
  
  @ViewChild('robotLottie', { static: false }) robotLottie!: ElementRef;
  
  private lottieInterval: any;
  private lottieCheckAttempts = 0;
  private readonly MAX_CHECK_ATTEMPTS = 10;
  
  // Configuración de timing (en milisegundos)
  private readonly LOTTIE_PLAY_DURATION = 3000;      // Duración de reproducción: 3 segundos
  private readonly LOTTIE_REPEAT_INTERVAL = 90000;   // Repetir cada: 90 segundos (1.5 min)
  
  randomTechPhrase: string = '';

  techPhrases: string[] = [
    'Iniciando protocolo de inducción...',
    'Conectando a la red de conocimiento',
    'Sincronizando datos del sistema',
    'Verificando credenciales de acceso',
    'Estableciendo conexión segura',
    'Activando protocolos de seguridad',
    'Cargando módulos de capacitación',
    'Navegando por el ecosistema digital',
    'Optimizando experiencia de usuario',
    'Configurando herramientas corporativas',
    'Sistema de encriptación activado',
    'Analizando métricas de rendimiento',
    'Interfaz de usuario optimizada',
    'Sincronización en tiempo real',
    'Respaldo de datos en progreso'
  ];

  // ══════════════════════════════════════════════════════════
  // RESTO DE PROPIEDADES DEL COMPONENTE
  // ══════════════════════════════════════════════════════════

  activeSection = 'hero';
  sidebarOpen = false;
  scrollProgress = 0;
  private sectionObs!: IntersectionObserver;
  private revealObs!: IntersectionObserver;

  sidebarItems = [
    { id: 'hero', label: 'Inicio' },
    { id: 'equipo', label: 'Nuestro Equipo' },
    { id: 'plataformas', label: 'Plataformas' },
    { id: 'funciones', label: 'Qué Hacemos' },
    { id: 'flujos', label: 'Flujos de Trabajo' },
    { id: 'canales', label: 'Canales de Soporte' },
    { id: 'lineamientos', label: 'Lo Que Debes Saber' },
  ];

  team = [
    {
      name: 'José Gallardo',
      role: 'Sistemas & Soporte',
      initials: 'JG',
      photo: '../../../assets/images/jose_avatar.jpeg'
    },
    {
      name: 'Dany Fernández',
      role: 'Sistemas & Soporte',
      initials: 'DF',
      photo: '../../../assets/images/dany_avatar.jpeg'
    },
    {
      name: 'Mateo Alvarado',
      role: 'Desarrollo (Remoto — Argentina)',
      initials: 'MA',
      photo: '../../../assets/images/mateo_avatar.png'
    }
  ];

  platforms = [
    {
      name: 'MEDESP', cls: 'c-blue',
      summary: 'Gestión de historias clínicas, agendamientos y administración de pacientes.',
      image: '../../../assets/images/medesp_cap.png',
      points: ['Creación de usuarios con plantilla de datos completa', 'Permisos por perfil y sucursal', 'Gestión de horarios médicos', 'Firma digital P12 para médicos ocupacionales']
    },
    {
      name: 'LABINT', cls: 'c-teal',
      summary: 'Resultados de laboratorio, rayos X y exámenes complementarios.',
      image: '../../../assets/images/labint_cap.png',
      points: ['Sistemas garantiza el funcionamiento del servidor', 'Usuarios y permisos los gestiona Jairo Troya', 'Instalación en equipos personales requiere autorización de Gerencia']
    },
    {
      name: 'Bitrix CRM', cls: 'c-indigo',
      summary: 'Gestión comercial: contactos, negociaciones, cotizaciones y KPIs.',
      image: '../../../assets/images/bitrix_cap.png',
      points: ['Solo Sistemas y Gerencia son administradores', 'Integración con WhatsApp CRM', 'Capacitaciones disponibles en SeguriLearn']
    },
    {
      name: 'SeguriCloud', cls: 'c-cyan',
      summary: 'Almacenamiento en la nube para toda la documentación corporativa.',
      image: '../../../assets/images/nube_cap.png',
      points: ['Accesos por carpeta y departamento', 'Links compartidos para convenios externos']
    },
    {
      name: 'Zimbra', cls: 'c-violet',
      summary: 'Servidor de correo electrónico empresarial.',
      image: '../../../assets/images/zimbra_cap.png',
      points: ['Formato: [inicial].[apellido]@segurilab.s', 'Configuración de puertos IMAP/SMTP']
    },
    {
      name: 'Sophos', cls: 'c-red',
      summary: 'Seguridad informática: firewall, antivirus, VPN y antispam.',
      image: '../../../assets/images/sophos_cap.png',
      points: ['Filtrado de correos maliciosos', 'VPN para acceso remoto a servidores']
    },
    {
      name: 'SeguriLearn', cls: 'c-green',
      summary: 'Plataforma de capacitaciones con cursos, evaluaciones y certificados.',
      image: '../../../assets/images/segurilearn_cap.png',
      points: ['Cursos sobre pre-admisiones, recepción de resultados, Bitrix y más', 'Certificados automáticos al aprobar']
    },
    {
      name: 'Página Web', cls: 'c-orange',
      summary: 'Sitio institucional público con perfiles médicos y agendamiento.',
      image: '../../../assets/images/segurilab_cap.png',
      points: ['Perfiles de médicos vinculados con MEDESP', 'Códigos QR para agendamiento por especialidad']
    }
  ];

  flujoIngreso = [
    'RRHH o Gerencia comunica el nuevo ingreso.',
    'Se solicita la plantilla de datos del colaborador.',
    'Se crean credenciales: correo (Zimbra), MEDESP, SeguriCloud, Bitrix si aplica.',
    'Se entrega credenciales y se configura el equipo de trabajo.',
    'Se asigna equipo tecnológico con acta de entrega firmada.',
    'Se indica completar capacitaciones en SeguriLearn.'
  ];

  flujoSoporte = [
    'Intentar resolver por cuenta propia (SeguriLearn, compañeros).',
    'Si persiste y es nivel intermedio o superior, contactar a Sistemas.',
    'El Área evalúa y resuelve, contacta proveedor o atiende vía AnyDesk.',
    'Se documenta la solución aplicada.'
  ];

  lightboxImage: string | null = null;
  openImage(src: string): void { this.lightboxImage = src; }

  constructor(private router: Router, private el: ElementRef) {
    console.log('🔧 InduccionComponent constructor - Componente inicializado');
  }

  // ══════════════════════════════════════════════════════════
  // 🎬 LIFECYCLE HOOKS
  // ══════════════════════════════════════════════════════════

  ngOnInit(): void {
    console.log('🎬 ngOnInit - Inicializando componente');
    this.selectRandomPhrase();
    console.log('💬 Frase inicial seleccionada:', this.randomTechPhrase);
  }

  ngAfterViewInit(): void {
    console.log('🎬 ngAfterViewInit - Vista inicializada');
    
    // Inicializar observadores de secciones
    this.initObservers();
    
    // Esperar un tick para que el ViewChild esté disponible
    setTimeout(() => {
      console.log('⏱️ Timeout ejecutado - Verificando elemento Lottie...');
      this.checkAndSetupLottie();
    }, 20000); // Aumentado a 200ms para dar más tiempo
  }

  ngOnDestroy(): void {
    console.log('🧹 ngOnDestroy - Limpiando recursos');
    
    this.sectionObs?.disconnect();
    this.revealObs?.disconnect();
    
    // Limpiar el intervalo de Lottie
    if (this.lottieInterval) {
      console.log('🛑 Deteniendo intervalo de Lottie');
      clearInterval(this.lottieInterval);
    }
  }

  // ══════════════════════════════════════════════════════════
  // 🤖 CONTROL DE ANIMACIÓN LOTTIE CON DEBUGGING
  // ══════════════════════════════════════════════════════════

  /**
   * Verifica si el elemento Lottie está disponible y configura el loop
   */
  private checkAndSetupLottie(): void {
    console.log('🔍 Verificando disponibilidad de elemento Lottie...');
    console.log('📊 ViewChild robotLottie:', this.robotLottie);
    
    if (this.robotLottie && this.robotLottie.nativeElement) {
      console.log('✅ Elemento Lottie encontrado:', this.robotLottie.nativeElement);
      console.log('🎯 Tag del elemento:', this.robotLottie.nativeElement.tagName);
      this.setupLottieLoop();
    } else {
      this.lottieCheckAttempts++;
      console.warn(`⚠️ Elemento Lottie no encontrado. Intento ${this.lottieCheckAttempts}/${this.MAX_CHECK_ATTEMPTS}`);
      
      if (this.lottieCheckAttempts < this.MAX_CHECK_ATTEMPTS) {
        // Reintentar después de 300ms
        setTimeout(() => this.checkAndSetupLottie(), 300);
      } else {
        console.error('❌ ERROR: No se pudo encontrar el elemento Lottie después de múltiples intentos');
        console.error('💡 Verifica que:');
        console.error('   1. El elemento <dotlottie-wc> tiene el #robotLottie template reference');
        console.error('   2. CUSTOM_ELEMENTS_SCHEMA está en los schemas del componente');
        console.error('   3. El elemento está visible en el DOM (no oculto por ngIf)');
      }
    }
  }

  /**
   * Configura el loop de la animación Lottie
   */
  private setupLottieLoop(): void {
    const lottieElement = this.robotLottie.nativeElement;
    
    console.log('🎬 Configurando loop de animación Lottie');
    console.log('⏱️ Duración de reproducción:', this.LOTTIE_PLAY_DURATION, 'ms');
    console.log('🔁 Intervalo de repetición:', this.LOTTIE_REPEAT_INTERVAL, 'ms');
    console.log('📍 Elemento:', lottieElement);
    
    // Verificar que el elemento tiene los métodos necesarios
    if (typeof lottieElement.play !== 'function') {
      console.warn('⚠️ El elemento no tiene el método play() disponible');
      console.log('🔍 Métodos disponibles:', Object.getOwnPropertyNames(Object.getPrototypeOf(lottieElement)));
      return;
    }
    
    // Función para reproducir la animación
    const playAnimation = () => {
      console.log('▶️ Reproduciendo animación Lottie');
      
      try {
        lottieElement.play();
        console.log('✅ play() ejecutado exitosamente');
        
        // Detener después de LOTTIE_PLAY_DURATION
        setTimeout(() => {
          console.log('⏸️ Deteniendo animación Lottie');
          
          if (typeof lottieElement.stop === 'function') {
            lottieElement.stop();
            console.log('✅ stop() ejecutado exitosamente');
          } else {
            console.warn('⚠️ El elemento no tiene el método stop() disponible');
          }
        }, this.LOTTIE_PLAY_DURATION);
        
      } catch (error) {
        console.error('❌ Error al ejecutar play():', error);
      }
    };

    // Primera reproducción inmediata
    console.log('🚀 Iniciando primera reproducción...');
    playAnimation();

    // Configurar intervalo para repeticiones
    console.log(`🔁 Configurando repetición cada ${this.LOTTIE_REPEAT_INTERVAL / 1000} segundos`);
    this.lottieInterval = setInterval(() => {
      console.log('🔄 Ciclo de repetición activado');
      playAnimation();
    }, this.LOTTIE_REPEAT_INTERVAL);
    
    console.log('✅ Loop de Lottie configurado correctamente');
  }

  // ══════════════════════════════════════════════════════════
  // 💬 GESTIÓN DE FRASES TECNOLÓGICAS
  // ══════════════════════════════════════════════════════════

  /**
   * Selecciona una frase tech aleatoria
   */
  selectRandomPhrase(): void {
    const previousPhrase = this.randomTechPhrase;
    const randomIndex = Math.floor(Math.random() * this.techPhrases.length);
    this.randomTechPhrase = this.techPhrases[randomIndex];
    
    console.log('🎲 Frase seleccionada:');
    console.log('   Anterior:', previousPhrase);
    console.log('   Nueva:', this.randomTechPhrase);
  }

  /**
   * Cambia la frase cuando el usuario pasa el mouse sobre el robot
   */
  onRobotHover(): void {
    console.log('🖱️ Hover detectado en el robot');
    this.selectRandomPhrase();
  }

  // ══════════════════════════════════════════════════════════
  // 📍 OBSERVERS Y NAVEGACIÓN
  // ══════════════════════════════════════════════════════════

  private initObservers(): void {
    console.log('👀 Inicializando IntersectionObservers');
    
    this.sectionObs = new IntersectionObserver(entries => {
      entries.forEach(e => { 
        if (e.isIntersecting) {
          console.log('📍 Sección activa:', e.target.id);
          this.activeSection = e.target.id;
        }
      });
    }, { rootMargin: '-20% 0px -60% 0px' });

    this.revealObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in-view');
          this.revealObs.unobserve(e.target);
        }
      });
    }, { threshold: 0.06 });

    requestAnimationFrame(() => {
      const sections = this.el.nativeElement.querySelectorAll('section[id]');
      const revealElements = this.el.nativeElement.querySelectorAll('.rv');
      
      console.log('📊 Secciones encontradas:', sections.length);
      console.log('✨ Elementos reveal encontrados:', revealElements.length);
      
      sections.forEach((s: Element) => this.sectionObs.observe(s));
      revealElements.forEach((el: Element) => this.revealObs.observe(el));
    });
  }

  @HostListener('window:scroll')
  onScroll(): void {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    this.scrollProgress = h > 0 ? (window.scrollY / h) * 100 : 0;
  }

  scrollTo(id: string): void {
    console.log('🔗 Navegando a:', id);
    this.sidebarOpen = false;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  toggleSidebar(): void { 
    this.sidebarOpen = !this.sidebarOpen;
    console.log('📱 Sidebar:', this.sidebarOpen ? 'abierto' : 'cerrado');
  }

  goToQuiz(): void { 
    console.log('📝 Navegando al quiz');
    this.router.navigate(['/quiz']); 
  }
  
  contactOpen = false;
  toggleContact(): void { this.contactOpen = !this.contactOpen; }
}