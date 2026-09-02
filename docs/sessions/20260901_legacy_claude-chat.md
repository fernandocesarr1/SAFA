# Sessão legada — Claude (chat)

Registro convertido em 02/09/2026 a partir do `HISTORICO.md` entregue fora do
repositório. A sessão original não registrou horário UTC, commit-base, hash ou PR;
esses dados não foram inventados durante a conversão.

## Correção posterior

A alegação original de que a série de preços teria sido “fabricada” não foi
demonstrada pelos testes apresentados: a escala observada media o tipo da coluna,
e `volume` representava volume financeiro. O achado válido, preservado em
`DEBITOS_TECNICOS.md` D1, é que a série não tem coleta reproduzível nem fonte
específica verificável e, portanto, deve ser rejeitada independentemente da
intenção ou origem.

## Registro original preservado

**Data:** 01/09/2026, horário não registrado.

**Objetivo:** auditoria independente do SAFA — arquitetura, segurança, coerência
entre repositório e banco e verificação da utilidade dos dados para decisão de
alocação de capital.

**Alterado no banco:** nenhuma migration. Sessão integralmente de leitura, por
determinação de Fernando. Foram usados `list_projects`, `list_tables`,
`get_advisors`, `list_edge_functions`, `list_migrations` e `execute_sql` somente
com consultas de leitura.

**Alterado no código:** nenhum commit. Repositório clonado e lido apenas. Foram
entregues a Fernando versões iniciais de `AGENTS.md` e `HISTORICO.md`, então
pendentes de commit.

**Excluído:** nada.

**Achados positivos registrados:**

- nenhum segredo encontrado nos seis commits examinados;
- RLS ativo nas 27 tabelas examinadas, com leitura e sem escrita pública;
- gates de conclusão ativos no banco;
- documentos específicos do FNET, CVM e gestora identificados em parte da base;
- amostras de P/VP e provento conferidas contra fontes externas.

**Achados graves registrados:**

- séries de preços sem proveniência reproduzível;
- migrations vivas sem arquivo idêntico no repositório;
- `requireChatGPTUser()` definida e não chamada;
- pesos metodológicos duplicados em três lugares.

**Decisões registradas:**

- adotar normas comuns para todos os assistentes;
- registrar cada sessão;
- aplicar mudança de schema somente por migration versionada;
- priorizar a correção das séries e a reconciliação das migrations.

**Migration antes/depois:** não registrada na sessão original.

**Lock:** não existia à época; nenhuma escrita no banco ocorreu.

**Commit ou PR:** nenhum.
