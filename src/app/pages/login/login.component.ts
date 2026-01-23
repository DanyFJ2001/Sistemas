// src/app/pages/login/login.component.ts
import { Component, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

// Interfaces para el efecto de partículas
interface GridSpot {
  x: number;
  y: number;
  busyAge: number;
  spotIndex: number;
  isEdge: string | boolean;
  field: number;
}

interface Particle {
  hue: number;
  sat: number;
  lum: number;
  x: number;
  y: number;
  xLast: number;
  yLast: number;
  xSpeed: number;
  ySpeed: number;
  age: number;
  ageSinceStuck: number;
  attractor: {
    oldIndex: number;
    gridSpotIndex: number;
  };
  name: string;
  colorType: 'green' | 'blue' | 'white';
}

// Secuencia de tipeo
interface TypingStep {
  text: string;
  isError: boolean;
  pauseAfter: number;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements AfterViewInit, OnDestroy {
  @ViewChild('particleCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  // === Propiedades del formulario ===
  email = '';
  password = '';
  loading = false;
  errorMessage = '';
  showPassword = false;

  // === Propiedades de la animación de tipeo ===
  displayText = '';
  cursorVisible = true;
  isTypingComplete = false;
  showEnterEffect = false;
  typingState: 'typing' | 'deleting' | 'pausing' | 'complete' = 'typing';
  currentStepIndex = 0;

  private typingSequence: TypingStep[] = [
    { text: 'SEGURIDAD', isError: true, pauseAfter: 800 },
    { text: 'LABORATORIO', isError: true, pauseAfter: 600 },
    { text: '$isd@dmin', isError: true, pauseAfter: 500 },
    { text: 'SEGURILAB', isError: false, pauseAfter: 300 },
  ];
  
  private currentCharIndex = 0;
  private typingSpeed = 150;
  private deletingSpeed = 50;
  private typingTimeout: any;
  private cursorInterval: any;

  // === Propiedades del efecto de partículas ===
  private ctx!: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private xC = 0;
  private yC = 0;
  private stepCount = 0;
  private particles: Particle[] = [];
  private grid: GridSpot[] = [];
  private gridMaxIndex = 0;
  private animationId = 0;
  private isDestroyed = false;

  // Configuración de partículas
  private readonly lifespan = 1000;
  private readonly maxPop = 300;
  private readonly birthFreq = 2;
  private readonly gridSize = 8;

  // Colores: verde lima #d3ff49, azul #3d58b8, blanco
  private readonly colors = {
    green: { hue: 72, sat: 100, lumBase: 55 },
    blue: { hue: 225, sat: 50, lumBase: 48 },
    white: { hue: 72, sat: 20, lumBase: 85 }
  };

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }

  ngAfterViewInit(): void {
    this.setupParticleEffect();
    this.startTypingAnimation();
    this.startCursorBlink();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    if (this.cursorInterval) {
      clearInterval(this.cursorInterval);
    }
    window.removeEventListener('resize', this.handleResize);
  }

  // === ANIMACIÓN DE TIPEO ===
  private startCursorBlink(): void {
    this.cursorInterval = setInterval(() => {
      if (!this.isTypingComplete) {
        this.cursorVisible = !this.cursorVisible;
      }
    }, 530);
  }

  private startTypingAnimation(): void {
    this.typeNextStep();
  }

  private typeNextStep(): void {
    if (this.currentStepIndex >= this.typingSequence.length) {
      this.triggerEnterEffect();
      return;
    }

    const currentStep = this.typingSequence[this.currentStepIndex];
    this.typingState = 'typing';
    this.typeCharacter(currentStep);
  }

  private typeCharacter(step: TypingStep): void {
    if (this.currentCharIndex < step.text.length) {
      this.displayText = step.text.substring(0, this.currentCharIndex + 1);
      this.currentCharIndex++;
      
      const variance = Math.random() * 60 - 30;
      this.typingTimeout = setTimeout(() => {
        this.typeCharacter(step);
      }, this.typingSpeed + variance);
    } else {
      this.typingState = 'pausing';
      this.typingTimeout = setTimeout(() => {
        if (step.isError) {
          this.deleteText();
        } else {
          this.currentStepIndex++;
          this.typeNextStep();
        }
      }, step.pauseAfter);
    }
  }

  private deleteText(): void {
    this.typingState = 'deleting';
    
    if (this.displayText.length > 0) {
      this.displayText = this.displayText.substring(0, this.displayText.length - 1);
      
      const variance = Math.random() * 20 - 10;
      this.typingTimeout = setTimeout(() => {
        this.deleteText();
      }, this.deletingSpeed + variance);
    } else {
      this.currentCharIndex = 0;
      this.currentStepIndex++;
      
      this.typingTimeout = setTimeout(() => {
        this.typeNextStep();
      }, 200);
    }
  }

  private triggerEnterEffect(): void {
    this.showEnterEffect = true;
    this.cursorVisible = false;
    
    setTimeout(() => {
      this.isTypingComplete = true;
      this.typingState = 'complete';
    }, 150);
  }

  // === MÉTODOS DEL FORMULARIO ===
  async onLogin(): Promise<void> {
    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor completa todos los campos';
      return;
    }

    if (!this.isValidEmail(this.email)) {
      this.errorMessage = 'Por favor ingresa un correo válido';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      await this.authService.login(this.email, this.password);
      console.log('✅ Login exitoso');
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      console.error('❌ Error en login:', error);
      this.errorMessage = error.message || 'Error al iniciar sesión';
      this.loading = false;
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  onInputChange(): void {
    if (this.errorMessage) {
      this.errorMessage = '';
    }
  }

  // === MÉTODOS DEL EFECTO DE PARTÍCULAS (ORIGINAL) ===
  private handleResize = (): void => {
    this.resizeCanvas();
  };

  private setupParticleEffect(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.ctx = ctx;
    this.resizeCanvas();
    this.buildGrid();
    this.initDraw();
    this.startAnimation();

    window.addEventListener('resize', this.handleResize);
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    this.width = canvas.width;
    this.height = canvas.height;
    this.xC = this.width / 2;
    this.yC = this.height / 2;
    if (this.ctx) this.ctx.imageSmoothingEnabled = false;
  }

  private buildGrid(): void {
    const gridSteps = Math.floor(1000 / this.gridSize);
    let i = 0;

    for (let xx = -500; xx < 500; xx += this.gridSize) {
      for (let yy = -500; yy < 500; yy += this.gridSize) {
        const r = Math.sqrt(xx * xx + yy * yy);
        const field = Math.min(255, r * 0.6);

        this.grid.push({
          x: xx,
          y: yy,
          busyAge: 0,
          spotIndex: i,
          isEdge:
            xx === -500 ? 'left' :
            xx === -500 + this.gridSize * (gridSteps - 1) ? 'right' :
            yy === -500 ? 'top' :
            yy === -500 + this.gridSize * (gridSteps - 1) ? 'bottom' : false,
          field
        });
        i++;
      }
    }
    this.gridMaxIndex = i;
  }

  private initDraw(): void {
    this.ctx.beginPath();
    this.ctx.rect(0, 0, this.width, this.height);
    this.ctx.fillStyle = '#000000';
    this.ctx.fill();
    this.ctx.closePath();
  }

  private startAnimation(): void {
    const frame = () => {
      if (this.isDestroyed) return;
      this.evolve();
      this.animationId = requestAnimationFrame(frame);
    };
    frame();
  }

  private evolve(): void {
    this.stepCount++;
    this.grid.forEach(e => { if (e.busyAge > 0) e.busyAge++; });

    if (this.stepCount % this.birthFreq === 0 && this.particles.length < this.maxPop) {
      this.birth();
    }

    this.move();
    this.draw();
  }

  private birth(): void {
    const range = 200;
    const x = (Math.random() - 0.5) * range;
    const y = (Math.random() - 0.5) * range;
    
    let closestIndex = 0;
    let closestDist = Infinity;
    for (let i = 0; i < this.grid.length; i++) {
      const dx = this.grid[i].x - x;
      const dy = this.grid[i].y - y;
      const dist = dx * dx + dy * dy;
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = i;
      }
    }

    const rand = Math.random();
    const colorType: 'green' | 'blue' | 'white' =
      rand < 0.45 ? 'green' : rand < 0.9 ? 'blue' : 'white';

    const colorConfig = this.colors[colorType];

    this.particles.push({
      hue: colorConfig.hue,
      sat: colorConfig.sat,
      lum: colorConfig.lumBase + Math.floor(20 * Math.random()),
      x: x,
      y: y,
      xLast: x,
      yLast: y,
      xSpeed: 0,
      ySpeed: 0,
      age: 0,
      ageSinceStuck: 0,
      attractor: { oldIndex: closestIndex, gridSpotIndex: closestIndex },
      name: 'p-' + Math.random().toString(36).substr(2, 9),
      colorType
    });
  }

  private kill(name: string): void {
    this.particles = this.particles.filter(p => p.name !== name);
  }

  private move(): void {
    const gridSteps = Math.floor(1000 / this.gridSize);

    for (const p of this.particles) {
      p.xLast = p.x;
      p.yLast = p.y;

      let index = p.attractor.gridSpotIndex;
      let gridSpot = this.grid[index];

      if (Math.random() < 0.5 && !gridSpot.isEdge) {
        const neighbors = [
          this.grid[index - 1],
          this.grid[index + 1],
          this.grid[index - gridSteps],
          this.grid[index + gridSteps]
        ].filter(n => n);

        let maxSpot = neighbors[0];
        let maxVal = -Infinity;
        const chaos = 30;
        
        for (const n of neighbors) {
          const val = n.field + chaos * Math.random();
          if (val > maxVal) { maxVal = val; maxSpot = n; }
        }

        if (maxSpot && (maxSpot.busyAge === 0 || maxSpot.busyAge > 15)) {
          p.ageSinceStuck = 0;
          p.attractor.oldIndex = index;
          p.attractor.gridSpotIndex = maxSpot.spotIndex;
          gridSpot = maxSpot;
          gridSpot.busyAge = 1;
        } else {
          p.ageSinceStuck++;
        }
      } else if (gridSpot.isEdge) {
        p.ageSinceStuck++;
      }

      if (p.ageSinceStuck === 10) { this.kill(p.name); continue; }

      const k = 8, visc = 0.4;
      const dx = p.x - gridSpot.x, dy = p.y - gridSpot.y;
      p.xSpeed = (p.xSpeed - k * dx) * visc;
      p.ySpeed = (p.ySpeed - k * dy) * visc;
      p.x += 0.1 * p.xSpeed;
      p.y += 0.1 * p.ySpeed;

      if (++p.age > this.lifespan) this.kill(p.name);
    }
  }

  private draw(): void {
    if (!this.particles.length) return;

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    this.ctx.fillRect(0, 0, this.width, this.height);

    for (const p of this.particles) {
      const hueShift = Math.sin(this.stepCount / 40) * 5;
      const h = p.hue + hueShift;
      const color = `hsla(${h}, ${p.sat}%, ${p.lum}%, 1)`;

      const last = this.toCanvas(p.xLast, p.yLast);
      const now = this.toCanvas(p.x, p.y);
      const attrac = this.toCanvas(this.grid[p.attractor.gridSpotIndex].x, this.grid[p.attractor.gridSpotIndex].y);
      const oldAttrac = this.toCanvas(this.grid[p.attractor.oldIndex].x, this.grid[p.attractor.oldIndex].y);

      this.ctx.strokeStyle = color;
      this.ctx.fillStyle = color;
      this.ctx.lineWidth = 1.5;

      this.ctx.beginPath();
      this.ctx.moveTo(last.x, last.y);
      this.ctx.lineTo(now.x, now.y);
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(oldAttrac.x, oldAttrac.y);
      this.ctx.lineTo(attrac.x, attrac.y);
      this.ctx.arc(attrac.x, attrac.y, 1.5, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.fill();
    }
  }

  private toCanvas(x: number, y: number): { x: number; y: number } {
    const zoom = 1.6;
    return { x: this.xC + x * zoom, y: this.yC + y * zoom };
  }
}