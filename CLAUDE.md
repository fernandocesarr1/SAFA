# Instruções para Claude no SAFA

Antes de qualquer ação da sessão, leia `AGENTS.md` integralmente. Em seguida,
cumpra o protocolo de abertura de `AGENTS.md` §5 e leia `README.md`,
`CONTRIBUTING.md`, `DEBITOS_TECNICOS.md`, o registro de sessão mais recente e os
arquivos relacionados ao módulo afetado.

`AGENTS.md` é normativo e prevalece sobre este arquivo.

## Fonte e entrega

- O GitHub é a fonte oficial.
- Nunca trabalhe diretamente em `main`; use `claude/<assunto>`.
- Entregue toda mudança por pull request.
- Não tente publicar diretamente no ChatGPT Sites. Após o merge, o proprietário ou Codex sincronizará o espelho de hospedagem.

## Banco de dados

- O backend é Supabase/Postgres.
- Consulte o esquema e as migrations antes de propor SQL.
- O Claude no chat não aplica migrations: pode redigir e revisar SQL, mas entrega
  a aplicação a um agente que consiga escrever no banco e versionar no GitHub na
  mesma sessão.
- Para evolução do banco, siga o fluxo completo de `AGENTS.md` §§4 e 7–10.
- Não execute DDL ou DML no projeto de produção sem autorização explícita e
  nominal de Fernando.
- Nunca solicite, imprima ou versione service-role keys.

## Regras do produto

- O SAFA busca a melhor decisão provável, não a confirmação de uma tese prévia.
- Não produza veredito somente com múltiplos ou dividend yield.
- Dados quantitativos, leitura qualitativa, contexto, contraprovas e limitações têm o mesmo peso de integridade.
- RMG, ganho de venda, rendimento financeiro transitório e reservas não são renda recorrente sem demonstração.
- Evento anunciado não é evento concluído.
- Métrica indisponível não vira zero, média ou estimativa silenciosa.
- Nenhuma análise entra no ranking antes de `completion_ready = true`.

## Antes do pull request

Registre a sessão conforme `AGENTS.md` §15. Execute `npm run lint` e `npm test`
quando houver impacto executável. No texto do PR, informe:

- o problema resolvido;
- arquivos e migrations alterados;
- impacto sobre Supabase, metodologia e dados existentes;
- testes executados;
- limitações ou decisões ainda pendentes.
