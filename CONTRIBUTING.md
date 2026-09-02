# Colaboração no SAFA

O repositório `fernandocesarr1/SAFA` é a fonte oficial. A branch `main` representa o código aprovado. O repositório gerenciado pelo ChatGPT Sites é somente um espelho de publicação.

## Fluxo obrigatório

1. Atualize a cópia local a partir de `main`.
2. Crie uma branch curta e identificável:
   - `claude/<assunto>` para Claude;
   - `codex/<assunto>` para Codex;
   - `feature/<assunto>` ou `fix/<assunto>` para trabalho humano.
3. Faça mudanças limitadas ao objetivo declarado.
4. Execute `npm run lint` e `npm test`.
5. Abra um pull request explicando alteração, impacto no banco e validações realizadas.
6. Não publique no Sites nem altere o Supabase de produção sem autorização do proprietário.

## Regras de segurança e integridade

- Nunca versione `.env`, tokens, chaves, service-role keys ou credenciais.
- A chave anônima pública do Supabase deve ser tratada como configuração de runtime; credenciais privilegiadas nunca entram no repositório.
- Não grave posições pessoais, quantidades, preços médios ou dados sigilosos no código.
- Não fabrique números para preencher lacunas. Ausência de evidência continua sendo ausência de evidência.
- Não reescreva migrations já aplicadas. Mudanças posteriores entram em novo arquivo SQL aditivo e idempotente.
- Não remova bloqueios de completude para liberar nota, veredito ou ranking.

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
