# PropostaFlow — Fluxo de trabalho

## Visão geral

O sistema acompanha uma oportunidade comercial desde a entrada até o faturamento,
passando por áreas distintas. O diferencial é **visual**: em qualquer busca, o
usuário vê imediatamente **onde a proposta está** e **qual o status dela** dentro
do fluxo.

## Etapas e responsáveis

| # | Etapa | Área responsável | Resultado |
|---|-------|------------------|-----------|
| 1 | Entrada da oportunidade | **Comercial** | Oportunidade registrada |
| 2 | Tratativa | **Equipe de Propostas** | Proposta elaborada |
| 3 | Verificação / validação | **Delivery** | Proposta validada (ou devolvida para ajustes) |
| 4 | Entrega ao Comercial | **Comercial** | Proposta enviada ao cliente |
| 5 | Aceite do cliente | Cliente | Contrato criado |
| 6 | Controle do contrato | **Área de Contratos** | Saúde do contrato monitorada |
| 7 | Atestação do serviço | **Área de Faturamento** | Atestação registrada |
| 8 | Confirmação do cliente | Cliente | Libera (ou contesta) a atestação |
| 9 | Atestação efetuada | **Área de Faturamento** | Faturamento |

## Estados da oportunidade (Stage)

```
ENTRADA → EM_TRATATIVA → EM_VERIFICACAO → PROPOSTA_PRONTA → ENVIADA_CLIENTE → ACEITA
                              ↓ (reprovada)                                      ↓
                           AJUSTES → EM_TRATATIVA                            CONTRATO
```

Estados terminais alternativos: `RECUSADA`, `CANCELADA`.

## Estados da atestação

```
PENDENTE → CONFIRMADA_CLIENTE → ATESTADA → FATURADA
    ↓
CONTESTADA
```

## Princípios de produto

1. **Visual em primeiro lugar** — a linha do tempo do fluxo (alimentada pela
   tabela `WorkflowEvent`) é o coração da interface: cada proposta mostra sua
   jornada completa, quem moveu, quando e com qual observação.
2. **Cada área vê o que importa para ela** — filas de trabalho por área
   (Comercial, Propostas, Delivery, Contratos, Faturamento).
3. **Nada se perde** — toda transição de estado gera um evento auditável.
