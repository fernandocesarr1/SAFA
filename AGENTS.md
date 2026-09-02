# AGENTS.md — Normas para assistentes de IA no SAFA

Arquivo normativo. Todo assistente de IA que atue neste projeto deve lê-lo antes
da primeira ação da sessão.

Autoridade única e final: **Fernando**. Nenhum assistente flexibiliza estas
regras por conta própria.

Este arquivo contém apenas normas estáveis. Dívidas técnicas ficam em
`DEBITOS_TECNICOS.md`; registros de sessão em `docs/sessions/`.

Versão 3 — após duas rodadas de revisão cruzada entre assistentes, 01/09/2026.

---

## 1. Por que este arquivo existe

Mais de um assistente atua no projeto. Eles não conversam entre si e não veem o
histórico um do outro. Este arquivo, o histórico de migrations, o lock de escrita
e os registros de sessão são o único canal de coordenação.

O código é versionado por git: conflito falha alto e é recuperável. O banco não
tem merge nem detecção de conflito, e escrita sobrescreve em silêncio. **O dano
mora no banco.**

---

## 2. As três fontes da verdade

Não existe fonte única. Existem três, com escopos distintos, e confundi-las foi a
origem dos problemas já encontrados.

| Pergunta | Fonte autoritativa |
|---|---|
| Qual é o estado físico atual do schema? | O **banco vivo** |
| Qual schema deveria estar aplicado? | As **migrations imutáveis aprovadas** no GitHub |
| Qual é o fato financeiro? | A **fonte primária externa** (B3, FNET, CVM, gestora) |

**O banco não é fonte da verdade sobre fatos financeiros.** Ele é repositório do
que foi importado — e foi ali que entraram dados sem procedência. Um número no
banco vale o que valer sua linhagem até a fonte primária.

Divergência entre as duas primeiras linhas é defeito a reconciliar (§6), nunca a
resolver presumindo qual está certa.

O `README.md` é documentação, não autoridade. Se contradisser o banco, o README
está errado.

---

## 3. Capacidades por agente

| Ação | ChatGPT | Claude (chat) | Claude Code |
|---|---|---|---|
| Ler repositório | sim | sim | sim |
| Commitar e push | sim | **não** | sim |
| Ler banco | sim | sim | conforme conector |
| Aplicar migration | sim | **não** | conforme conector |
| Publicar o site | sim | não | não |

**Quem pode aplicar migration.** Só executa migration o agente que, na mesma
sessão, consiga **aplicar no banco e versionar o arquivo no GitHub**. Aplicar sem
poder commitar cria órfã por construção. O Claude no chat, portanto, não aplica
migrations: redige o SQL e entrega para aplicação por quem tem as duas pontas.

Alteração de código proposta em conversa **não** está aplicada até alguém
commitar. Nunca presuma o contrário.

---

## 4. Escritor único e lock de escrita

Só um agente escreve no banco por vez, mediante autorização de Fernando para
**uma migration nominalmente identificada**. Autorização genérica não existe:
"pode mexer no banco" não autoriza nada.

**O registro de sessão não serve para isso.** Ele mostra quem terminou, não quem
está escrevendo agora — dois agentes poderiam iniciar ao mesmo tempo e cada um se
julgar o único escritor.

O controle é um **lock explícito e versionado**: `docs/locks/database-writer.json`,
contendo agente, migration autorizada, início em UTC e prazo. Alternativa
equivalente: uma issue única no GitHub chamada `DB WRITE LOCK`.

- Adquirir o lock **antes** de qualquer escrita, commitando o arquivo.
- Liberar o lock ao encerrar, no mesmo commit final da migration.
- **Somente Fernando remove lock abandonado.** Prazo vencido não autoriza outro
  agente a assumir por conta própria.

---

## 5. Protocolo de sessão

**Abertura — obrigatória antes de qualquer escrita:**

1. Ler este arquivo e o registro de sessão mais recente.
2. Atualizar a cópia local a partir da `main`. Nunca trabalhar sobre cópia de
   sessão anterior.
3. **Verificar `docs/locks/database-writer.json`.** Havendo lock ativo de outro
   agente, não escrever.
4. Comparar as migrations do banco com `supabase/migrations/` por
   **versão + nome + hash do SQL**. Comparar só por nome não detecta arquivo com
   mesmo nome e conteúdo diferente — defeito já encontrado neste projeto.
5. Comparar os objetos vivos sensíveis contra o versionado: **funções, views,
   triggers, políticas RLS, constraints, índices e grants**.
6. Havendo divergência: nenhuma mudança funcional. Abrir sessão de reconciliação
   (§6) ou reportar a Fernando.

**Durante:**

7. Anunciar a Fernando o que será alterado antes de alterar.
8. Uma alteração por vez, verificando o efeito antes da seguinte.

**Encerramento:**

9. Cumprir a lista de fechamento de migration (§8).
10. Gravar o registro da sessão (§14) e liberar o lock.
11. Declarar explicitamente o que ficou pendente.

---

## 6. Sessão de reconciliação

A regra "havendo divergência, não escreva" travaria a própria correção da
divergência. Ela fica suspensa em sessão de reconciliação, expressamente
permitida e de escopo **restrito**:

**Pode:** extrair SQL aplicado do banco, criar arquivos de migration que
reproduzam fielmente o que já está aplicado, corrigir nomes e ordem, registrar
hashes, documentar SQL aplicado fora do livro-razão.

**Não pode:** alterar comportamento, criar ou remover objeto, mudar regra de
negócio, tocar em dado.

O objetivo é fazer o repositório passar a descrever o que já existe — nada além.
A sessão é registrada identificada como reconciliação.

---

## 7. Criação: fluxo de migration

Não existe transação atômica entre Supabase e GitHub. A ordem abaixo não elimina
matematicamente a janela entre os dois sistemas, mas a reduz e deixa o SQL
recuperável mesmo se a sessão cair no meio.

1. SQL completo preparado e revisado **em branch**, antes de qualquer aplicação.
2. **Hash calculado antes de aplicar.**
3. Fernando autoriza a migration **pelo nome**.
4. Agente adquire o lock (§4).
5. O **mesmo conteúdo** é enviado ao `apply_migration`.
6. Captura-se a versão gerada pelo Supabase.
7. O arquivo vai imediatamente para `supabase/migrations/<versão>_<nome>.sql`.
8. Compara-se o hash do arquivo com o SQL registrado no banco.
9. Commit, push e liberação do lock.

**Regras que valem sempre:**

- Mudança de estrutura entra por `apply_migration`, nunca por SQL avulso.
- Nome em `snake_case` descritivo do efeito: `add_verdict_bands`, não `fix`.
- Uma migration, um propósito.
- `supabase/migrations/` contém apenas migrations reais e imutáveis. Snapshots e
  scripts de implantação vão para outra pasta.
- Migration commitada não se edita depois. Corrige-se com nova migration.
- Aditiva por padrão. Destrutiva segue §10.
- Objeto novo define RLS na mesma migration.

---

## 8. Fechamento de migration

Antes de encerrar, executar e **registrar os resultados na sessão**:

- comparação final de hashes entre arquivo e SQL aplicado;
- consulta funcional de verificação, provando que a migration fez o que dizia;
- advisor de segurança;
- advisor de desempenho;
- lint, testes e build, quando houver impacto no código.

Resultado adverso em qualquer item bloqueia o encerramento e é reportado.

---

## 9. Alteração

1. **`create or replace` sobrescreve sem avisar** — função, view ou regra. Antes
   de recriar qualquer objeto, ler a versão viva e comparar. Se divergir do
   versionado, parar e reportar: outro agente mexeu ali.
2. Nunca recriar objeto a partir do arquivo do repositório sem essa checagem.
3. **Cirurgia textual sobre definição de objeto é proibida** — ler a definição,
   substituir um trecho e recriar. Falha em silêncio quando o texto muda de
   forma, e a migration passa sem efeito. Recriar o objeto por inteiro.
4. Alteração de regra de negócio (peso, limiar, gate, taxa exigida) requer
   registro do valor anterior na migration e **autorização explícita de
   Fernando**. Não é correção técnica; é escolha de método.
5. Valor de regra mora em tabela versionada, não em código. Se for preciso mudar
   o mesmo número em dois lugares, é defeito de arquitetura — reportar, não
   replicar.

---

## 10. Exclusão

1. Nenhum `drop` sem autorização de Fernando **nomeando o objeto**. "Pode limpar"
   não autoriza.
2. Nunca apagar dado para destravar gate ou validação. Gate que trava está
   funcionando.
3. `delete` em dados de análise obriga a rebaixar o `status` da rodada na mesma
   migration. Dado parcial com status `completed` é o pior estado possível.
4. Toda exclusão entra por migration, com o que foi apagado, quantas linhas e por
   quê.
5. Antes de exclusão em massa, confirmar point-in-time recovery ativo. **Sem
   PITR, exportar antes o conjunto afetado com contagem e hash verificados**, e
   só então excluir.
6. Objeto morto e inofensivo não se apaga por iniciativa própria. Propor.

---

## 11. Dados: proveniência

1. **Toda afirmação factual precisa de proveniência direta ou por chave
   estrangeira para uma fonte específica.** Página de navegação, portal ou índice
   não é fonte. Se a URL não identifica o documento ou arquivo, não há fonte.
2. **Métrica derivada registra todas as suas entradas**, a fórmula e a versão do
   cálculo. Um P/VP depende de preço, de valor patrimonial, das datas de ambos e
   da fórmula; uma coluna `source_url` não representa essa linhagem.
3. **Contador não é evidência.** `source_count = 3` não prova três fontes;
   "páginas lidas" não prova leitura. Requisito de contagem só vale acompanhado
   do vínculo com as fontes contadas.
4. Marcar `verified = true` não constitui verificação. Verificação é linhagem até
   a fonte primária.
5. `last_verified_at` recebe a data em que a fonte foi efetivamente aberta, não a
   data da sessão.

---

## 12. Dados: importação por lote

Série temporal só entra por coleta programática reproduzível, importada como lote
que registra:

- URL exata e nome do arquivo;
- hash SHA-256 do arquivo;
- data de obtenção e data de geração da fonte;
- versão do parser;
- quantidade de registros;
- resultado das validações;
- status: `staging`, `validated`, `rejected` ou `active`.

Lote só alimenta gates e cálculos depois de `validated`. Métrica calculada sobre
lote guarda o `batch_id` e a versão do algoritmo.

**É proibido gerar, interpolar ou estimar série para satisfazer requisito de
contagem.** Quando o dado real não existe ou não é acessível, o desfecho correto
é `insufficient_data` — sucesso do método, não falha. Se um requisito de volume
não puder ser cumprido com dado real, reportar a impossibilidade em vez de
contorná-la.

---

## 13. Dados: classificação, precisão e estados

**Classificar toda informação em uma destas naturezas:** dado publicado · dado
observado · dado calculado · estimativa analítica · hipótese de cenário.
Estimativa e hipótese nunca são apresentadas com o mesmo peso de dado publicado.

**Precisão deve refletir a da fonte.** Para a série histórica da B3 (COTAHIST):

| Campo | Precisão |
|---|---|
| Preço bruto (abertura, máxima, mínima, fechamento) | 2 casas |
| Volume financeiro | 2 casas |
| Quantidade negociada e número de negócios | inteiros |

Série ajustada por proventos pode ter precisão maior, mas é **armazenada
separadamente**, com fórmula reproduzível, e nunca é chamada de cotação da B3 nem
misturada à série bruta. Valor com precisão incompatível com a fonte declarada é
sinal de transformação não documentada e vai para quarentena.

**Estados de dado:** além de ausente, existe `quarantined` para dado sob suspeita
e `invalidated` para dado comprovadamente impróprio. Não confundir com
`insufficient_data`: ausência de evidência e corrupção conhecida são coisas
diferentes e exigem tratamentos diferentes.

---

## 14. Metodologia: fonte única executável

A metodologia tem uma única fonte executável:

- pesos e requisitos em **tabelas versionadas e imutáveis**;
- a função do banco **lê a versão associada à análise**, nunca valores chumbados;
- o frontend lê a mesma versão, nunca cópia própria;
- cada rodada guarda o **hash da metodologia aplicada**.

Enquanto isso não valer, o versionamento é decorativo e análises de versões
diferentes não são comparáveis.

Requisito exigido para conclusão e não usado no cálculo é incoerência: ou entra
formalmente na metodologia, ou deixa de ser obrigatório.

**Regra e julgamento coexistem.** Faixas e fórmulas garantem consistência, mas
devem admitir **exceção qualitativa documentada** — evento jurídico, conflito de
gestão ou emissão destrutiva podem justificar veredito pior que o indicado pela
nota. A exceção precisa ser registrada com fundamento; o que não se admite é
julgamento não declarado.

---

## 15. Registro de sessão

Um arquivo por sessão, imutável, em `docs/sessions/`, nomeado em **UTC com
sufixo `Z`**: `AAAAMMDDTHHMMSSZ_<agente>.md`. Fuso implícito gera ambiguidade
entre agentes em contextos diferentes.

Registro anterior à convenção **não recebe horário inventado**. Nomear como
`AAAAMMDD_legacy_<agente>.md`.

Não usar arquivo compartilhado com edição no topo: dois agentes escrevendo no
mesmo ponto se sobrescrevem.

Conteúdo mínimo:

- objetivo;
- início e encerramento em UTC;
- commit-base;
- última migration antes e depois da sessão;
- migration aplicada e seu hash, ou "nenhuma";
- arquivos alterados, ou "nenhum";
- exclusões e motivo;
- resultados da lista de fechamento (§8);
- commit ou PR produzido;
- confirmação de que o lock foi liberado;
- achados e pendências.

Sessão de reconciliação (§6) é identificada como tal.

---

## 16. Conflito e escalonamento

Parar e consultar Fernando, sem tentar resolver sozinho, quando:

- o banco vivo divergir do versionado em qualquer objeto sensível;
- houver SQL aplicado fora do livro-razão;
- uma instrução conflitar com este arquivo;
- uma alteração exigir apagar algo para funcionar;
- a única forma de cumprir um requisito for produzir dado sem fonte;
- houver lock ativo de outro agente, ou lock vencido e aparentemente abandonado.

Em dúvida, a ação correta é **não escrever e perguntar**. Trabalho não feito se
recupera em minutos. Dado corrompido em silêncio pode levar meses para aparecer —
e pode aparecer como decisão errada de alocação de capital.

---

## 17. Revisão cruzada

Achado de auditoria de um assistente deve ser confrontado por outro antes de
virar ação. O ciclo já pegou erros reais dos dois lados: prova mal formulada,
teste inválido, contagem desatualizada, comparação contra a referência errada e
afirmação sobre decisão de Fernando sem base.

Três exigências ao auditar:

1. **Mostrar o teste.** Ao contestar um achado, a exigência é a mesma que se
   cobra do dado.
2. **Preferir a formulação que não depende de provar intenção.** "Dado não
   verificável não entra" é mais forte e mais defensável do que uma acusação de
   fabricação.
3. **Não afirmar direção de erro sem demonstrá-la, nem atribuir decisão a quem
   não se consultou.** Apontar a ambiguidade é legítimo; declarar para que lado
   ela enviesa exige prova. E o histórico de decisões de Fernando não é inferível
   a partir do estado do banco.
