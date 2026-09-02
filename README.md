# SAFA

Sistema pessoal de Análise de FIIs e Ações. A primeira fase cobre FIIs acessíveis ao investidor comum, com régua específica por perfil; a mesma base aceitará ações quando o método estiver estabilizado.

## Estado atual

> **Uso para aportes suspenso.** As séries de preços atuais não têm coleta
> reproduzível nem fonte específica verificável. TRXF11 e GGRC11 dependem dessas
> séries para parte das métricas e dos vereditos; por isso, o ranking atual não
> deve orientar alocação até a recoleta e o recálculo. Consulte
> [`DEBITOS_TECNICOS.md`](DEBITOS_TECNICOS.md), itens D1–D3.

- painel de cobertura do universo e fila de análises;
- Central de Análise com matriz de esgotamento e critérios explícitos por área;
- ficha individual com 16 blocos, 80 critérios universais e 5 critérios por segmento;
- controle separado de documentos e páginas na primeira leitura e na releitura;
- séries de fundamentos, dividendos e preços no Supabase;
- relatório qualitativo final obrigatório, além dos indicadores quantitativos;
- comparador numérico e qualitativo que preserva lacunas como “não avaliado”;
- seis dimensões comparáveis com pesos versionados, risco e confiança separados;
- ações distintas para dinheiro novo e para quem já possui cotas;
- tabelas normalizadas para imóveis, locatários, contratos, dívidas, valuation, premissas, riscos e gatilhos.

O banco bloqueia notas e ranking enquanto não forem cumpridos todos os requisitos do Deep Max v2.1: perfil e elegibilidade verificados, 16 áreas e 80 + 5 critérios concluídos em duas passagens, 9 escopos documentais e 8 escopos estruturados esgotados, os 2 relatórios gerenciais mais recentes, 3 exercícios com notas e auditoria, 36 distribuições classificadas, 750 pregões em ao menos 3 anos, 32 métricas universais + 5 do segmento, três cenários, 12 premissas, contramodelo, riscos, falsificadores e relatório qualitativo final.

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

- código e migrations aprovados: GitHub, branch `main`;
- interface: Next.js/Vinext, preparada para execução em Cloudflare Workers;
- dados: Supabase/Postgres com RLS e acesso público somente para leitura;
- hospedagem atual: ChatGPT Sites, alimentado por um espelho do código aprovado no GitHub;
- destino do livro-razão: migrations SQL imutáveis em `supabase/migrations/`;
- escrita: restrita ao administrador e aos processos de análise.

O schema ainda **não é reproduzível a partir do repositório**: cinco das seis
migrations vivas não possuem correspondência exata e há SQL aplicado fora do
livro-razão. A reconciliação é a próxima etapa técnica, sem mudança de
comportamento ou de dados.

Os PDFs e imagens de relatórios não são guardados. O banco mantém somente referências, competência, contagem de páginas, números estruturados e conclusões necessárias para decisão.

O estado operacional das análises fica no Supabase. Dados sem linhagem até uma
fonte primária específica não podem alimentar gates, cálculos, vereditos ou
ranking.

## Colaboração

Todo assistente deve ler [`AGENTS.md`](AGENTS.md) antes da primeira ação da
sessão. Dívidas conhecidas ficam em
[`DEBITOS_TECNICOS.md`](DEBITOS_TECNICOS.md), e cada sessão gera um registro
imutável em `docs/sessions/`. Claude, Codex e colaboradores humanos trabalham em
branches próprias e integram mudanças por pull request. Consulte
[`CONTRIBUTING.md`](CONTRIBUTING.md); instruções específicas para Claude estão em
[`CLAUDE.md`](CLAUDE.md).
