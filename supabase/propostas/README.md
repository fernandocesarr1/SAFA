# supabase/propostas

SQL **preparado e ainda não aplicado**. Nada aqui existe no banco.

Existe porque `supabase/migrations/` contém apenas migrations reais e imutáveis
(`AGENTS.md` §7), e misturar proposta com aplicado foi exatamente o que produziu
o D5 — quatro arquivos com nome de migration cujo conteúdo não correspondia ao
que rodou.

## Como uma proposta vira migration

Pelo §7, sem atalho:

1. revisar o SQL aqui, em branch;
2. calcular o hash antes de aplicar;
3. Fernando autoriza **pelo nome**;
4. adquirir o lock (§4);
5. aplicar o mesmo conteúdo por `apply_migration`;
6. capturar a versão gerada pelo Supabase;
7. gravar o arquivo em `supabase/migrations/<versão>_<nome>.sql`;
8. conferir o hash do arquivo contra o SQL registrado no livro-razão;
9. commit, push e liberação do lock.

O arquivo sai daqui quando entra lá. Não se mantém cópia nos dois lugares.

## Fila atual

| Arquivo | Dívida que ataca | Depende de |
|---|---|---|
| `01_lotes_importacao.sql` | D1, D3, D4 — linhagem de todo dado importado | nada |
| `02_triagem.sql` | escalabilidade: varrer o mercado inteiro | `01` |

`02` referencia `import_batches`, criada em `01`. Aplicar fora de ordem falha
alto, que é o comportamento desejado.
