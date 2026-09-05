# HANDOFF — SAFA, contexto para continuar no Claude Code

Documento de passagem. Escrito em 01/09/2026 por Claude (chat), ao fim de uma
auditoria de leitura, para que outro agente retome o trabalho sem repetir o
levantamento.

**Nada foi alterado no banco nem no repositório nesta auditoria.** Toda a sessão
foi de leitura, por determinação de Fernando.

---

## 1. O que é o SAFA

Sistema pessoal de análise profunda de FIIs. Lê relatórios, informes e documentos
oficiais de cada fundo, aplica uma metodologia versionada ("Deep Max") com 100
critérios em 16 seções e 52 métricas, e produz nota ponderada em seis dimensões
mais um veredito de alocação.

O objetivo declarado é uma **régua comparativa auditável** entre fundos, usada
por Fernando para decisão real de aporte de capital. Isso define o padrão de
qualidade: número bonito sem linhagem até a fonte primária é pior que número
ausente.

Foi construído inteiramente por assistente de IA (ChatGPT) em 31/08 e 01/09/2026.

---

## 2. Onde as coisas estão

**Repositório:** `github.com/fernandocesarr1/SAFA` — público, 7 commits.
Next.js/Vinext + React 19 + Tailwind 4, TypeScript.

**Hospedagem:** `safa-investimentos.fernandocesarr1.chatgpt.site` — infra da
OpenAI, via `.openai/hosting.json`. **Não é GitHub Pages** e não há workflow de
Actions. Responde 401 fora da sessão autenticada do ChatGPT.

**Banco:** Supabase, projeto `SAFA`, ref `vqengpentflnxtmqahed`, região
`sa-east-1`, status saudável. Existem também dois projetos inativos (`SIGO` e
`sigo-opus`) que **não pertencem a este trabalho**.

**Chaves:** nenhum segredo vazado em nenhum commit. Tudo por `process.env`,
`.env*` no `.gitignore`, uso da publishable key (leitura). Verificado no
histórico completo.

---

## 3. Estado do banco (verificado em 01/09/2026)

- 28 tabelas públicas, RLS ativo em todas, **uma política por tabela, só
  `SELECT`**, para `anon` e `authenticated`. Nenhuma política de escrita — as
  gravações acontecem por `service_role`, fora do front.
- Nenhum alerta do advisor de segurança.
- 6 triggers ativos. As funções ficam no schema `safa_private`, com
  `security invoker` e `search_path` vazio.
- 6 migrations no livro-razão (`supabase_migrations.schema_migrations`).
- **Nenhuma edge function.** Nada roda no servidor; toda a análise é o assistente
  escrevendo linha a linha.
- 22 fundos no universo. **2 análises concluídas** (TRXF11 e GGRC11), 20 em
  backlog com 0% de cobertura.
- `ranking_snapshots` e `ranking_entries` **vazias**. O ranking nunca foi gerado.

**Objetos centrais para entender o sistema:**

| Objeto | Papel |
|---|---|
| `v_analysis_readiness` | view com ~35 condições que definem "análise pronta" |
| `validate_analysis_run_completion` | trigger que calcula `weighted_score` e barra conclusão inválida |
| `validate_ranking_entry` | trigger que barra entrada no ranking |
| `methodology_weights` | tabela de pesos versionados — **nunca é lida por nada** |
| `analysis_criterion_reviews` | 1.810 linhas, quase todas `pending` (andaime) |

---

## 4. Armadilhas que vão te morder

1. **`supabase/*.sql` não reflete o que está aplicado.** Cinco das seis
   migrations não têm reprodução exata no repositório, e não existe pasta
   `supabase/migrations/`. Nunca deduza o estado do banco lendo o repo.
2. **`deep_max_v2_1` faz cirurgia textual em view** — lê a definição, troca
   `>= 6` por `>= 2`, recria. Numa recriação limpa o texto já está em 2, a troca
   não acha nada e **a migration passa sem efeito e sem erro**.
3. **`create or replace` sobrescreve em silêncio.** É o único ponto onde dois
   agentes apagam o trabalho um do outro sem nada quebrar.
4. **A janela do ranking é de ±7 dias.** `validate_ranking_entry` exige que a
   data-base de cada análise esteja a no máximo 7 dias do cutoff do snapshot. Com
   22 fundos, isso exige fechar todos dentro de uma janela de 15 dias — o que
   torna o ranking inalcançável em ritmo manual e é o motivo real de as tabelas
   estarem vazias.
5. **`coverage_pct` não mede progresso**, só vira 100 quando o status vira
   `completed`.
6. **Não rode `drizzle-kit`.** É scaffold de Cloudflare D1 da hospedagem, com
   binding desativado e `db/schema.ts` vazio. Dialeto `sqlite` está correto para
   o que ele é; não é erro de configuração.

---

## 5. Governança já acordada

Três arquivos precisam estar no repositório antes do trabalho técnico. Os dois
primeiros ainda **não estão commitados**:

- **`AGENTS.md` v2** — normas. Passou por revisão cruzada entre ChatGPT e Claude.
- **`DEBITOS_TECNICOS.md`** — inventário de 20 dívidas, com ordem de execução.
- **`docs/sessions/`** — um arquivo imutável por sessão,
  `AAAAMMDDTHHMMSS_<agente>.md`. Substitui o `HISTORICO.md`, que usava topo
  compartilhado e se sobrescreveria entre agentes.

Já estão no repo, criados pelo ChatGPT: `CLAUDE.md` e `CONTRIBUTING.md`. **Não
são contraditórios com o `AGENTS.md` v2, mas se sobrepõem** — consolidar é uma
tarefa pendente.

**Regras que mais afetam quem trabalha no código:**

- Três fontes da verdade distintas: banco vivo para o estado do schema;
  migrations imutáveis para o schema pretendido; **fonte primária externa para
  fato financeiro** — o banco não é autoridade sobre número.
- Comparar migrations por **versão + nome + hash**, nunca só por nome.
- Só aplica migration quem consegue **aplicar e versionar na mesma sessão**.
  Isso te inclui e exclui o Claude no chat.
- Um escritor de banco por vez, autorizado por Fernando para uma migration
  nominalmente identificada.
- Divergência entre banco e repo bloqueia mudança funcional, mas **permite
  sessão de reconciliação** de escopo restrito (§6 do `AGENTS.md`).

---

## 6. O achado central

**O sistema tem arquitetura séria e dados sem procedência.** Os gates verificam
preenchimento, não verdade — e uma série de preços sem rastreabilidade passou por
todos eles.

As 1.830 linhas de `market_prices` apontam apenas para uma página genérica da B3.
Não há coletor reproduzível nem identificação do arquivo-fonte. **Devem ser
rejeitadas independentemente de terem sido fabricadas, transformadas
incorretamente ou importadas sem rastreabilidade.**

Consequência: as duas análises concluídas alimentam o ranking com notas técnicas,
volatilidade, drawdown, suportes, resistências e Fibonacci derivados de dado
rejeitado. **Os vereditos consolidados precisam ser reabertos.** As conclusões
qualitativas e documentais são reaproveitáveis após nova verificação — essa parte
resistiu à auditoria: IDs específicos do FNET, PDFs nomeados, caminho real da
CVM, e métricas que conferem com fontes externas.

Detalhe metodológico importante: **não tente provar fabricação.** Duas provas
forenses da auditoria original estavam erradas (teste de casas decimais medindo o
tipo da coluna, e leitura de volume financeiro como se fosse contagem de cotas).
A formulação correta e mais forte é "dado não verificável não entra".

---

## 7. Fila de trabalho, em ordem

1. **Commitar a governança** — `AGENTS.md` v2, `DEBITOS_TECNICOS.md`, criar
   `docs/sessions/`, consolidar com `CLAUDE.md` e `CONTRIBUTING.md`.
2. **Sessão de reconciliação de migrations** — extrair o SQL aplicado do banco,
   criar `supabase/migrations/` com arquivos fiéis e imutáveis, registrar hashes,
   documentar o SQL que está no banco fora do livro-razão
   (`qualitative_final_report_v1`). Escopo restrito: nada muda de comportamento.
3. **Bloquear ranking e vereditos** dependentes das séries rejeitadas.
4. **Criar estrutura de lotes** — tabela de importação com URL, nome do arquivo,
   SHA-256, data de obtenção, data de geração da fonte, versão do parser,
   contagem, validações e status `staging`/`validated`/`rejected`/`active`.
   Métrica calculada guarda `batch_id` e versão do algoritmo.
5. **Coletor de preços via COTAHIST** — arquivos oficiais da B3, ZIP, registro
   fixo de 245 posições, filtrando `TIPREG=01`, `CODNEG=<ticker>`, `CODBDI=12`
   (FII), `TPMERC=010` (à vista). Hash do ZIP antes de processar. Importar
   abertura, máxima, mínima, fechamento, negócios, quantidade, volume financeiro,
   ISIN. `adjusted_close` fica nulo: COTAHIST é série bruta. Série ajustada, se
   necessária, é derivada separada e nunca se chama "B3".
6. **Coletor de proventos** via formulário estruturado "Aviso aos Cotistas" do
   Fundos.NET/B3, com ID específico do FNET, URL específica e hash do documento.
   O Informe Mensal da CVM serve para conciliação, não como substituto.
7. **Recalcular métricas e reabrir** TRXF11 e GGRC11.
8. **Registrar os eventos materiais do TRXF11** — a 13ª emissão está nos
   documentos e ausente de `material_events`.
9. **Centralizar pesos e metodologia** (D8), depois as questões de método D9–D16.
10. **Corrigir** progresso, autorização e scaffold (D17, D18, D20).

**Os passos 4, 5 e 6 são a razão de o trabalho migrar para o Claude Code:**
exigem escrever, executar e versionar código de coleta, com as duas pontas na
mesma sessão. Nenhum agente de chat faz isso corretamente.

---

## 8. Questões de método que precisam de decisão de Fernando

Não são correções técnicas neutras. Não aplicar sem ratificação explícita.

- **Yield exigido discricionário.** O valor justo depende de uma taxa escolhida
  caso a caso — 13,25% no TRXF11. Com 12% o valor justo vai a R$ 86 e o veredito
  vira compra; com 14,5% vai a R$ 71. Proposta: ancorar na NTN-B longa mais
  prêmio decomposto e documentado.
- **Ausência de termo de crescimento** no valuation, embora os contratos sejam
  indexados a IPCA/IGP-M. Gera viés sistemático de subavaliação e deixa ambíguo
  se as taxas são reais ou nominais.
- **Risco medido e descartado.** `quantified_loss_pct` não entra em cálculo
  nenhum.
- **Veredito ignora o retorno esperado** que o próprio sistema calcula. No TRXF11
  a esperança matemática dos cenários é +11,27% em 12 meses, e o veredito foi
  "espere".
- **Redução de rigor não ratificada:** a exigência de relatórios gerenciais caiu
  de 6 para 2, e ambos os fundos têm exatamente 2.

Detalhamento em `DEBITOS_TECNICOS.md`, itens D7 e D9 a D16.

---

## 9. Primeira coisa a fazer nesta sessão

Antes de qualquer escrita, executar a abertura do `AGENTS.md` §5: comparar as
migrations do banco com o repositório por versão + nome + hash, e comparar
funções, views, triggers, políticas, constraints, índices e grants vivos contra
o versionado.

Este documento reporta o estado de 01/09/2026. **Não confie nele como estado
atual** — confirme.
