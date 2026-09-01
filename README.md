# SAFA

Sistema pessoal de Análise de FIIs e Ações. A primeira fase cobre FIIs de tijolo acessíveis ao investidor comum; a mesma base aceitará ações quando o método estiver estabilizado.

## Estado atual

- painel de cobertura do universo e fila de análises;
- Central de Análise com matriz de esgotamento e critérios explícitos por área;
- ficha individual com 16 blocos, 80 critérios universais e 5 critérios por segmento;
- controle separado de documentos e páginas na primeira leitura e na releitura;
- séries de fundamentos, dividendos e preços no Supabase;
- comparador que preserva lacunas como “não avaliado”;
- seis dimensões comparáveis com pesos versionados, risco e confiança separados;
- ações distintas para dinheiro novo e para quem já possui cotas;
- tabelas normalizadas para imóveis, locatários, contratos, dívidas, valuation, premissas, riscos e gatilhos.

O banco bloqueia notas e ranking enquanto não forem cumpridos todos os requisitos do Deep Max v2: elegibilidade verificada, 16 áreas e 80 + 5 critérios concluídos em duas passagens, 9 escopos documentais e 8 escopos estruturados esgotados, 6 competências gerenciais recentes, 3 exercícios com notas e auditoria, 36 distribuições classificadas, 750 pregões em ao menos 3 anos, 32 métricas universais + 5 do segmento, três cenários, 12 premissas, contramodelo, riscos e falsificadores.

Se a busca foi integralmente esgotada, mas uma evidência crítica não existe ou não está disponível, a análise pode terminar somente como `insufficient_data`: sem notas e fora do ranking.

## Régua comparativa

- renda sustentável: 25%;
- qualidade dos ativos: 20%;
- balanço e caixa: 20%;
- gestão e governança: 15%;
- valor e margem de segurança: 15%;
- técnico e liquidez: 5%.

A nota ponderada é calculada pelo banco. Entradas do ranking são derivadas exclusivamente de análises concluídas, na mesma versão metodológica e com data-base dentro da janela do snapshot.

## Arquitetura

- interface: Next.js/Vinext, preparada para execução em Cloudflare Workers;
- dados: Supabase/Postgres com RLS e acesso público somente para leitura;
- esquema reproduzível: execute `supabase/schema.sql` e depois `supabase/deep_max_v2.sql`;
- escrita: restrita ao administrador e aos processos de análise.

Os PDFs e imagens de relatórios não são guardados. O banco mantém somente referências, competência, contagem de páginas, números estruturados e conclusões necessárias para decisão.

O repositório não contém resultados fabricados nem reaproveita vereditos antigos sem evidência. Os dez FIIs iniciais permanecem corretamente no backlog até a coleta e as duas revisões serem executadas.
