# SAFA

Sistema pessoal de Análise de FIIs e Ações. A primeira fase cobre FIIs de tijolo acessíveis ao investidor comum; a mesma base aceitará ações quando o método estiver estabilizado.

## Estado atual

- painel de cobertura do universo e fila de análises;
- Central de Análise com matriz de esgotamento e critérios explícitos por área;
- ficha individual com 16 blocos e duas passagens obrigatórias;
- controle separado de documentos e páginas na primeira leitura e na releitura;
- séries de fundamentos, dividendos e preços no Supabase;
- comparador que preserva lacunas como “não avaliado”;
- classificação separada de qualidade, renda, segurança, oportunidade e confiança.

O banco bloqueia notas e veredito enquanto não forem cumpridos os requisitos mínimos do método: 16 áreas concluídas em duas passagens, escopo documental obrigatório lido duas vezes, 36 distribuições, 500 pontos de preço e 8 métricas fundamentais distintas.

## Arquitetura

- interface: Next.js/Vinext, preparada para execução em Cloudflare Workers;
- dados: Supabase/Postgres com RLS e acesso público somente para leitura;
- esquema reproduzível: `supabase/schema.sql`;
- escrita: restrita ao administrador e aos processos de análise.

Os PDFs e imagens de relatórios não são guardados. O banco mantém somente referências, competência, contagem de páginas, números estruturados e conclusões necessárias para decisão.
