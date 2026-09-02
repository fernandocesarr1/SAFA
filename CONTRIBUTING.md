# Colaboração no SAFA

O repositório `fernandocesarr1/SAFA` é a fonte oficial. A branch `main` representa o código aprovado. O repositório gerenciado pelo ChatGPT Sites é somente um espelho de publicação.

[`AGENTS.md`](AGENTS.md) é a norma superior de colaboração, proveniência,
migrations, locks e registros de sessão. Em conflito com este guia, prevalece
`AGENTS.md`.

## Fluxo obrigatório

1. Cumpra integralmente o protocolo de abertura de sessão de `AGENTS.md` §5.
2. Atualize a cópia local a partir de `main`.
3. Crie uma branch curta e identificável:
   - `claude/<assunto>` para Claude;
   - `codex/<assunto>` para Codex;
   - `feature/<assunto>` ou `fix/<assunto>` para trabalho humano.
4. Faça mudanças limitadas ao objetivo declarado.
5. Execute `npm run lint` e `npm test` quando houver impacto executável.
6. Grave o registro imutável da sessão conforme `AGENTS.md` §15.
7. Abra um pull request explicando alteração, impacto no banco e validações realizadas.
8. Não publique no Sites nem altere o Supabase de produção sem autorização nominal do proprietário.

## Regras de segurança e integridade

- Nunca versione `.env`, tokens, chaves, service-role keys ou credenciais.
- A chave anônima pública do Supabase deve ser tratada como configuração de runtime; credenciais privilegiadas nunca entram no repositório.
- Não grave posições pessoais, quantidades, preços médios ou dados sigilosos no código.
- Não fabrique números para preencher lacunas. Ausência de evidência continua sendo ausência de evidência.
- Não reescreva migrations já aplicadas. Mudanças posteriores entram em novo arquivo SQL aditivo e idempotente.
- Não remova bloqueios de completude para liberar nota, veredito ou ranking.
- Não use dado sem fonte primária específica para destravar gate ou cálculo.
- Não escreva no banco sem autorização nominal e lock adquirido segundo
  `AGENTS.md` §4.

## Invariantes Deep Max

- duas passagens documentais completas;
- perfil e elegibilidade verificados;
- renda recorrente separada de eventos temporários;
- valuation com cenários e contramodelo;
- riscos, falsificadores e condições de aporte explícitos;
- relatório qualitativo obrigatório, não apenas indicadores numéricos;
- ranking derivado somente de análises concluídas e comparáveis.

## Validação local

```bash
npm run install:ci
npm run lint
npm test
```

Mudanças exclusivamente documentais podem dispensar nova compilação, mas o pull request deve declarar isso.
