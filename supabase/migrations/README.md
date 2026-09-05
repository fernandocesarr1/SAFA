# supabase/migrations

Migrations reais e imutáveis, conforme `AGENTS.md` §7, mais dois arquivos de
reconciliação que **não** são migrations e estão identificados como tais.
Snapshots e scripts de implantação ficam em `supabase/snapshots/`.

## Estado: o replay reproduz o banco

Verificado em 04/09/2026. O replay dos arquivos deste diretório, em ordem de
nome, contra um Postgres limpo, produz um schema estruturalmente equivalente ao
de produção. O método e o resultado estão em
`docs/sessions/20260904T113000Z_claude-code.md`.

Isso **não** transforma o repositório em autoridade sobre o estado do banco. A
hierarquia de `AGENTS.md` §2 continua valendo: para saber o que está aplicado,
pergunte ao banco vivo.

## Os três tipos de arquivo aqui

Eles têm forças probatórias diferentes e não devem ser tratados igual.

### 1. As seis migrations do livro-razão — cópia verificável

Extraídas de `supabase_migrations.schema_migrations`, que guarda o texto
literalmente executado por `apply_migration`. O hash confere byte a byte:

| Arquivo | bytes | sha256 |
|---|---|---|
| `20260901005500_deep_max_operational_controls.sql` | 11.653 | `73e67fc7f02b8a5157c71008813d8aac2d98947025ac14f2da456e087bbf1977` |
| `20260901013828_deep_max_v2_auditable_analysis.sql` | 97.676 | `15f749c76deb2a554971286841819736181d483afe57728da1b6b5f37be2d802` |
| `20260901075024_deep_max_v2_fk_indexes.sql` | 370 | `134c05fff6f6d3a65155395a00b561464b686a330af1b57b23c42a6a125894b4` |
| `20260901120522_prioritized_analysis_universe_v1.sql` | 8.447 | `e988dc3f6307065d7e07730cf5870c6666882d4bd56dfaccededcd4e363ea7d9` |
| `20260901142200_deep_max_v2_1.sql` | 1.946 | `b24e3a13742e383c494d6bc3854635fc37da0724529f17cc71638387d6dbbdee` |
| `20260901142955_source_documents_multi_event_v1.sql` | 296 | `52176017931933f42151d43bb11a6590af90e6d70136f5a58e64a8addded690a` |

```bash
sha256sum supabase/migrations/2026*.sql
```

Hashes do conteúdo em LF. `.gitattributes` fixa `*.sql text eol=lf` — sem isso o
checkout no Windows grava CRLF e nenhum hash confere.

### 2. `00000000000000_baseline_pre_ledger.sql` — reconstrução verificada por replay

As 11 tabelas fundacionais criadas antes de o projeto adotar `apply_migration`.
Esse SQL não foi preservado, então o arquivo foi reconstruído lendo o catálogo
do banco vivo: **não há texto de referência contra o qual conferir hash.** A
garantia aqui não é de origem, é de resultado — o replay reproduz o schema.

Ordena antes das seis migrations porque a `20260901005500` faz `alter table` em
`analysis_sections` e `source_documents`.

### 3. `99999999999999_qualitative_final_report_out_of_ledger.sql` — órfão, reconstruído

SQL aplicado fora do livro-razão: nenhuma das seis migrations menciona
`final_report`, e os objetos estão vivos. Também é reconstrução, não cópia.

Ordena **depois** das seis, e isso não é arbitrário. `v_analysis_queue` é criada
pela `20260901120522` com `select candidate.*`, que congela a lista de colunas
no instante da criação — e em produção ela não contém as colunas
`final_report*`. Logo, essas colunas vieram depois. O replay demonstrou: com
elas no baseline, a view saía com quatro colunas a mais.

Nenhuma linha foi inserida no livro-razão para representar os arquivos 2 e 3.
Forjar essa entrada falsificaria o registro que a reconciliação existe para
consertar.

## Como repetir o replay

Postgres limpo, criar os roles `anon`, `authenticated` e `service_role`, aplicar
os arquivos em ordem de nome com `ON_ERROR_STOP=1`, e comparar a assinatura
estrutural contra produção — colunas com tipo, `NOT NULL`, default e identity;
constraints; índices; triggers; funções; políticas; RLS; e `pg_get_viewdef` das
views.

Resultado esperado, medido em 04/09/2026: 938 linhas de assinatura dos dois
lados, 936 idênticas. As duas diferenças são `ranking_entries_score_range` e
`ranking_entries_v2_score_range`, que trazem um par de parênteses externos a
mais na reconstrução do `CHECK` — idênticas ignorando agrupamento, e `AND` é
associativo. É normalização de deparse entre 17.6.1 (produção) e 17.2 (replay).

Crie as extensões num schema separado, não em `public`. No Supabase elas moram
em `extensions`; criá-las em `public` faz aparecerem 46 funções de `pgcrypto` e
`uuid-ossp` que não existem lá.

## Cuidado que continua valendo

`create table if not exists` pula tabela existente com estrutura diferente, sem
erro e sem aviso. Rodar os arquivos 2 e 3 contra um banco que já tenha os
objetos não prova nada — a idempotência só garante que são inofensivos contra a
produção. A prova é o replay em banco limpo.

## Regras

- Migration commitada não se edita. Corrige-se com nova migration (`AGENTS.md` §7).
- Estrutura entra por `apply_migration`, nunca por SQL avulso.
- Comparar sempre por versão + nome + hash. Só por nome não detecta arquivo com
  mesmo nome e conteúdo diferente — defeito já encontrado neste projeto.
