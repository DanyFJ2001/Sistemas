import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ElementRef,
  AfterViewInit
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

interface TeamMember {
  name: string;
  role: string;
  icon: string;
}

interface Platform {
  name: string;
  description: string;
  icon: string;
  tags: string[];
}

interface SidebarItem {
  id: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-induccion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './induccion.component.html',
  styleUrls: ['./induccion.component.css']
})
export class InduccionComponent implements OnInit, AfterViewInit, OnDestroy {

  activeSection = 'hero';
  sidebarOpen = false;
  scrollProgress = 0;
  animatedSections: Set<string> = new Set();
  private observer!: IntersectionObserver;
  private animObserver!: IntersectionObserver;

  sidebarItems: SidebarItem[] = [
    { id: 'hero', label: 'Inicio', icon: '🏠' },
    { id: 'estructura', label: 'Estructura del Área', icon: '🏗️' },
    { id: 'plataformas', label: 'Plataformas y Sistemas', icon: '💻' },
    { id: 'infraestructura', label: 'Infraestructura y Redes', icon: '🌐' },
    { id: 'soporte', label: 'Soporte Técnico', icon: '🔧' },
    { id: 'mantenimiento', label: 'Mantenimiento', icon: '⚙️' },
    { id: 'desarrollo', label: 'Desarrollo', icon: '🚀' },
    { id: 'flujos', label: 'Flujos de Trabajo', icon: '📋' },
    { id: 'canales', label: 'Canales de Soporte', icon: '📡' },
    { id: 'lineamientos', label: 'Lineamientos', icon: '📜' },
    { id: 'responsabilidades', label: 'Responsabilidades', icon: '✅' }
  ];

  teamMembers: TeamMember[] = [
    { name: 'José Gallardo', role: 'Sistemas & Soporte', icon: 'JG' },
    { name: 'Dany Fernández', role: 'Sistemas & Soporte', icon: 'DF' },
    { name: 'Mateo Alvarado', role: 'Desarrollo Principal (Remoto — Argentina)', icon: 'MA' }
  ];

  platforms: Platform[] = [
    {
      name: 'MEDESP',
      description: 'Software propio para gestión de historias clínicas, agendamientos y administración de pacientes. Creación de usuarios, asignación de permisos, reseteo de contraseñas y gestión de horarios médicos.',
      icon: '🏥',
      tags: ['Software Propio', 'Historias Clínicas', 'Agendamientos']
    },
    {
      name: 'LABINT',
      description: 'Software externo para recepción y visualización de resultados de laboratorio, rayos X y exámenes. El Área de Sistemas garantiza el funcionamiento del servidor e instala la aplicación. La creación de usuarios la gestiona Jairo Troya (Asistente de Gerencia).',
      icon: '🔬',
      tags: ['Software Externo', 'Resultados', 'Laboratorio']
    },
    {
      name: 'Bitrix (CRM)',
      description: 'CRM enfocado en el Área Comercial: contactos, compañías, negociaciones y cotizaciones. Solo Sistemas y Gerencia tienen acceso como administrador. Incluye integración con WhatsApp CRM y generación de KPIs.',
      icon: '📊',
      tags: ['CRM', 'Área Comercial', 'KPIs']
    },
    {
      name: 'SeguriCloud',
      description: 'Drive en la nube corporativo donde se resguarda toda la documentación de la empresa. Se gestionan accesos, permisos por carpeta/departamento y links compartidos para convenios con empresas externas.',
      icon: '☁️',
      tags: ['Almacenamiento', 'Documentación', 'Permisos']
    },
    {
      name: 'Zimbra',
      description: 'Servidor de correos electrónicos empresariales. Formato: [inicial].[apellido]@segurilab.s — Se configuran puertos IMAP/SMTP para acceso en Outlook, Gmail u otras plataformas.',
      icon: '✉️',
      tags: ['Correo', 'Credenciales', 'Comunicación']
    },
    {
      name: 'Sophos',
      description: 'Gestión de firewall, antivirus, VPN y antispam. Filtrado de correos maliciosos, gestión de cuarentena, VPN para acceso remoto a servidores y ciberseguridad general.',
      icon: '🛡️',
      tags: ['Seguridad', 'Firewall', 'VPN']
    },
    {
      name: 'SeguriLearn',
      description: 'Plataforma de capacitaciones en WordPress. Se cargan cursos, videos, documentos, evaluaciones y se emiten certificados automáticos al aprobar.',
      icon: '🎓',
      tags: ['Capacitaciones', 'Cursos', 'Certificados']
    },
    {
      name: 'Página Web Segurilab',
      description: 'Sitio web institucional público. Gestión de diseño, contenido, perfiles de médicos vinculados con MEDESP y códigos QR para agendamiento por especialidad.',
      icon: '🌍',
      tags: ['Web Pública', 'Dominio', 'QR']
    },
    {
      name: 'Inventario Data Center',
      description: 'Plataforma web propia para gestionar el inventario de todos los equipos tecnológicos del data center y sucursal Chiris. Vinculada con contabilidad de activos fijos.',
      icon: '🗄️',
      tags: ['Desarrollo Propio', 'Inventario', 'Activos']
    },
    {
      name: 'Turnero',
      description: 'Sistema de gestión de turnos desarrollado, desplegado y mantenido internamente por el Área de Sistemas. Completamente operativo.',
      icon: '🎫',
      tags: ['Desarrollo Propio', 'Turnos', 'Operativo']
    }
  ];

  flujoNuevoIngreso: string[] = [
    'RRHH o Gerencia comunica el ingreso del nuevo colaborador.',
    'Se solicita la plantilla de datos completa (nombre, apellidos, cédula, fecha de nacimiento, estado civil, tipo de sangre, email, teléfono, área, especialidad, sucursal, dirección; firma P12 si es médico ocupacional).',
    'Se crean credenciales según perfil: correo empresarial (Zimbra), usuario MEDESP, acceso a SeguriCloud, usuario Bitrix (si aplica), horarios MEDESP (si es médico).',
    'Se entrega credenciales y se configura el equipo de trabajo.',
    'Se asigna equipo tecnológico con acta de entrega firmada (si corresponde).',
    'Se indica completar capacitaciones en SeguriLearn.'
  ];

  flujoSalida: string[] = [
    'RRHH o Gerencia comunica la salida del colaborador.',
    'Se bloquean/deshabilitan credenciales en todas las plataformas: MEDESP, correo, SeguriCloud, Bitrix.',
    'Se recoge equipo tecnológico y se actualiza inventario.'
  ];

  flujoSoporte: string[] = [
    'El empleado intenta resolver el problema por su cuenta (buscar solución, consultar compañeros, revisar SeguriLearn).',
    'Si persiste y es de nivel intermedio o superior, se contacta al Área de Sistemas.',
    'El Área evalúa: problema conocido → resuelve directo; software externo (LABINT, Bitrix) → contacta proveedor; remoto → AnyDesk.',
    'Se documenta la solución aplicada.'
  ];

  constructor(private router: Router, private el: ElementRef) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.setupIntersectionObserver();
  }

  ngOnDestroy(): void {
    if (this.observer) this.observer.disconnect();
    if (this.animObserver) this.animObserver.disconnect();
  }

  setupIntersectionObserver(): void {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.activeSection = entry.target.id;
          this.animatedSections.add(entry.target.id);
        }
      });
    }, { root: null, rootMargin: '-20% 0px -60% 0px', threshold: 0 });

    this.animObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    setTimeout(() => {
      const sections = this.el.nativeElement.querySelectorAll('section[id]');
      sections.forEach((section: Element) => this.observer.observe(section));

      const animElements = this.el.nativeElement.querySelectorAll('.animate-on-scroll');
      animElements.forEach((el: Element) => this.animObserver.observe(el));
    }, 100);
  }

  @HostListener('window:scroll')
  onScroll(): void {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    this.scrollProgress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
  }

  scrollTo(sectionId: string): void {
    this.sidebarOpen = false;
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  goToQuiz(): void {
    this.router.navigate(['/induccion/evaluacion']);
  }
}