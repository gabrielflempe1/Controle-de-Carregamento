export interface Movimentacao {
  id: string;
  etapaAnterior: string;
  etapaNova: string;
  solicitante: string;
  responsaveis: string;
  dataHora: string;
  turno: string;
}

export interface Ticket {
  id: string;
  ticketNumber: string; // Ticket/Protocolo
  ofNumber: string;     // Ordem de Frete
  remessa?: string;
  ordemVenda?: string;
  cidade?: string;
  statusOF?: string;
  tipoVeiculo?: string;
  placaVeiculo?: string;
  transportadora?: string;
  pedidoCompras?: string;
  capacidadeMaxima?: string;
  utilizacao?: string;
  dataCriacao?: string;
  etapa: "contratacao" | "separar" | "separada" | "carregar" | "carregada" | "pos_carregamento" | "aguardando_nf" | "concluido";
  pesoRemessa?: number;
  unidadeMedida?: string;
  incoterms?: string;
  cliente?: string;
  refCliente?: string;
  faturaFrete?: string;
  tipoDocumento?: string;
  criadoPor?: string;
  contrato?: string;
  createdAt: string;
  historico?: Movimentacao[];
}

export const ETAPAS = [
  { id: "contratacao", label: "Contratação" },
  { id: "separar", label: "A Separar" },
  { id: "separada", label: "Separada" },
  { id: "carregar", label: "A Carregar" },
  { id: "carregada", label: "Carregada" },
  { id: "pos_carregamento", label: "Pós Carregamento" },
  { id: "aguardando_nf", label: "Aguardando NF" },
  { id: "concluido", label: "Concluído" },
] as const;
