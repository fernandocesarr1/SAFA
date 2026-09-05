# supabase/snapshots

Arquivos SQL que **não** são migrations. Ficam aqui, fora de
`supabase/migrations/`, porque `AGENTS.md` §7 exige que aquele diretório contenha
apenas migrations reais e imutáveis.

Antes desta reconciliação eles estavam soltos em `supabase/`, misturados, com
nomes que sugeriam corresponder a migrations aplicadas. Nenhum foi apagado: são
evidência, e alguns corroboram o baseline.

**Nada aqui deve ser executado contra o banco.** Para saber o que está aplicado,
a autoridade é o banco vivo; para saber o que deveria estar, é
`supabase/migrations/`.

## O que é cada arquivo

| Arquivo | bytes | sha256 | O que é |
|---|---|---|---|
| `deep_max_v2.sql` | 98.016 | `3497f950…8034fe` | Snapshot amplo. O nome sugere a migration `deep_max_v2_auditable_analysis`, mas o hash **difere** do aplicado (`15f749c7…`). Contém o limiar de relatórios gerenciais já em 2 — é o arquivo editado retroativamente do D6. Útil como evidência corroborante do baseline. |
| `deep_max_v2_1.sql` | 1.853 | `e4b73be4…ddac78` | Difere do aplicado (`b24e3a13…`). Faz a substituição textual **sem** a guarda `raise exception` que a migration realmente aplicada tem. Foi este arquivo, e não o SQL aplicado, que deu origem à formulação errada do D6. |
| `prioritized_analysis_universe_v1.sql` | 8.447 | `e988dc3f…3ea7d9` | Único arquivo que **confere byte a byte** com o livro-razão. Mantido aqui por completude; a cópia canônica é `supabase/migrations/20260901120522_prioritized_analysis_universe_v1.sql`, idêntica. |
| `qualitative_final_report_v1.sql` | 15.972 | `aa288bb1…9787df` | SQL aplicado **fora do livro-razão**: nenhuma das seis migrations menciona `final_report`, e os objetos estão vivos (4 colunas em `analysis_runs`, a função `safa_private.validate_qualitative_final_report` e o trigger `zz_…`). Esses objetos foram incorporados ao baseline. Não há registro do texto efetivamente executado — este arquivo é o que mais se aproxima, sem prova de que seja idêntico. |
| `schema.sql` | 31.614 | `eae4f281…2317d7` | Snapshot amplo do schema, de data indeterminada. Não corresponde a nenhuma migration. Contém a `v_analysis_readiness` na forma antiga, com `management_reports >= 6`. |
| `source_documents_multi_event_v1.sql` | 412 | `4e56215a…1680f3e` | Difere do aplicado (`52176017…`, 296 bytes). Dropa e cria índices com **nomes diferentes** dos que a migration real mexeu. |

Hashes do conteúdo em LF, como o git os guarda. `.gitattributes` fixa
`*.sql text eol=lf`.

## Por que isso importa

Quatro destes seis arquivos têm nome de migration e conteúdo que não corresponde
ao que foi aplicado. Comparar por nome teria concluído que o repositório
descrevia o banco. É a razão de `AGENTS.md` §5.4 exigir comparação por
**versão + nome + hash**.
