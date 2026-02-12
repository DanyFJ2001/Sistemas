import { Component, OnInit, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

interface QuizCard {
  id: number;
  question: string;
  shortTitle: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  selectedIndex: number | null;
  flipped: boolean;
}

@Component({
  selector: 'app-induccion-quiz',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quiz.component.html',
  styleUrls: ['./quiz.component.css']
})
export class InduccionQuizComponent implements OnInit, AfterViewInit, OnDestroy {

  cards: QuizCard[] = [];
  animateIn = false;
  private revealObs!: IntersectionObserver;

  constructor(private router: Router, private el: ElementRef) {}

  ngOnInit(): void {
    this.loadCards();
    setTimeout(() => this.animateIn = true, 80);
  }

  ngAfterViewInit(): void {
    this.revealObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in-view'); this.revealObs.unobserve(e.target); }
      });
    }, { threshold: 0.05 });
    requestAnimationFrame(() => {
      this.el.nativeElement.querySelectorAll('.rv').forEach((el: Element) => this.revealObs.observe(el));
    });
  }

  ngOnDestroy(): void { this.revealObs?.disconnect(); }

  loadCards(): void {
    const raw: { t: string; q: string; o: string[]; c: number; e: string }[] = [
      {
        t: '¿Qué es MEDESP?',
        q: '¿Qué es MEDESP dentro de Segurilab?',
        o: ['Un CRM para el área comercial', 'Un software de contabilidad', 'Software propio para historias clínicas y agendamientos', 'El servidor de correos'],
        c: 2,
        e: 'MEDESP es el software principal de Segurilab, desarrollado internamente, que gestiona todo el ciclo de atención al paciente: desde el agendamiento hasta las historias clínicas.'
      },
      {
        t: 'Usuarios de LABINT',
        q: '¿Quién gestiona los usuarios y permisos de LABINT?',
        o: ['El Área de Sistemas', 'Cada empleado', 'Jairo Troya (Asistente de Gerencia)', 'El proveedor externo'],
        c: 2,
        e: 'Aunque Sistemas se encarga del servidor y la instalación, los usuarios y permisos de LABINT los administra Jairo Troya como Asistente de Gerencia.'
      },
      {
        t: 'Antes de contactar Sistemas',
        q: '¿Qué debes hacer ANTES de contactar al Área de Sistemas?',
        o: ['Enviar correo a gerencia', 'Autogestionar, revisar SeguriLearn y consultar compañeros', 'Apagar el equipo y esperar', 'Llamar al proveedor'],
        c: 1,
        e: 'El flujo indica que primero debes intentar resolver el problema por cuenta propia, revisar materiales en SeguriLearn y consultar con compañeros antes de escalar.'
      },
      {
        t: 'Formato de correo',
        q: '¿Cuál es el formato del correo empresarial?',
        o: ['nombre.apellido@gmail.com', '[inicial].[apellido]@segurilab.s', 'apellido@segurilab.com', 'nombre@segurilab.ec'],
        c: 1,
        e: 'El formato estándar es la inicial del primer nombre, punto, apellido, seguido de @segurilab.s. Ejemplo: j.gallardo@segurilab.s'
      },
      {
        t: 'Herramienta de seguridad',
        q: '¿Qué herramienta se usa para firewall, antivirus y VPN?',
        o: ['Bitrix', 'Navicat', 'Zimbra', 'Sophos'],
        c: 3,
        e: 'Sophos es la plataforma integral de ciberseguridad. Gestiona firewall, antivirus, VPN para acceso remoto y antispam del correo electrónico.'
      },
      {
        t: 'Software en equipos personales',
        q: '¿Qué se necesita para instalar software en un equipo personal?',
        o: ['Solo la solicitud del empleado', 'Autorización del jefe inmediato', 'Autorización de Gerencia General', 'No se puede instalar nada'],
        c: 2,
        e: 'Cualquier instalación en equipos personales requiere autorización directa de la Gerencia General (Dra. Sofía Alarcón). Aplica especialmente para LABINT.'
      },
      {
        t: '¿Qué es SeguriLearn?',
        q: '¿Qué es SeguriLearn?',
        o: ['Sistema de agendamiento', 'Plataforma de capacitaciones con cursos y certificados', 'Inventario del data center', 'Servidor de correos'],
        c: 1,
        e: 'SeguriLearn es la plataforma de capacitación interna en WordPress. Contiene cursos sobre pre-admisiones, Bitrix y más, con certificados automáticos al aprobar.'
      },
      {
        t: 'Administradores de Bitrix',
        q: '¿Quiénes tienen permisos de administrador en Bitrix?',
        o: ['Todos los empleados', 'Los asesores comerciales', 'Solo Sistemas y Gerencia', 'Solo Desarrollo'],
        c: 2,
        e: 'Aunque Bitrix es para el Área Comercial, los permisos de administrador (incluyendo descarga de información) están restringidos al Área de Sistemas y Gerencia.'
      },
      {
        t: 'Canal oficial',
        q: '¿Cuál es el canal OFICIAL para solicitudes formales?',
        o: ['WhatsApp', 'Llamada telefónica', 'Correo electrónico', 'Mensaje de texto'],
        c: 2,
        e: 'El correo electrónico es el canal oficial. Si bien WhatsApp es el más usado día a día, las solicitudes importantes deben ir por correo para quedar documentadas.'
      },
      {
        t: 'Entrega de equipos',
        q: '¿Qué documento se requiere al entregar un equipo tecnológico?',
        o: ['Correo de confirmación', 'Acta de entrega firmada', 'Solicitud verbal', 'Formulario en línea'],
        c: 1,
        e: 'Todo equipo asignado debe ir acompañado de un acta de entrega firmada. Este documento formaliza la responsabilidad sobre el equipo.'
      },
      {
        t: 'Códigos QR',
        q: '¿Para qué sirven los códigos QR en la Página Web?',
        o: ['Descargar resultados de lab', 'Agendamiento por especialidad', 'Acceder al correo del médico', 'Ver historial clínico'],
        c: 1,
        e: 'Los perfiles de médicos en la web están vinculados con MEDESP. Cada especialidad tiene un QR que redirige al sistema de agendamiento correspondiente.'
      },
      {
        t: 'Horario de soporte',
        q: '¿El Área de Sistemas brinda soporte fuera del horario laboral?',
        o: ['Sí, hay soporte 24/7', 'Solo en emergencias', 'No, solo en horario laboral', 'Solo fines de semana'],
        c: 2,
        e: 'El Área de Sistemas no brinda soporte fuera del horario laboral. Es uno de los lineamientos que todos los colaboradores deben conocer y respetar.'
      },
    ];

    this.cards = raw.map((r, i) => ({
      id: i + 1,
      shortTitle: r.t,
      question: r.q,
      options: r.o,
      correctIndex: r.c,
      explanation: r.e,
      selectedIndex: null,
      flipped: false
    }));
  }

  selectOption(card: QuizCard, optIndex: number): void {
    if (card.flipped) return;
    card.selectedIndex = optIndex;
    // Small delay so user sees their selection before flip
    setTimeout(() => { card.flipped = true; }, 350);
  }

  isCorrect(card: QuizCard): boolean {
    return card.selectedIndex === card.correctIndex;
  }

  flipBack(card: QuizCard): void {
    card.flipped = false;
  }

  get answeredCount(): number { return this.cards.filter(c => c.flipped).length; }
  get correctCount(): number { return this.cards.filter(c => c.flipped && this.isCorrect(c)).length; }

  letter(i: number): string { return ['A', 'B', 'C', 'D'][i]; }

  goBack(): void { this.router.navigate(['/induccion']); }

  resetAll(): void {
    this.cards.forEach(c => { c.selectedIndex = null; c.flipped = false; });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // SVG paths for card icons (one per card)
  getIconPath(id: number): string {
    const icons: Record<number, string> = {
      1: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', // doc
      2: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', // lock
      3: 'M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z', // support
      4: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', // mail
      5: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', // shield
      6: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z', // phone
      7: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', // book
      8: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', // people
      9: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z', // chat
      10: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', // clipboard
      11: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a2 2 0 002-2V4', // qr
      12: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', // clock
    };
    return icons[id] || icons[1];
  }
}