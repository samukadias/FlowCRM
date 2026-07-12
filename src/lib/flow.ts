import type {
  Stage,
  Area,
  AttestationStatus,
  HealthStatus,
  Perfil,
  MotivoPerda,
} from "@/generated/prisma/enums";

export type Tone = "progress" | "success" | "warn" | "danger" | "neutral";

/** Os seis marcos do caminho feliz, na ordem em que aparecem na régua. */
export const PATH_LABELS = [
  "Entrada",
  "Tratativa",
  "Verificação",
  "Pronta",
  "Enviada",
  "Aceita",
] as const;

export const STAGE_META: Record<
  Stage,
  {
    label: string;
    /** Com quem a bola está agora. */
    quem: string;
    /** Posição na régua de 6 marcos (0–5). */
    pos: number;
    tone: Tone;
    terminal?: boolean;
    /** Probabilidade padrão de fechamento nesta etapa (0–100), para o forecast ponderado. */
    probabilidade: number;
  }
> = {
  ENTRADA: { label: "Entrada", quem: "Comercial", pos: 0, tone: "progress", probabilidade: 10 },
  EM_TRATATIVA: {
    label: "Em tratativa",
    quem: "Propostas",
    pos: 1,
    tone: "progress",
    probabilidade: 25,
  },
  EM_VERIFICACAO: {
    label: "Em verificação",
    quem: "Delivery",
    pos: 2,
    tone: "progress",
    probabilidade: 40,
  },
  AJUSTES: { label: "Em ajustes", quem: "Propostas", pos: 1, tone: "warn", probabilidade: 25 },
  PROPOSTA_PRONTA: {
    label: "Proposta pronta",
    quem: "Comercial",
    pos: 3,
    tone: "progress",
    probabilidade: 60,
  },
  ENVIADA_CLIENTE: {
    label: "Enviada ao cliente",
    quem: "Cliente",
    pos: 4,
    tone: "progress",
    probabilidade: 75,
  },
  ACEITA: {
    label: "Aceita",
    quem: "Contratos",
    pos: 5,
    tone: "success",
    terminal: true,
    probabilidade: 100,
  },
  RECUSADA: {
    label: "Recusada",
    quem: "Comercial",
    pos: 4,
    tone: "danger",
    terminal: true,
    probabilidade: 0,
  },
  CANCELADA: {
    label: "Cancelada",
    quem: "Comercial",
    pos: 2,
    tone: "neutral",
    terminal: true,
    probabilidade: 0,
  },
};

/** Ordem das etapas nos filtros da busca. */
export const STAGE_ORDER: Stage[] = [
  "ENTRADA",
  "EM_TRATATIVA",
  "EM_VERIFICACAO",
  "AJUSTES",
  "PROPOSTA_PRONTA",
  "ENVIADA_CLIENTE",
  "ACEITA",
  "RECUSADA",
  "CANCELADA",
];

/** Etapas ainda em curso — fora do caminho encerrado (aceita/recusada/cancelada). */
export const ETAPAS_NAO_TERMINAIS: Stage[] = STAGE_ORDER.filter((s) => !STAGE_META[s].terminal);

export const AREA_LABELS: Record<Area, string> = {
  COMERCIAL: "Comercial",
  PROPOSTAS: "Propostas",
  DELIVERY: "Delivery",
  CONTRATOS: "Contratos",
  FATURAMENTO: "Faturamento",
  ADMIN: "Administração",
};

/**
 * Transições permitidas a partir de cada etapa e qual área executa cada uma.
 * Enquanto não há autenticação, o ator é o primeiro usuário da área executora.
 */
export const TRANSITIONS: Partial<
  Record<Stage, { para: Stage; rotulo: string; area: Area; destrutiva?: boolean }[]>
> = {
  ENTRADA: [
    { para: "EM_TRATATIVA", rotulo: "Iniciar tratativa", area: "PROPOSTAS" },
    { para: "CANCELADA", rotulo: "Cancelar", area: "COMERCIAL", destrutiva: true },
  ],
  EM_TRATATIVA: [
    { para: "EM_VERIFICACAO", rotulo: "Enviar para verificação", area: "PROPOSTAS" },
    { para: "CANCELADA", rotulo: "Cancelar", area: "COMERCIAL", destrutiva: true },
  ],
  EM_VERIFICACAO: [
    { para: "PROPOSTA_PRONTA", rotulo: "Aprovar proposta", area: "DELIVERY" },
    { para: "AJUSTES", rotulo: "Devolver para ajustes", area: "DELIVERY", destrutiva: true },
  ],
  AJUSTES: [
    { para: "EM_TRATATIVA", rotulo: "Retomar tratativa", area: "PROPOSTAS" },
    { para: "CANCELADA", rotulo: "Cancelar", area: "COMERCIAL", destrutiva: true },
  ],
  PROPOSTA_PRONTA: [
    { para: "ENVIADA_CLIENTE", rotulo: "Enviar ao cliente", area: "COMERCIAL" },
  ],
  ENVIADA_CLIENTE: [
    { para: "ACEITA", rotulo: "Registrar aceite", area: "COMERCIAL" },
    { para: "RECUSADA", rotulo: "Registrar recusa", area: "COMERCIAL", destrutiva: true },
  ],
};

/** Slug de URL → área, para as páginas de fila (/filas/[area]). */
export const AREA_SLUGS: Record<string, Area> = {
  comercial: "COMERCIAL",
  propostas: "PROPOSTAS",
  delivery: "DELIVERY",
  contratos: "CONTRATOS",
  faturamento: "FATURAMENTO",
};

/** Etapas que aguardam ação de cada área (filas de propostas). */
export const QUEUES: Partial<Record<Area, Stage[]>> = {
  PROPOSTAS: ["ENTRADA", "AJUSTES", "EM_TRATATIVA"],
  DELIVERY: ["EM_VERIFICACAO"],
  COMERCIAL: ["PROPOSTA_PRONTA", "ENVIADA_CLIENTE"],
};

/** Área dona da fila de cada etapa (quem deve ser avisado quando algo chega). */
export const FILA_DONA: Partial<Record<Stage, Area>> = {
  ENTRADA: "PROPOSTAS",
  EM_TRATATIVA: "PROPOSTAS",
  AJUSTES: "PROPOSTAS",
  EM_VERIFICACAO: "DELIVERY",
  PROPOSTA_PRONTA: "COMERCIAL",
  ENVIADA_CLIENTE: "COMERCIAL",
};

export const FILA_TITULOS: Partial<Record<Stage, string>> = {
  ENTRADA: "Aguardando início da tratativa",
  AJUSTES: "Devolvidas para ajustes",
  EM_TRATATIVA: "Em elaboração",
  EM_VERIFICACAO: "Aguardando verificação",
  PROPOSTA_PRONTA: "Prontas para enviar ao cliente",
  ENVIADA_CLIENTE: "Aguardando resposta do cliente",
};

export const HEALTH_META: Record<HealthStatus, { label: string; tone: Tone }> = {
  SAUDAVEL: { label: "Saudável", tone: "success" },
  ATENCAO: { label: "Atenção", tone: "warn" },
  CRITICO: { label: "Crítico", tone: "danger" },
};

export const ATESTACAO_META: Record<AttestationStatus, { label: string; tone: Tone }> = {
  PENDENTE: { label: "Aguardando cliente", tone: "warn" },
  CONFIRMADA_CLIENTE: { label: "Confirmada pelo cliente", tone: "progress" },
  ATESTADA: { label: "Atestada", tone: "success" },
  FATURADA: { label: "Faturada", tone: "success" },
  CONTESTADA: { label: "Contestada", tone: "danger" },
};

/** Ciclo da atestação: quais mudanças de status o Faturamento pode registrar. */
export const ATESTACAO_ACOES: Partial<
  Record<AttestationStatus, { para: AttestationStatus; rotulo: string; destrutiva?: boolean }[]>
> = {
  PENDENTE: [
    { para: "CONFIRMADA_CLIENTE", rotulo: "Cliente confirmou" },
    { para: "CONTESTADA", rotulo: "Cliente contestou", destrutiva: true },
  ],
  CONFIRMADA_CLIENTE: [{ para: "ATESTADA", rotulo: "Efetuar atestação" }],
  ATESTADA: [{ para: "FATURADA", rotulo: "Marcar como faturada" }],
  CONTESTADA: [{ para: "PENDENTE", rotulo: "Reenviar ao cliente" }],
};

export const PERFIL_LABELS: Record<Perfil, string> = {
  ANALISTA: "Analista",
  GESTOR: "Gestor",
};

/** Etapas cujo motivo de perda é coletado ao mover a proposta para lá. */
export const ETAPAS_COM_MOTIVO: Stage[] = ["RECUSADA", "CANCELADA"];

export const MOTIVO_PERDA_LABELS: Record<MotivoPerda, string> = {
  PRECO: "Preço/orçamento",
  CONCORRENCIA: "Escolheu concorrente",
  PRAZO: "Prazo incompatível",
  ESCOPO: "Escopo não atendeu",
  SEM_ORCAMENTO: "Cliente sem orçamento",
  SEM_RETORNO: "Cliente parou de responder",
  MUDANCA_PRIORIDADE: "Mudança de prioridade do cliente",
  OUTRO: "Outro",
};

export const TONE_COLOR: Record<Tone, string> = {
  progress: "var(--brand)",
  success: "var(--ok)",
  warn: "var(--warn)",
  danger: "var(--danger)",
  neutral: "var(--muted)",
};

export const TONE_SOFT: Record<Tone, string> = {
  progress: "var(--brand-soft)",
  success: "var(--ok-soft)",
  warn: "var(--warn-soft)",
  danger: "var(--danger-soft)",
  neutral: "var(--surface-2)",
};
