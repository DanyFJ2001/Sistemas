import { ValidationResult } from "./validation-result.model";

export interface Invoice {
  id: number;
  fileName: string;
  supplier: string;
  ruc: string;
  amount: number;
  subtotal: number;
  iva: number;
  status: InvoiceStatus;
  statusText: string;
  date: string;
  uploadDate: string;
  validationResult?: ValidationResult;
  xmlData?: InvoiceXMLData;
}

export enum InvoiceStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REVIEW = 'review'
}

export interface InvoiceXMLData {
  rucEmisor: string;
  razonSocialEmisor: string;
  nombreComercialEmisor: string;
  direccionMatriz: string;
  obligadoContabilidad: string;
  contribuyenteEspecial?: string;
  
  rucComprador: string;
  razonSocialComprador: string;
  direccionComprador: string;
  emailComprador?: string;
  telefonoComprador?: string;
  
  numeroAutorizacion: string;
  claveAcceso: string;
  numeroFactura: string;
  fechaEmision: string;
  fechaAutorizacion: string;
  ambiente: string;
  tipoEmision: string;
  
  subtotal0: number;
  subtotal5: number;
  subtotal12: number;
  subtotal15: number;
  subtotalNoObjetoIVA: number;
  subtotalSinImpuesto: number;
  descuento: number;
  ice: number;
  iva5: number;
  iva12: number;
  iva15: number;
  propina: number;
  gastosTransporte: number;
  valorTotal: number;
  
  conceptos: ConceptoFactura[];
  formaPago: FormaPago[];
  informacionAdicional?: { [key: string]: string };
}

export interface ConceptoFactura {
  codigoPrincipal: string;
  codigoAuxiliar?: string;
  cantidad: number;
  descripcion: string;
  precioUnitario: number;
  descuento: number;
  precioTotal: number;
}

export interface FormaPago {
  formaPago: string;
  valor: number;
  plazo: number;
  unidadTiempo: string;
}