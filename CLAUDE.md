# Instruções para Claude no SAFA

Antes de alterar o projeto, leia `README.md`, `CONTRIBUTING.md`, `lib/deep-max-methodology.ts` e as migrations relacionadas ao módulo afetado.

## Fonte e entrega

- O GitHub é a fonte oficial.
- Nunca trabalhe diretamente em `main`; use `claude/<assunto>`.
- Entregue toda mudança por pull request.
- Não tente publicar diretamente no ChatGPT Sites. Após o merge, o proprietário ou Codex sincronizará o espelho de hospedagem.

## Banco de dados

- O backend é Supabase/Postgres.
- Consulte o esquema e as migrations antes de propor SQL.
- Para evolução do banco, crie migration nova, aditiva, idempotente e com comentários sobre rollback ou compatibilidade.
- Não execute DDL ou DML no projeto de produção sem autorização explícita.
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

Execute `npm run lint` e `npm test`. No texto do PR, informe:

- o problema resolvido;
- arquivos e migrations alterados;
- impacto sobre Supabase, metodologia e dados existentes;
- testes executados;
- limitações ou decisões ainda pendentes.
