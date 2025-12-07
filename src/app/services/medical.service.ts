import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface CertificadoMedico {
  fileName: string;
  cedula: string;
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  fechaNacimiento: string;
  edad: string;
  genero: string;
  aptitudMedica: string;
  diagnostico1: string;
  cie10_diagnostico1: string;
  observaciones1: string;
  diagnostico2: string;
  cie10_diagnostico2: string;
  observaciones2: string;
  hallazgoMetabolico: string;
  hallazgoOsteomuscular: string;
  otrosAntecedentes: string;
}

export interface CedulaResponse {
  nombres: string;
  apellidos: string;
  fechaNacimiento?: string;
  genero?: string;
}

export interface ProcessResponse {
  success: boolean;
  procesados: number;
  errores: number;
  data: CertificadoMedico[];
}

export interface ProcessingStatus {
  fileName: string;
  status: 'queued' | 'converting' | 'analyzing' | 'completed' | 'error';
  progress: number;
  preview?: string;
  message?: string;
  result?: CertificadoMedico;
}

@Injectable({
  providedIn: 'root'
})
export class MedicalProcessorService {
  private apiUrl = 'http://localhost:3001/api/process-clinical-history';

  private processingStatusSubject = new BehaviorSubject<ProcessingStatus[]>([]);
  public processingStatus$ = this.processingStatusSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Extraer cédula del nombre de archivo
   */
  private extractCedulaFromFilename(filename: string): string | null {
    const match = filename.match(/(\d{10})/);
    return match ? match[1] : null;
  }

  /**
   * Consultar datos de cédula ecuatoriana
   */
  private async consultarCedula(cedula: string): Promise<CedulaResponse | null> {
    const proxyUrl = 'https://infoplacas.herokuapp.com/';
    const targetUrl = 'https://si.secap.gob.ec/sisecap/logeo_web/json/busca_persona_registro_civil.php';

    try {
      const response = await fetch(proxyUrl + targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          documento: cedula,
          tipo: '1'
        })
      });

      if (!response.ok) return null;

      const textResponse = await response.text();
      if (!textResponse) return null;

      return JSON.parse(textResponse);
    } catch (error) {
      console.error('Error consultando cédula:', error);
      return null;
    }
  }

  /**
   * Calcular edad aproximada desde cédula ecuatoriana
   */
  private calcularEdadDesdeCedula(cedula: string): string {
    try {
      const dia = parseInt(cedula.substring(0, 2));
      const mes = parseInt(cedula.substring(2, 4));
      const anioCorto = parseInt(cedula.substring(4, 6));
      
      const anio = anioCorto > 23 ? 1900 + anioCorto : 2000 + anioCorto;
      const fechaNac = new Date(anio, mes - 1, dia);
      const hoy = new Date();
      
      let edad = hoy.getFullYear() - fechaNac.getFullYear();
      const mesActual = hoy.getMonth();
      const mesNac = fechaNac.getMonth();
      
      if (mesActual < mesNac || (mesActual === mesNac && hoy.getDate() < fechaNac.getDate())) {
        edad--;
      }
      
      return edad >= 0 && edad <= 120 ? edad.toString() : 'N/A';
    } catch {
      return 'N/A';
    }
  }

  /**
   * Determinar género desde cédula ecuatoriana
   */
  private determinarGenero(cedula: string): string {
    try {
      const ultimoDigito = parseInt(cedula.charAt(9));
      return ultimoDigito % 2 === 0 ? 'Masculino' : 'Femenino';
    } catch {
      return 'N/A';
    }
  }

  processCertificados(files: File[]): Observable<ProcessResponse> {
    const formData = new FormData();
    
    const initialStatuses: ProcessingStatus[] = files.map(file => ({
      fileName: file.name,
      status: 'queued',
      progress: 0,
      message: 'En cola...'
    }));
    this.processingStatusSubject.next(initialStatuses);

    files.forEach(file => formData.append('files', file));
    this.simulateProgress(files);

    return this.http.post<ProcessResponse>(this.apiUrl, formData).pipe(
      tap(async (response) => {
        // Enriquecer datos con información de cédula
        const enrichedData = await Promise.all(
          response.data.map(async (result) => {
            const cedula = this.extractCedulaFromFilename(result.fileName);
            
            if (cedula) {
              const cedulaData = await this.consultarCedula(cedula);
              const edad = this.calcularEdadDesdeCedula(cedula);
              const genero = this.determinarGenero(cedula);
              
              return {
                ...result,
                cedula,
                nombreCompleto: cedulaData 
                  ? `${cedulaData.nombres} ${cedulaData.apellidos}` 
                  : `${result.nombre} ${result.apellido}`,
                nombre: cedulaData?.nombres || result.nombre,
                apellido: cedulaData?.apellidos || result.apellido,
                edad,
                genero
              };
            }
            
            return {
              ...result,
              nombreCompleto: `${result.nombre} ${result.apellido}`,
              edad: 'N/A',
              genero: 'N/A'
            };
          })
        );
        
        response.data = enrichedData;
        
        const finalStatuses = enrichedData.map((result) => ({
          fileName: result.fileName,
          status: 'completed' as const,
          progress: 100,
          message: 'Completado',
          result: result
        }));
        this.processingStatusSubject.next(finalStatuses);
      })
    );
  }

  private simulateProgress(files: File[]): void {
    const statuses = this.processingStatusSubject.value;

    setTimeout(() => {
      const updated = statuses.map(s => ({
        ...s,
        status: 'converting' as const,
        progress: 20,
        message: 'Convirtiendo PDF a imágenes...'
      }));
      this.processingStatusSubject.next(updated);
    }, 500);

    setTimeout(() => {
      const updated = statuses.map(s => ({
        ...s,
        progress: 40,
        message: 'Imágenes generadas'
      }));
      this.processingStatusSubject.next(updated);
    }, 1500);

    setTimeout(() => {
      const updated = statuses.map(s => ({
        ...s,
        status: 'analyzing' as const,
        progress: 60,
        message: 'IA analizando contenido...'
      }));
      this.processingStatusSubject.next(updated);
    }, 2500);

    setTimeout(() => {
      const updated = statuses.map(s => ({
        ...s,
        progress: 80,
        message: 'Extrayendo datos médicos...'
      }));
      this.processingStatusSubject.next(updated);
    }, 4000);
  }

  clearProcessingStatus(): void {
    this.processingStatusSubject.next([]);
  }

  exportToExcel(data: CertificadoMedico[]): void {
    // Crear contenido HTML de tabla para Excel
    let htmlTable = `
      <html xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="UTF-8">
        <style>
          table { 
            border-collapse: collapse; 
            width: 100%; 
            font-family: Arial, sans-serif;
          }
          th { 
            background-color: #667eea; 
            color: white; 
            font-weight: bold; 
            padding: 12px 8px;
            text-align: left;
            border: 1px solid #ddd;
          }
          td { 
            padding: 10px 8px; 
            border: 1px solid #ddd;
            vertical-align: top;
          }
          tr:nth-child(even) { 
            background-color: #f9fafb; 
          }
          .header-row {
            background-color: #667eea !important;
          }
        </style>
      </head>
      <body>
        <table border="1">
          <thead>
            <tr class="header-row">
              <th>Archivo</th>
              <th>Cédula</th>
              <th>Nombre Completo</th>
              <th>Fecha Nacimiento</th>
              <th>Edad</th>
              <th>Género</th>
              <th>Aptitud Médica</th>
              <th>Diagnóstico 1</th>
              <th>CIE-10 Diag. 1</th>
              <th>Observaciones 1</th>
              <th>Diagnóstico 2</th>
              <th>CIE-10 Diag. 2</th>
              <th>Observaciones 2</th>
              <th>Hallazgo Metabólico</th>
              <th>Hallazgo Osteomuscular</th>
              <th>Otros Antecedentes</th>
            </tr>
          </thead>
          <tbody>
    `;

    // Agregar filas de datos
    data.forEach(item => {
      htmlTable += `
        <tr>
          <td>${item.fileName}</td>
          <td>${item.cedula}</td>
          <td>${item.nombreCompleto || item.nombre + ' ' + item.apellido}</td>
          <td>${item.fechaNacimiento || 'N/A'}</td>
          <td>${item.edad || 'N/A'}</td>
          <td>${item.genero || 'N/A'}</td>
          <td>${item.aptitudMedica}</td>
          <td>${item.diagnostico1}</td>
          <td>${item.cie10_diagnostico1}</td>
          <td>${item.observaciones1}</td>
          <td>${item.diagnostico2}</td>
          <td>${item.cie10_diagnostico2}</td>
          <td>${item.observaciones2}</td>
          <td>${item.hallazgoMetabolico}</td>
          <td>${item.hallazgoOsteomuscular}</td>
          <td>${item.otrosAntecedentes}</td>
        </tr>
      `;
    });

    htmlTable += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    // Crear blob y descargar
    const blob = new Blob([htmlTable], { 
      type: 'application/vnd.ms-excel;charset=utf-8;' 
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const fecha = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `Certificados_Medicos_${fecha}.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}