import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

interface QuizOption {
  text: string;
  isCorrect: boolean;
}

interface QuizQuestion {
  id: number;
  question: string;
  options: QuizOption[];
  selectedIndex: number | null;
  answered: boolean;
}

@Component({
  selector: 'app-induccion-quiz',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quiz.component.html',
  styleUrls: ['./quiz.component.css']
})
export class InduccionQuizComponent implements OnInit {

  questions: QuizQuestion[] = [];
  currentPage = 0;
  questionsPerPage = 5;
  quizSubmitted = false;
  score = 0;
  totalQuestions = 0;
  showResults = false;
  animateIn = false;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loadQuestions();
    this.totalQuestions = this.questions.length;
    setTimeout(() => this.animateIn = true, 100);
  }

  loadQuestions(): void {
    const raw = [
      { question: '¿Cuáles son las dos secciones en las que se divide el Área de Sistemas?', options: ['Área de Redes y Área de Electrónica', 'Área de Sistemas/Soporte y Área de Desarrollo', 'Área de Hardware y Área de Software', 'Área de Seguridad y Área de Soporte'], correct: 1 },
      { question: '¿Qué es MEDESP?', options: ['Un software externo para gestión de resultados de laboratorio', 'El CRM de la empresa para el área comercial', 'Un software propio para gestión de historias clínicas, agendamientos y administración de pacientes', 'Una plataforma de correos electrónicos'], correct: 2 },
      { question: '¿Qué información se necesita para crear un usuario nuevo en MEDESP?', options: ['Solo nombre y correo electrónico', 'Nombre, apellidos, cédula, fecha de nacimiento, estado civil, tipo de sangre, email, teléfono, área, especialidad, sucursal y dirección', 'Solo nombre, cédula y área', 'Nombre, apellidos y número de teléfono'], correct: 1 },
      { question: '¿Quién es el responsable de crear usuarios y gestionar permisos dentro de LABINT?', options: ['El Área de Sistemas', 'El Área de Desarrollo', 'Jairo Troya (Asistente de Gerencia)', 'Cada empleado crea su propio usuario'], correct: 2 },
      { question: '¿Qué debe hacer un empleado ANTES de contactar al Área de Sistemas por un problema técnico?', options: ['Enviar un correo a gerencia', 'Intentar resolverlo por su cuenta, buscar en materiales de capacitación y consultar con compañeros', 'Apagar el equipo y esperar al día siguiente', 'Contactar directamente al proveedor externo'], correct: 1 },
      { question: '¿Qué herramienta se utiliza para la gestión del firewall, antivirus y VPN de la empresa?', options: ['Zimbra', 'Navicat', 'Sophos', 'Bitrix'], correct: 2 },
      { question: '¿Cuál es el formato del correo electrónico empresarial en Segurilab?', options: ['nombre.apellido@gmail.com', '[inicial del primer nombre].[apellido]@segurilab.s', 'apellido.nombre@segurilab.com', 'nombre@segurilab.ec'], correct: 1 },
      { question: '¿Qué se necesita para instalar LABINT en un equipo personal de un empleado?', options: ['Solo la solicitud del empleado', 'La autorización del jefe inmediato', 'Autorización expresa de la Gerencia General (Dra. Sofía Alarcón)', 'No se puede instalar en equipos personales'], correct: 2 },
      { question: '¿Qué es SeguriLearn?', options: ['El servidor de correos electrónicos de la empresa', 'Una plataforma de capacitaciones donde se cargan cursos, evaluaciones y se emiten certificados', 'El sistema de agendamiento de pacientes', 'La plataforma de inventario del data center'], correct: 1 },
      { question: '¿Qué documento se requiere al entregar un equipo tecnológico a un empleado?', options: ['Solo un correo electrónico de confirmación', 'Un acta de entrega firmada por el responsable del Área de Sistemas y el empleado que recibe', 'Una solicitud verbal es suficiente', 'Un formulario en línea'], correct: 1 },
      { question: '¿Quiénes tienen permisos de administrador en Bitrix para descargar información?', options: ['Todos los empleados', 'Solo los asesores comerciales', 'Solo el Área de Sistemas y Gerencia', 'Solo el Área de Desarrollo'], correct: 2 },
      { question: '¿Qué sucursales maneja Segurilab?', options: ['Solo la sucursal Chiris', 'Chiris, Calderón, Praderas, Hospital del Sur y Michelena', 'Chiris y Calderón únicamente', 'Chiris, Quito Norte y Quito Sur'], correct: 1 },
      { question: '¿Para qué se utiliza AnyDesk en el Área de Sistemas?', options: ['Para crear usuarios en MEDESP', 'Para soporte remoto a sucursales externas a Chiris', 'Para gestionar el firewall', 'Para enviar correos electrónicos'], correct: 1 },
      { question: '¿Qué requisito adicional se solicita a un médico ocupacional al crear su perfil en MEDESP?', options: ['Una copia de su título profesional', 'Su firma digital (archivo P12)', 'Una carta de recomendación', 'Su número de colegiado'], correct: 1 },
      { question: '¿Cuál de las siguientes afirmaciones es CORRECTA sobre el Área de Sistemas?', options: ['El Área debe resolver cualquier duda tecnológica sin importar su complejidad', 'El Área brinda soporte 24/7 a todas las sucursales', 'Los empleados deben autocapacitarse y solo escalar problemas de nivel intermedio o superior', 'El Área es responsable de crear usuarios en todas las plataformas, incluyendo LABINT'], correct: 2 },
      { question: '¿Cuántos servidores maneja actualmente la infraestructura de Segurilab?', options: ['Uno principal', 'Dos: un servidor principal y uno secundario', 'Tres servidores', 'Cuatro servidores distribuidos'], correct: 1 },
      { question: '¿Qué plataforma se utiliza para la virtualización de los servidores?', options: ['VMware', 'Docker', 'Proxmox', 'Azure'], correct: 2 },
      { question: 'Si tienes un problema con tu contraseña de LABINT, ¿a quién debes contactar?', options: ['Al Área de Sistemas', 'A Jairo Troya (Asistente de Gerencia)', 'Al Ingeniero Paredes', 'A Recursos Humanos'], correct: 1 },
      { question: '¿Cuál es el propósito de los códigos QR en los perfiles de médicos en la página web?', options: ['Descargar resultados de laboratorio', 'Redirigir al agendamiento según la especialidad del médico', 'Acceder al correo electrónico del médico', 'Ver el historial clínico del paciente'], correct: 1 },
      { question: '¿Cuál es el canal OFICIAL para solicitudes formales al Área de Sistemas?', options: ['WhatsApp', 'Llamada telefónica', 'Correo electrónico', 'Mensaje de texto'], correct: 2 }
    ];

    this.questions = raw.map((q, i) => ({
      id: i + 1,
      question: q.question,
      options: q.options.map((opt, oi) => ({ text: opt, isCorrect: oi === q.correct })),
      selectedIndex: null,
      answered: false
    }));
  }

  get totalPages(): number { return Math.ceil(this.questions.length / this.questionsPerPage); }

  get currentQuestions(): QuizQuestion[] {
    const start = this.currentPage * this.questionsPerPage;
    return this.questions.slice(start, start + this.questionsPerPage);
  }

  get answeredCount(): number { return this.questions.filter(q => q.answered).length; }
  get progressPercent(): number { return (this.answeredCount / this.totalQuestions) * 100; }
  get allAnswered(): boolean { return this.answeredCount === this.totalQuestions; }

  selectOption(question: QuizQuestion, optionIndex: number): void {
    if (this.quizSubmitted) return;
    question.selectedIndex = optionIndex;
    question.answered = true;
  }

  nextPage(): void { if (this.currentPage < this.totalPages - 1) { this.currentPage++; this.scrollToTop(); } }
  prevPage(): void { if (this.currentPage > 0) { this.currentPage--; this.scrollToTop(); } }

  submitQuiz(): void {
    this.score = this.questions.filter(q => q.selectedIndex !== null && q.options[q.selectedIndex!].isCorrect).length;
    this.quizSubmitted = true;
    this.showResults = true;
    this.scrollToTop();
  }

  resetQuiz(): void {
    this.questions.forEach(q => { q.selectedIndex = null; q.answered = false; });
    this.quizSubmitted = false;
    this.showResults = false;
    this.score = 0;
    this.currentPage = 0;
    this.scrollToTop();
  }

  goBack(): void { this.router.navigate(['/induccion']); }

  getScoreClass(): string {
    const pct = (this.score / this.totalQuestions) * 100;
    if (pct >= 80) return 'excellent';
    if (pct >= 60) return 'good';
    return 'needs-improvement';
  }

  getScoreMessage(): string {
    const pct = (this.score / this.totalQuestions) * 100;
    if (pct >= 80) return '¡Excelente! Tienes un gran dominio del contenido.';
    if (pct >= 60) return '¡Buen trabajo! Pero revisa algunos temas para mejorar.';
    return 'Necesitas repasar el material de inducción. ¡Inténtalo de nuevo!';
  }

  getOptionLetter(index: number): string { return ['A', 'B', 'C', 'D'][index]; }

  getStrokeDashoffset(): number { return 339.292 - (339.292 * this.score / this.totalQuestions); }

  private scrollToTop(): void { window.scrollTo({ top: 0, behavior: 'smooth' }); }

  get pageArray(): number[] { return Array.from({ length: this.totalPages }, (_, i) => i); }
}