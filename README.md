# PropostaFlow

CRM de workflow de propostas comerciais: acompanha uma oportunidade desde a
entrada pelo Comercial até o faturamento, passando por Propostas, Delivery,
Contratos e Faturamento.

**Diferencial:** experiência visual — ao pesquisar uma proposta, você vê
imediatamente onde ela está e qual o status dela dentro do fluxo.

O fluxo completo e os estados estão documentados em [docs/FLUXO.md](docs/FLUXO.md).

## Stack

- **Next.js** (React + TypeScript) — frontend e backend no mesmo projeto
- **Tailwind CSS** — estilização
- **PostgreSQL** + **Prisma** — banco de dados e ORM

## Como rodar (desenvolvimento)

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Suba o PostgreSQL no Docker (porta 5434, para não conflitar com outros projetos):
   ```bash
   docker compose up -d db
   ```
   A conexão já está configurada no `.env`
   (`postgresql://propostaflow:propostaflow@localhost:5434/propostaflow`).
3. Crie as tabelas e popule com dados de exemplo:
   ```bash
   npx prisma migrate dev
   npx tsx prisma/seed.ts
   ```
4. Suba o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
   e acesse http://localhost:3000

### Login (dados de exemplo)

Senha `propostaflow` para todos os usuários do seed:

| E-mail | Área | Perfil |
|---|---|---|
| ana@empresa.com | Comercial | Gestor |
| bruno@empresa.com | Propostas | Gestor |
| carla@empresa.com | Delivery | Gestor |
| diego@empresa.com | Contratos | Gestor |
| elisa@empresa.com | Faturamento | Gestor |
| paulo@empresa.com | Propostas | Analista |
| renata@empresa.com | Faturamento | Analista |
| admin@empresa.com | Administração (pode tudo) | Gestor |

**Perfis:** o *gestor* enxerga toda a atividade da área e delega itens
(propostas, contratos, atestações) aos analistas; o *analista* vê nas filas
apenas o que foi delegado a ele e só pode agir sobre esses itens. Quando uma
proposta muda de área, o responsável zera até o gestor da nova fila delegar.

**Acesso às filas:** cada usuário acessa somente a fila da própria área
(tentar abrir outra redireciona para a sua); apenas o ADMIN navega por todas.

**Visibilidade das propostas (busca e detalhe):**
- *ADMIN* — vê todas.
- *Gestor* — vê as propostas com envolvimento da área: na fila da área agora
  ou já movimentadas pela equipe (Contratos/Faturamento: as que viraram
  contrato).
- *Analista* — vê apenas as propostas com envolvimento pessoal: é o
  responsável atual, criou, movimentou, ou (Contratos/Faturamento) tem
  contrato/atestação delegado a ele.

A regra vale também para o acesso por URL direta: proposta fora da
visibilidade do usuário responde 404.

**Relatórios:** disponíveis apenas para o perfil gestor (e ADMIN) — analistas
não veem o item no menu e o acesso direto à URL redireciona para a busca.

**Clientes:** cadastro próprio (nome + sigla única), mantido pelo
administrador ou pelo gestor de Propostas no menu **Clientes**. A nova
proposta escolhe o cliente numa lista (não é mais texto livre); a busca
encontra por nome ou sigla; renomear um cliente atualiza todas as propostas.
Cliente só pode ser excluído se não tiver propostas.

Cada área só vê os botões das ações que lhe cabem; as movimentações são
registradas em nome do usuário logado. O segredo do cookie de sessão vem de
`AUTH_SECRET` no `.env`.

A gestão de usuários (criar, editar, desativar) fica no menu **Usuários**,
visível apenas para a área ADMIN. Usuários desativados não conseguem entrar,
mas o histórico de movimentações deles é preservado.

Também é possível **criar a própria conta** pela tela de login ("Criar
conta"): a pessoa informa nome, e-mail, senha e escolhe a área (ADMIN não é
opção). Toda conta nova nasce com perfil **Analista**; a promoção a Gestor é
feita pelo administrador no menu Usuários.

## Como rodar (produção, tudo em Docker)

```bash
docker compose --profile prod up -d --build
```
Sobe banco + aplicação (build standalone do Next.js) em http://localhost:3000.

## Como testar

```bash
npm test          # roda a suíte uma vez
npm run test:watch  # modo watch, durante o desenvolvimento
```

Testes de integração usam um **banco separado** (`propostaflow_test`, mesmo
Postgres do Docker) — a suíte cria o banco e aplica as migrações
automaticamente na primeira vez, e trunca as tabelas antes de cada teste. O
banco de desenvolvimento nunca é tocado (há uma checagem que recusa rodar se
`DATABASE_URL` não apontar para um banco `*_test`).

Cobertura atual:
- `src/lib/auth-core.test.ts` — regras de permissão (`podeAgir`, `ehGestor`, `podeAtuar`)
- `src/lib/visibilidade.test.ts` — quais propostas cada perfil enxerga na busca
- `src/lib/flow.test.ts` — integridade da configuração do fluxo (guarda contra typo em `TRANSITIONS`/`QUEUES`/`FILA_DONA`)
- `src/app/propostas/actions.test.ts` — integração contra o banco real: transições de etapa (incluindo o reset de responsável ao trocar de área e a criação automática do contrato no aceite), delegação e as regras de visibilidade nas ações de nota/e-mail

## Estrutura

```
prisma/schema.prisma   → modelo do banco (oportunidades, contratos, atestações…)
docs/FLUXO.md          → documentação do workflow e dos estados
src/app/               → páginas e rotas de API (Next.js App Router)
src/test/              → infraestrutura de teste (banco, fixtures, mocks do Next.js)
```

## Roadmap inicial

- [x] Tela de busca de propostas com visualização do fluxo (régua de etapas)
- [x] Página de detalhe com timeline completa (quem moveu, quando, observações)
- [x] Registro de novas propostas pela interface (entra na etapa Entrada)
- [x] Transições de estado com observação e trilha de auditoria; aceite gera o contrato
- [x] Filas de trabalho por área com ações rápidas (Comercial, Propostas, Delivery, Contratos, Faturamento)
- [x] Saúde de contratos e ciclo de atestações (gerar, confirmar com cliente, atestar, faturar)
- [x] Autenticação (login/sessão) e permissões por área; movimentações em nome do usuário logado
- [x] Relatórios: funil de propostas, tempo médio por etapa, taxa de aceite e valores, com filtro de período (este mês, 30/90 dias, ano)
- [x] Gestão de usuários pela interface (menu Usuários, só para ADMIN): criar, editar, trocar senha, desativar/reativar
- [x] Notificações in-app: aviso (sino no topo) quando uma proposta entra na fila da sua área ou um contrato é criado
- [x] Perfis Analista/Gestor por área, com delegação de propostas, contratos e atestações
- [x] Cadastro de clientes (nome + sigla) gerido por admin/gestor de Propostas; proposta escolhe cliente da lista
- [x] Nota interna, log de e-mail e anexo na timeline da proposta
- [x] Suíte de testes (Vitest): permissões, visibilidade, integridade do fluxo e integração das ações críticas contra banco real
- [x] Contato principal (nome, e-mail, telefone) no cadastro de cliente
- [x] Motivo obrigatório ao recusar/cancelar uma proposta (exigido só na página da proposta; fila mantém as ações rápidas sem motivo)
- [x] Relatório de motivos de perda em /relatorios, respeitando o filtro de período
- [x] Soma de valor visível em cada seção das Filas (propostas por etapa, contratos, atestações)
- [x] Alerta de estagnação vira notificação de verdade (não só cor na tela): checagem horária via `instrumentation.ts`, avisa o responsável ou os gestores da fila após 10 dias sem mudança de etapa
- [x] Busca da tela principal também encontra clientes cadastrados (nome ou sigla), com atalho direto para o cadastro
- [x] Visão Kanban com arrastar-e-soltar na tela principal (alternável com a Lista via `?view=kanban`), colunas só do funil ativo; drop só é aceito se a transição for permitida para quem está logado
- [x] Tarefas/lembretes: avulsas ou ligadas a uma proposta, com prazo, responsável e delegação; página "Minhas tarefas", badge de pendências na navegação e checagem horária de tarefas vencidas (`instrumentation.ts`)
- [x] Pipeline ponderado (forecast) em /relatorios: probabilidade padrão de fechamento por etapa (`STAGE_META`), valor ponderado no lugar do bruto e detalhamento por etapa
- [x] Desempenho por responsável em /relatorios: ranking de quem registrou cada proposta, com quantidade, valor total, taxa de aceite e pipeline ponderado
- [x] Busca global (⌘K/Ctrl+K) em qualquer tela: propostas, clientes e pessoas, com navegação por teclado; clicar numa pessoa filtra as propostas sob a responsabilidade dela
- [x] Ações em massa nas Filas: selecionar várias propostas de uma seção (mesma etapa) e mover ou delegar todas de uma vez, com a mesma regra de permissão da ação individual aplicada item a item
- [x] Múltiplos contatos por cliente (entidade `Contact` própria, com um principal em destaque) e histórico consolidado por cliente em /clientes/[id]: todas as propostas e a atividade (mudanças de etapa, e-mails, notas, anexos) das propostas daquele cliente num só lugar
- [x] Motor de automação configurável: o limiar fixo de 10 dias do alerta de estagnação virou regras editáveis em /automacoes (só ADMIN) — nome, etapa (ou "qualquer etapa"), dias parada e ativa/inativa; a checagem horária usa a regra específica da etapa quando existe, senão a regra coringa
