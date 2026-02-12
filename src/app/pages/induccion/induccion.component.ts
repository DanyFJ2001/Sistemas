import {
  Component, OnDestroy, HostListener, ElementRef, AfterViewInit
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-induccion',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './induccion.component.html',
  styleUrls: ['./induccion.component.css']
})
export class InduccionComponent implements AfterViewInit, OnDestroy {

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
      points: ['Creación de usuarios con plantilla de datos completa', 'Permisos por perfil y sucursal', 'Gestión de horarios médicos', 'Firma digital P12 para médicos ocupacionales']
    },
    {
      name: 'LABINT', cls: 'c-teal',
      summary: 'Resultados de laboratorio, rayos X y exámenes complementarios.',
      points: ['Sistemas garantiza el funcionamiento del servidor', 'Usuarios y permisos los gestiona Jairo Troya', 'Instalación en equipos personales requiere autorización de Gerencia']
    },
    {
      name: 'Bitrix CRM', cls: 'c-indigo',
      summary: 'Gestión comercial: contactos, negociaciones, cotizaciones y KPIs.',
      points: ['Solo Sistemas y Gerencia son administradores', 'Integración con WhatsApp CRM', 'Capacitaciones disponibles en SeguriLearn']
    },
    {
      name: 'SeguriCloud', cls: 'c-cyan',
      summary: 'Almacenamiento en la nube para toda la documentación corporativa.',
      points: ['Accesos por carpeta y departamento', 'Links compartidos para convenios externos']
    },
    {
      name: 'Zimbra', cls: 'c-violet',
      summary: 'Servidor de correo electrónico empresarial.',
      points: ['Formato: [inicial].[apellido]@segurilab.s', 'Configuración de puertos IMAP/SMTP']
    },
    {
      name: 'Sophos', cls: 'c-red',
      summary: 'Seguridad informática: firewall, antivirus, VPN y antispam.',
      points: ['Filtrado de correos maliciosos', 'VPN para acceso remoto a servidores']
    },
    {
      name: 'SeguriLearn', cls: 'c-green',
      summary: 'Plataforma de capacitaciones con cursos, evaluaciones y certificados.',
      points: ['Cursos sobre pre-admisiones, recepción de resultados, Bitrix y más', 'Certificados automáticos al aprobar']
    },
    {
      name: 'Página Web', cls: 'c-orange',
      summary: 'Sitio institucional público con perfiles médicos y agendamiento.',
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

  constructor(private router: Router, private el: ElementRef) {}

  ngAfterViewInit(): void {
    this.initObservers();
  }

  ngOnDestroy(): void {
    this.sectionObs?.disconnect();
    this.revealObs?.disconnect();
  }

  private initObservers(): void {
    this.sectionObs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) this.activeSection = e.target.id; });
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
      this.el.nativeElement.querySelectorAll('section[id]').forEach((s: Element) => this.sectionObs.observe(s));
      this.el.nativeElement.querySelectorAll('.rv').forEach((el: Element) => this.revealObs.observe(el));
    });
  }

  @HostListener('window:scroll')
  onScroll(): void {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    this.scrollProgress = h > 0 ? (window.scrollY / h) * 100 : 0;
  }

  scrollTo(id: string): void {
    this.sidebarOpen = false;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  toggleSidebar(): void { this.sidebarOpen = !this.sidebarOpen; }
  goToQuiz(): void { this.router.navigate(['/quiz']); }

  randomTechPhrase: string = '';

techPhrases: string[] = [
  '🚀 Iniciando protocolo de inducción...',
  '💻 Conectando a la red de conocimiento',
  '⚡ Sincronizando datos del sistema',
  // ... más frases
];

selectRandomPhrase(): void {
  const randomIndex = Math.floor(Math.random() * this.techPhrases.length);
  this.randomTechPhrase = this.techPhrases[randomIndex];
}

onRobotHover(): void {
  this.selectRandomPhrase();
}

ngOnInit(): void {
  this.selectRandomPhrase();
}
}