# supabase/migrations

Migrations reais e imutáveis, conforme `AGENTS.md` §7. Snapshots e scripts de
implantação ficam em `supabase/snapshots/` e não entram aqui.

## O replay deste diretório ainda NÃO reproduz o banco

Enquanto o baseline não for verificado (ver abaixo), este diretório **não** é
uma descrição executável do banco de produção. Não o use para deduzir o estado
do schema — para isso, a autoridade é o banco vivo, conforme `AGENTS.md` §2.

## Os dois tipos de arquivo aqui

Eles têm forças probatórias diferentes e não devem ser tratados igual.

**1. As seis migrations do livro-razão — cópia verificável.**

Extraídas de `supabase_migrations.schema_migrations`, que guarda o texto
literalmente executado por `apply_migration`. O hash de cada arquivo confere
byte a byte com o registro do banco:

| Arquivo | bytes | sha256 |
|---|---|---|
| `20260901005500_deep_max_operational_controls.sql` | 11.653 | `73e67fc7f02b8a5157c71008813d8aac2d98947025ac14f2da456e087bbf1977` |
| `20260901013828_deep_max_v2_auditable_analysis.sql` | 97.676 | `15f749c76deb2a554971286841819736181d483afe57728da1b6b5f37be2d802` |
| `20260901075024_deep_max_v2_fk_indexes.sql` | 370 | `134c05fff6f6d3a65155395a00b561464b686a330af1b57b23c42a6a125894b4` |
| `20260901120522_prioritized_analysis_universe_v1.sql` | 8.447 | `e988dc3f6307065d7e07730cf5870c6666882d4bd56dfaccededcd4e363ea7d9` |
| `20260901142200_deep_max_v2_1.sql` | 1.946 | `b24e3a13742e383c494d6bc3854635fc37da0724529f17cc71638387d6dbbdee` |
| `20260901142955_source_documents_multi_event_v1.sql` | 296 | `52176017931933f42151d43bb11a6590af90e6d70136f5a58e64a8addded690a` |

Conferência:

```bash
sha256sum supabase/migrations/2026*.sql
```

O hash é do conteúdo em LF. `.gitattributes` fixa `*.sql text eol=lf` — sem
isso o checkout no Windows grava CRLF e nenhum hash confere.

**2. `00000000000000_baseline_pre_ledger.sql` — reconstrução declarada, NÃO
verificada.**

Não é migration, nunca passou por `apply_migration` e não tem entrada no
livro-razão. Nenhuma linha foi inserida lá para representá-lo: forjar essa
entrada falsificaria o registro que esta reconciliação existe para consertar.

Cobre as 11 tabelas fundacionais criadas antes de o projeto adotar
`apply_migration`, mais os objetos de `qualitative_final_report_v1`, que foram
aplicados fora do livro-razão. Como o SQL original dessas tabelas não foi
preservado, o arquivo foi reconstruído lendo o catálogo do banco vivo — não há
texto de referência contra o qual conferir hash.

**Estado de aceitação: não verificado.** Ele só passa a valer depois de replay
num Postgres limpo (baseline + as seis migrations, em ordem de versão), com o
resultado comparado ao banco vivo por `pg_class`, `pg_proc`, `pg_constraint`,
`pg_trigger` e `pg_policies`. Esse replay ainda não foi executado: a máquina da
sessão de reconciliação não tinha Docker nem `psql`. Até lá, o baseline é
dívida técnica com outro nome.

Cuidado com a armadilha que ele carrega por construção: `create table if not
exists` pula tabela existente com estrutura diferente, sem erro e sem aviso.
Rodá-lo contra um banco que já tenha as tabelas não prova fidelidade — a
idempotência só garante que ele é inofensivo contra a produção.

## Ordem

O baseline usa versão `00000000000000` para ordenar antes das seis migrations:
a `20260901005500` faz `alter table` em `analysis_sections` e
`source_documents`, que precisam existir antes.

## Regras

- Migration commitada não se edita. Corrige-se com nova migration (`AGENTS.md` §7).
- Estrutura entra por `apply_migration`, nunca por SQL avulso.
- Comparar sempre por versão + nome + hash. Só por nome não detecta arquivo com
  mesmo nome e conteúdo diferente — defeito já encontrado neste projeto.
