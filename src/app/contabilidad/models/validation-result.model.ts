export interface ValidationResult {
  isValid: boolean;
  status: 'approved' | 'rejected' | 'review';
  errors: ValidationError[];
  warnings: ValidationError[];
  aiAnalysis: string;
  confidence: number;
  processingTime: number;
  validaciones?: ValidacionesEcuador;
  validacionesNegocio?: ValidacionesNegocio;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidacionesEcuador {
  rucValido: boolean;
  claveAccesoValida: boolean;
  numeroAutorizacionValido: boolean;
  calculosCorrectos: boolean;
  fechaValida: boolean;
  ambienteValido: boolean;
  sumatoriasCorrectas: boolean;
  detalles: {
    ruc?: string;
    claveAcceso?: string;
    numeroAutorizacion?: string;
    totales?: string;
    fecha?: string;
  };
}

export interface ValidacionesNegocio {
  clienteCorrecto: boolean;
  rucClienteValido: boolean;
  direccionCorrecta: boolean;
  correosCorrectos: boolean;
  telefonoValido: boolean;
  conceptoCompleto: boolean;
  tieneEspecialidad: boolean;
  tieneMesAnio: boolean;
  tieneAnexoPacientes: boolean;
  tieneNumeroOrden: boolean;
  tieneNombreProyecto: boolean;
  detalles: {
    clienteEsperado?: string;
    clienteEncontrado?: string;
    rucEsperado?: string;
    rucEncontrado?: string;
    correosEsperados?: string[];
    correosEncontrados?: string[];
    faltaEnConcepto?: string[];
  };
}

export enum TipoServicio {
  FIJO = 'fijo',
  EVENTUAL = 'eventual',
  INSUMO = 'insumo',
  OTRO = 'otro'
}

export interface ClienteEsperado {
  razonSocial: string;
  ruc: string;
  direccion: string;
  correos: string[];
  telefono: string;
  numeroOrden?: string;
}

export const CLIENTES_VALIDOS: { [key: string]: ClienteEsperado } = {
  'MYSGROUP': {
    razonSocial: 'MYSGROUP S.A.',
    ruc: '1793005152001',
    direccion: 'SHYRIS N43-69 Y TOMAS DE BERLANGA',
    correos: [
      'rrhhsegurilab@segurilab.ec',
      'tesoreria@segurilab.ec',
      'contabilidad@segurilab.ec'
    ],
    telefono: '023947160'
  },
  'LITORAL': {
    razonSocial: 'LITORAL MEDICAL CENTER LITMEDCEN S.A.S.',
    ruc: '0993374257001',
    direccion: 'JORGE PEREZ CONCHA 218-302 Y TODOS LOS SANTOS',
    correos: [
      'rrhhsegurilab@segurilab.ec',
      'hcardenas@segurilab.ec',
      'tesoreria@segurilab.ec',
      'contabilidad@segurilab.ec'
    ],
    telefono: '095 869 3769'
  }
};