# SAFA

Sistema pessoal de Análise de FIIs e Ações. A primeira fase cobre FIIs de tijolo acessíveis ao investidor comum; a mesma base aceitará ações quando o método estiver estabilizado.

## Primeira versão

- painel de cobertura do universo e fila de análises;
- ficha individual com 16 blocos e duas passagens obrigatórias;
- controle de documentos e páginas efetivamente lidas;
- séries de fundamentos, dividendos e preços no Supabase;
- comparador que preserva lacunas como “não avaliado”;
- classificação separada de qualidade, renda, segurança, oportunidade e confiança.

## Arquitetura

- interface: Next.js/Vinext, preparada para execução em Cloudflare Workers;
- dados: Supabase/Postgres com RLS e acesso público somente para leitura;
- esquema reproduzível: `supabase/schema.sql`;
- escrita: restrita ao administrador e aos processos de análise.

Os PDFs e imagens de relatórios não são guardados. O banco mantém somente referências, competência, contagem de páginas, números estruturados e conclusões necessárias para decisão.

