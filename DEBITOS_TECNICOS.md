# DEBITOS_TECNICOS.md — Inventário de dívidas

Lista viva. Não apagar item resolvido: marcar com data e como foi resolvido.
As normas ficam em `AGENTS.md`; este arquivo é só o inventário.

Origem: auditoria do Claude em 01/09/2026, revisada e corrigida pelo ChatGPT em
duas rodadas na mesma data. Achados corrigidos estão marcados.

Versão 2.

---

## Bloqueantes para uso do sistema em decisão de aporte

### D1 — Séries de preço não reproduzíveis
As 1.830 linhas de `market_prices` apontam apenas para uma página genérica da B3.
Não há coletor reproduzível no repositório nem identificação do arquivo-fonte.
Além disso, o GGRC11 tem 198 fechamentos com precisão além de duas casas,
incompatível com preço bruto da B3.

**Rejeitar independentemente de terem sido fabricadas, transformadas
incorretamente ou importadas sem rastreabilidade. Dado não verificável não entra.**

> *Correção:* a formulação original alegava fabricação com base em casas decimais
> e volumes não redondos. Ambas as provas estavam erradas. `close_price` é
> `numeric(18,6)`, então `scale()` devolve 6 para qualquer conteúdo — o teste
> media o tipo da coluna, não o dado; pelo teste correto o TRXF11 tem **zero**
> fechamentos além de duas casas. E `volume` guarda volume **financeiro** em
> reais (R$ 519 mil a R$ 95,5 milhões), não contagem de cotas: valores distintos
> e não múltiplos de mil são o esperado.

### D2 — Análises concluídas dependem das séries rejeitadas
TRXF11 e GGRC11 estão `completed`, `completion_ready = true` e alimentam o
ranking. Notas técnicas, suportes, resistências, Fibonacci, volatilidade,
drawdown, médias e parte dos valuations dependem do dado rejeitado.

As conclusões qualitativas podem ser reaproveitadas após nova verificação, mas
**os vereditos consolidados precisam ser reabertos**. Não usar o ranking atual
para decisão de aporte.

### D3 — Dívida de proveniência além dos preços
- 39 proventos do GGRC11 apontando para página genérica de documentos;
- 1 provento do TRXF11 apontando para página geral de relatórios;
- 35 URLs de proventos com caractere oculto `\r`;
- 240 registros de imóveis e contratos apontando para página dinâmica de portfólio;
- métricas, premissas e gatilhos apontando para páginas iniciais de B3 e Banco Central.

### D4 — Gates verificam preenchimento, não verdade
Os gates conferem contagens: 750 preços, 36 distribuições, narrativas
preenchidas, páginas, número de fontes. Não conferem se o dado veio da fonte.
`analysis_criterion_reviews` guarda `source_count` como inteiro solto, sem vínculo
entre critério, documento, página e conclusão.

---

## Reprodutibilidade do schema

### D5 — ~~Cinco das seis migrations sem reprodução exata~~ · PARCIALMENTE RESOLVIDO em 03/09/2026
Estado original: cinco das seis migrations não tinham reprodução exata no
repositório, que sequer possuía `supabase/migrations/`.

**Resolvido na sessão de reconciliação de 03/09/2026:** as seis migrations foram
extraídas de `supabase_migrations.schema_migrations` — que guarda o texto
literalmente executado por `apply_migration` — e gravadas em
`supabase/migrations/<versão>_<nome>.sql`. O hash de cada arquivo confere byte a
byte com o registro do banco; a conferência está no registro da sessão e no
`README.md` do diretório. Os arquivos soltos foram para `supabase/snapshots/`
sem exclusão, com seu status probatório documentado. `.gitattributes` fixa
`*.sql text eol=lf`, sem o que o checkout no Windows grava CRLF e nenhuma
comparação de hash confere.

A auditoria de nomes contra hash confirmou a tabela original em cheio: dos
quatro arquivos com nome de migration, só `prioritized_analysis_universe_v1.sql`
conferia.

**Replay verificado em 04/09/2026.** As 11 tabelas fundacionais sem `create
table` no livro-razão — `instruments`, `analysis_runs`, `analysis_sections`,
`source_documents`, `metric_definitions`, `metric_observations`,
`cash_distributions`, `market_prices`, `material_events`, `ranking_snapshots`,
`ranking_entries` — foram criadas antes de o projeto adotar `apply_migration`.
**O SQL fora do livro-razão é anterior a ele, não posterior.** Reconstruídas em
`00000000000000_baseline_pre_ledger.sql`; o órfão `qualitative_final_report_v1`,
em `99999999999999_qualitative_final_report_out_of_ledger.sql`. Nenhuma linha
foi inserida no livro-razão para representá-los.

Replay em Postgres 17.2 limpo (produção roda 17.6.1): os oito arquivos aplicam
sem erro e produzem assinatura estrutural equivalente à de produção — 938 linhas
dos dois lados, 936 idênticas, cobrindo colunas, constraints, índices, triggers,
funções, políticas, RLS e definição das views. As duas diferenças são um par de
parênteses externos na reconstrução de dois `CHECK` de `ranking_entries`,
idênticas ignorando agrupamento; normalização de deparse entre versões.

O replay achou um defeito real e o corrigiu: as colunas `final_report*` estavam
no baseline e faziam `v_analysis_queue` — criada com `select candidate.*`, que
congela a lista de colunas — sair com quatro colunas a mais. Foram movidas para
o arquivo do órfão, que roda depois das seis migrations. **É a demonstração de
por que baseline sem replay não vale: a inspeção não teria pego isso.**

**Permanece em aberto:**

- `qualitative_final_report_v1` segue sem registro do texto executado. O arquivo
  reproduz o estado vivo e foi verificado por replay, mas não há prova de que
  seja idêntico ao SQL originalmente aplicado, e ele continua ausente do
  livro-razão. Formalizá-lo exige aplicar migration em produção — decisão de
  Fernando, não ação técnica neutra.
- As 11 fundacionais permanecem sem texto de origem. Isso é irrecuperável: o
  SQL não foi preservado. A garantia disponível é de resultado, não de origem.

### D6 — ~~`deep_max_v2.sql` editado retroativamente~~ · REESCRITO em 03/09/2026
Cirurgia textual sobre definição de view: a `deep_max_v2_1` lê a definição com
`pg_get_viewdef`, troca `management_unique_competencies >= 6` por `>= 2` e
recria a view. **Hoje está protegida por guarda e funcionando** — a migration
tem `raise exception` caso a substituição não encontre o alvo, de modo que
falharia alto, não em silêncio.

**Não é no-op.** Verificado: a `deep_max_v2_auditable_analysis` contém `>= 6` e
não contém `>= 2`; a substituição encontrou o alvo e teve efeito.

A dívida que permanece é de técnica: **substituir por recriação integral do
objeto na próxima vez que a view for tocada**, conforme `AGENTS.md` §9.3.

> *Correção:* a formulação anterior afirmava que a migration passava sem efeito
> e sem erro. Ela julgou a migration pelo **arquivo solto**
> (`deep_max_v2_1.sql`, hash `e4b73be4…`), que de fato não tem a guarda — e não
> pelo SQL aplicado, registrado no livro-razão com hash `b24e3a13…`. São textos
> diferentes. É exatamente o defeito que o D5 descreve, aplicado contra quem o
> escreveu.

O mérito da decisão de 6 para 2 é assunto do D7, e está ratificado.

### D7 — ~~Redução de rigor sem decisão~~ · RATIFICADA
A redução de 6 para 2 relatórios gerenciais foi **determinada expressamente por
Fernando** e é decisão de método legítima. Não há dívida de governança neste
item.

Permanece apenas como registro: a metodologia poderá ser reavaliada no futuro se
a base documental disponível aumentar.

> *Correção:* a formulação original afirmava que o limiar fora ajustado ao dado
> disponível sem consulta a Fernando. Isso foi inferido do estado do banco, sem
> base. O histórico de decisões de Fernando não é inferível a partir do schema.

---

## Metodologia

### D8 — Pesos em três lugares
Tabela `methodology_weights` (nunca lida), trigger
`validate_analysis_run_completion` (chumbados, é o que calcula) e
`lib/deep-max-methodology.ts` (exibição). Versionamento decorativo.

### D9 — Yield exigido é discricionário
O valor justo depende inteiramente de uma taxa escolhida caso a caso (13,25% no
TRXF11, justificada como "taxa intermediária"). Com 12% o valor justo vira R$ 86
e o veredito vira compra; com 14,5% vira R$ 71. Com 22 fundos recebendo cada um
sua taxa, o ranking não compara.

**Proposta:** `yield exigido = NTN-B longa + prêmio do segmento + ajustes
documentados`, cada ajuste como linha em `valuation_assumptions`.

### D10 — Modelo de valuation ambíguo
O modelo não declara:

- se a taxa é **taxa de desconto de fluxo** ou **cap rate sobre renda
  estabilizada**;
- se a renda é **nominal ou real**;
- se o crescimento é **explícito ou já embutido** na taxa.

Como os contratos são indexados a IPCA/IGP-M, essas distinções mudam o resultado.
**A dívida é a ambiguidade, não uma direção de erro.** Um cap rate já incorpora
crescimento por construção (`cap = r − g`); acrescentar termo de crescimento a um
cap rate que já o embute produziria dupla contagem e superavaliação.

> *Correção:* a formulação original afirmava "viés sistemático de subavaliação".
> Direção de erro não demonstrada — e provavelmente errada, pelo motivo acima.

### D11 — Risco medido e não incorporado
Dez riscos quantificados com probabilidade, impacto e perda percentual.
`quantified_loss_pct` não entra em nenhum cálculo.

**Não somar as perdas.** Riscos podem ser correlacionados, sobrepostos ou
mutuamente exclusivos. Devem alimentar cenários, `safety_score` ou valor esperado
por **método explícito e documentado**, e não por agregação aritmética simples.

### D12 — Falta ligação formal entre cenários, retorno exigido e veredito
O sistema produz cenários probabilísticos, retorno exigido, riscos quantificados
e um veredito — sem nenhuma relação formal entre eles. O veredito hoje é decidido
comparando preço com valor justo base, e os demais componentes não participam.

Exemplo do TRXF11: esperança matemática dos cenários de **+11,27%** contra
retorno exigido de **13,25%**. O veredito `wait_price` é **coerente** — o retorno
esperado está abaixo do piso. Mas essa coerência é acidental, não construída: a
comparação não está implementada em lugar nenhum.

> *Correção:* a formulação original tratava +11,27% como contradição do veredito.
> Errado — comparei o retorno esperado contra zero em vez de contra o retorno
> exigido. Retorno esperado positivo não implica compra; é preciso confrontá-lo
> com o piso exigido, a magnitude do downside, a confiança das premissas e as
> alternativas disponíveis.

### D13 — Sem faixas ligando nota e preço ao veredito
Classificação é julgamento por rodada; duas rodadas com a mesma nota podem
receber vereditos diferentes.

As faixas devem admitir **exceção qualitativa documentada**: evento jurídico,
conflito de gestão ou emissão destrutiva podem justificar veredito pior que o
indicado pela nota. O objetivo é consistência com julgamento declarado, não
automação cega.

### D14 — Onze métricas técnicas obrigatórias
`fibonacci_levels`, `macd`, `rsi_14`, `ma_20`, `ma_50`, `ma_200`,
`support_level`, `resistance_level` — sem base evidencial para alocação de renda
com horizonte longo, e hoje é impossível concluir análise sem produzir níveis de
Fibonacci. Manter `volatility_annual`, `max_drawdown_3y` e `liquidity_daily`.

### D15 — `opportunity_score` e `safety_score`
Exigidos para conclusão, ausentes da fórmula ponderada. Incorporar ou desobrigar.

### D16 — Métricas ausentes frente à prática de mercado
- `ntnb_long_yield`, `dy_spread_ntnb`, `cap_rate_spread_ntnb` — âncora central de
  barateza usada pelo mercado profissional;
- `issuance_price_to_nav`, `issuance_dilution_pct`, `issuance_track_record` — o
  dano da emissão ocorre quando sai abaixo do VP; caso vivo do TRXF11;
- `income_cagr_3y`, `dy_cagr_3y` — trajetória da renda, não só nível;
- `debt_maturing_12m_pct`, `debt_duration_years`, `covenant_headroom_min`;
- `revenue_share_ipca`, `revenue_share_igpm`.

---

## Aplicação e infraestrutura

### D17 — Autorização própria ausente · bloqueante condicional
`requireChatGPTUser()` está definida em `app/chatgpt-auth.ts` e **nunca é
chamada**. A aplicação não tem autorização própria; a proteção vem só do proxy da
hospedagem. Mesmo se chamada, apenas verifica a existência do header de e-mail —
autentica alguém, mas não garante que seja Fernando. Para o Sites, a identidade
estável é o header de **ID do usuário**; o e-mail serve para exibição.

**Classificação acordada:** prioridade baixa no ambiente privado e somente
leitura atual; **bloqueante de implantação** antes de qualquer mudança de
hospedagem, abertura pública, escrita pela aplicação ou inclusão de dados
pessoais.

Independentemente disso: o Supabase permanece publicamente legível, e nenhuma
proteção de frontend altera esse fato.

### D18 — `coverage_pct` não mede progresso
Só vira 100 quando o status vira `completed`. Rodada integralmente pesquisada
aparece como 0%.

### D19 — `material_events` fora do gate
GGRC11 tem 10 eventos, TRXF11 tem zero — apesar de a 13ª emissão constar nos
documentos. A conclusão do TRXF11 não deveria ter passado sem registrá-la.

### D20 — Scaffold D1 sem uso
`drizzle.config.ts`, `drizzle/meta` vazio e `db/schema.ts` sem tabelas. É
scaffold de Cloudflare D1 da hospedagem, com dialeto `sqlite` coerente e binding
desativado. Não rodar `drizzle-kit`. Avaliar remoção.

> *Correção:* a formulação original dizia "mal configurado contra o Postgres".
> Errado: o dialeto está correto para o que o scaffold é.

---

## Trabalho preparado e ainda NÃO integrado

Adicionado em 05/09/2026. **Nenhum item abaixo resolve dívida ainda**: o código
existe, tem teste e não está ligado ao app nem ao banco. Registrado aqui para
não parecer feito.

### O achado que motivou

A arquitetura não alcança o objetivo declarado do SAFA — varrer o mercado de
FIIs — e o motivo é aritmético, não de esforço. O Deep Max exige 16 seções, 100
critérios e leitura documental integral em duas passagens por fundo. Saíram duas
análises em dois dias; o mercado tem centenas de fundos. Nenhum ganho de
produtividade fecha essa conta.

A correção é separar varredura de análise profunda, em funil de quatro
estágios, com triagem quantitativa automática antes do Deep Max. Desenho em
`docs/arquitetura/funil-de-triagem.md`.

### O que já existe

| Módulo | Ataca | Estado |
|---|---|---|
| `lib/coleta/cotahist/` | D1 | parser do registro de 245 posições, com rejeição explícita e precisão de 2 casas. **Falta o download e a descompactação.** |
| `lib/coleta/lote.ts` | D1, D3, D12 | linhagem obrigatória: URL que identifique o arquivo, hash, versão do parser, contagem |
| `lib/triagem/` | escalabilidade, D4 | decomposição `ln(P1/P0) = ln(R1/R0) − ln(Y1/Y0)` e sinais de deterioração com estado `desconhecido` |
| `lib/metodologia/yield-exigido.ts` | D9, D10 | NTN-B + prêmio + ajustes, cada linha com fonte; cap rate sobre renda real declarado por escrito |
| `supabase/propostas/` | D1, D4 | SQL de lotes e triagem, **não aplicado** |

32 testes de comportamento passando (`npm run test:unit`).

### O que impede de valer

1. **Nada está integrado.** O app não lê nada disso; o banco não tem as tabelas.
2. **Falta o coletor de proventos (FNET).** Sem ele, a renda usada na
   decomposição continua vindo dos dados que o D1 manda rejeitar.
3. **A triagem não roda sozinha** — falta o orquestrador que percorre o universo.
4. **Rodar a triagem sobre os dados atuais herdaria o D1** e daria aparência
   quantitativa a dado sem procedência, que é pior do que não ter triagem.

---

## Ordem de execução acordada

1. Revisar e aprovar os arquivos de governança.
2. Reconstruir fielmente as migrations e identificar SQL aplicado fora do
   livro-razão (D5, D6).
3. Bloquear ranking e vereditos dependentes das séries rejeitadas (D2).
4. Criar estrutura de lotes, validação e linhagem (D4; `AGENTS.md` §12).
5. Coletar novamente os preços oficiais via COTAHIST (D1).
6. Coletar e sanear proventos via formulário estruturado do FNET (D3).
7. Recalcular métricas e reabrir TRXF11 e GGRC11 (D2).
8. Registrar os eventos materiais do TRXF11 (D19).
9. Centralizar pesos e metodologia (D8), depois tratar D9 a D16.
10. Corrigir progresso e scaffold (D18, D20); D17 conforme o gatilho condicional.

Os itens D9, D10, D12 e D13 mexem em premissa de valuation ou em regra de
veredito: exigem decisão explícita de Fernando, não são correções técnicas
neutras.
