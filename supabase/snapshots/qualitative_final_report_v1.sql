-- Relatório final qualitativo obrigatório para toda análise Deep Max concluída.
begin;

alter table public.analysis_runs
  add column if not exists final_report_status text not null default 'pending',
  add column if not exists final_report_version text,
  add column if not exists final_report_generated_at timestamptz,
  add column if not exists final_report jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'analysis_runs_final_report_status'
      and conrelid = 'public.analysis_runs'::regclass
  ) then
    alter table public.analysis_runs add constraint analysis_runs_final_report_status
      check (final_report_status in ('pending', 'complete', 'insufficient_data'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'analysis_runs_final_report_object'
      and conrelid = 'public.analysis_runs'::regclass
  ) then
    alter table public.analysis_runs add constraint analysis_runs_final_report_object
      check (final_report is null or jsonb_typeof(final_report) = 'object');
  end if;
end $$;

create or replace function safa_private.validate_qualitative_final_report()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.final_report_status = 'complete' then
    if new.final_report is null or pg_catalog.jsonb_typeof(new.final_report) <> 'object' then
      raise exception 'SAFA: relatorio qualitativo completo precisa ser um objeto estruturado';
    end if;
    if nullif(pg_catalog.btrim(new.final_report->>'title'), '') is null
      or nullif(pg_catalog.btrim(new.final_report->>'executive_summary'), '') is null
      or nullif(pg_catalog.btrim(new.final_report->>'final_conclusion'), '') is null
      or nullif(pg_catalog.btrim(new.final_report_version), '') is null
    then
      raise exception 'SAFA: relatorio qualitativo exige titulo, resumo executivo, conclusao e versao';
    end if;
    if pg_catalog.jsonb_typeof(new.final_report->'sections') <> 'array'
      or pg_catalog.jsonb_typeof(new.final_report->'strengths') <> 'array'
      or pg_catalog.jsonb_typeof(new.final_report->'weaknesses') <> 'array'
      or pg_catalog.jsonb_typeof(new.final_report->'conditions_to_invest') <> 'array'
      or pg_catalog.jsonb_typeof(new.final_report->'limitations') <> 'array'
    then
      raise exception 'SAFA: secoes, forcas, fragilidades, condicoes e limitacoes precisam ser listas';
    end if;
    if pg_catalog.jsonb_array_length(new.final_report->'sections') < 6
      or pg_catalog.jsonb_array_length(new.final_report->'strengths') = 0
      or pg_catalog.jsonb_array_length(new.final_report->'weaknesses') = 0
      or pg_catalog.jsonb_array_length(new.final_report->'conditions_to_invest') = 0
    then
      raise exception 'SAFA: relatorio qualitativo nao cobre o escopo minimo';
    end if;
    if exists (
      select 1
      from pg_catalog.jsonb_array_elements(new.final_report->'sections') section
      where nullif(pg_catalog.btrim(section->>'code'), '') is null
        or nullif(pg_catalog.btrim(section->>'title'), '') is null
        or nullif(pg_catalog.btrim(section->>'content'), '') is null
    ) then
      raise exception 'SAFA: toda secao qualitativa exige codigo, titulo e conteudo';
    end if;
    new.final_report_generated_at := coalesce(new.final_report_generated_at, pg_catalog.now());
  else
    new.final_report_generated_at := null;
  end if;

  if new.status = 'completed' and new.final_report_status <> 'complete' then
    raise exception 'SAFA: analise concluida exige relatorio qualitativo final completo';
  end if;

  return new;
end;
$$;

drop trigger if exists zz_validate_qualitative_final_report on public.analysis_runs;
create trigger zz_validate_qualitative_final_report
before insert or update on public.analysis_runs
for each row execute function safa_private.validate_qualitative_final_report();

update public.analysis_runs ar
set
  final_report_status = 'complete',
  final_report_version = 'qualitative-v1',
  final_report_generated_at = now(),
  final_report = $report$
  {
    "title": "Relatório final Deep Max — TRXF11",
    "executive_summary": "O TRXF11 não atravessa uma crise operacional: a vacância permanece muito baixa, os contratos são longos e a base de imóveis e locatários é ampla. O ponto de atenção é financeiro e estratégico. O fundo cresceu rapidamente, assumiu uma estrutura de capital mais complexa e abriu uma 13ª emissão muito grande para financiar aquisições e compromissos. O desconto em relação ao valor patrimonial parece atraente isoladamente, mas parte dele remunera riscos reais de alavancagem, execução, diluição econômica e pressão vendedora. Por isso, a conclusão não é evitar o fundo, e sim esperar uma margem de segurança maior ou evidências concretas de desalavancagem e cobertura recorrente do rendimento.",
    "final_conclusion": "O TRXF11 é um fundo operacionalmente bom, mas ainda não é uma oportunidade Deep Max aprovada a R$ 79,30. O valor justo-base estimado é R$ 78 e a zona preferencial para novos aportes fica em R$ 72 ou menos, desde que renda, vacância e qualidade dos ativos não se deteriorem. Para quem já possui cotas, a leitura é manter sob vigilância, sem aumentar a posição agora. O veredito muda favoravelmente se a emissão for concluída de forma suficiente, a alavancagem ampla convergir para 25% ou menos e a renda recorrente se aproximar da distribuição. Muda negativamente se houver financiamento caro ou venda forçada para honrar compromissos, piora operacional relevante ou queda persistente da renda normalizada.",
    "sections": [
      {
        "code": "current_situation",
        "title": "O que está acontecendo com o fundo",
        "content": "O TRXF11 está em uma fase de expansão e transformação do portfólio, não de deterioração dos imóveis existentes. A gestora anunciou uma 13ª emissão de grande porte e um pipeline bilionário que inclui logística, shopping, educação e outras rendas urbanas. Muitas operações dependem da captação, compensação de créditos, diligências, obras ou condições precedentes. Assim, existe uma diferença importante entre a carteira efetivamente realizada e a carteira projetada após a oferta. O mercado passou a exigir desconto porque ainda não conhece o tamanho final da emissão, o custo efetivo da expansão nem a velocidade de desalavancagem."
      },
      {
        "code": "portfolio_operations",
        "title": "Qualidade do portfólio e da operação",
        "content": "A base operacional é o principal suporte da tese. São 120 imóveis considerados na carteira de julho, distribuídos por diferentes estados, cidades e usos, com vacância física de 0,5% e financeira de 0,3%. O WALE de 13,41 anos reduz o risco de vencimentos imediatos e 74,25% da receita está em contratos classificados como atípicos. Entretanto, atípico não significa proteção integral em todos os casos: o Hotel Emiliano possui multa limitada a doze aluguéis e o Log Recife tem contrato típico e multa de três aluguéis. A análise, portanto, reconhece a força contratual sem presumir que toda receita esteja garantida pelo prazo remanescente."
      },
      {
        "code": "income_quality",
        "title": "Qualidade da renda e do rendimento",
        "content": "A distribuição corrente de R$ 0,93 por cota é atraente, mas não deve ser confundida com renda inteiramente recorrente. Nos doze meses analisados, o resultado somou aproximadamente R$ 10,31 por cota enquanto as distribuições alcançaram R$ 11,80, uma cobertura próxima de 87,4%. Junho teve resultado e distribuição extraordinários, e julho encerrou com resultado de R$ 0,96, distribuição de R$ 0,93 e reserva gerencial de R$ 0,57 por cota. A renda mensal normalizada foi estimada em R$ 0,86. O rendimento atual pode ser mantido no curto prazo por reservas, ganhos e novas receitas, mas ainda precisa provar cobertura recorrente próxima de 1 vez."
      },
      {
        "code": "capital_structure",
        "title": "Balanço, dívidas e compromissos",
        "content": "A leitura restrita das securitizações mostra alavancagem líquida de 20,14% e boa liquidez para as amortizações dos próximos doze meses. Essa medida, porém, não captura toda a obrigação econômica. A própria nota técnica apresenta aproximadamente R$ 2,7 bilhões em financiamentos e R$ 1,2 bilhão em parcelamentos com vendedores e obras, resultando em alavancagem líquida ampla de 31,1% do ativo. O prazo médio longo e a liquidez existente reduzem o risco de insolvência imediata, mas não eliminam o risco de custo financeiro, execução da oferta e necessidade de vender ativos ou contratar dívida adicional."
      },
      {
        "code": "management_governance",
        "title": "Gestão, alocação de capital e governança",
        "content": "A gestão demonstra elevada capacidade de originação, negociação e estruturação, além de histórico de reciclagem de ativos com ganhos. Ao mesmo tempo, a velocidade e a complexidade das operações aumentaram. Há aquisições indiretas, veículos subordinados, compensação de créditos com vendedores, ativos em desenvolvimento e operações com fundos relacionados. O regulamento concede mandato amplo, capital autorizado elevado e possibilidade de concentração relevante. A taxa de desenvolvimento e as camadas de veículos relacionados exigem atenção porque crescimento patrimonial não é automaticamente criação de valor por cota. A gestão é uma força de execução, mas também uma fonte de risco de complexidade e conflito."
      },
      {
        "code": "transactions_pipeline",
        "title": "Aquisições, vendas e pipeline",
        "content": "O pipeline declarado supera R$ 4,82 bilhões, com parcela relevante prevista por compensação de créditos. Guarulhos adiciona ativos logísticos importantes e exposição ao Mercado Livre, mas parte da operação ainda depende de desenvolvimento e estrutura financeira. Hotel Emiliano foi concluído; outros negócios, como Cy.Capital, Log Recife e Iguatemi, permaneciam sujeitos a etapas futuras. A proposta de aquisição das lajes Malzoni e Vista Faria Lima foi abandonada e não foi incluída no valuation. Da mesma forma, vendas anunciadas só foram tratadas como caixa ou desalavancagem depois de concluídas. Essa separação impede que expectativas sejam registradas como patrimônio realizado."
      },
      {
        "code": "valuation_timing",
        "title": "Valuation e momento de entrada",
        "content": "A R$ 79,30, a cota negociava aproximadamente 18,3% abaixo do valor patrimonial de julho. O desconto é relevante, mas o valor patrimonial contém avaliações nível 3 e não reflete sozinho o custo de capital nem os riscos do pipeline. O cenário pessimista aponta R$ 63 por cota, o base R$ 78 e o otimista R$ 93. Como o preço analisado está ligeiramente acima do valor justo-base, o retorno esperado no cenário central não oferece prêmio suficiente em relação aos juros para compensar os riscos de execução. A zona de R$ 72 ou menos cria desconto adicional e melhora a assimetria, desde que a tese operacional permaneça preservada."
      },
      {
        "code": "risks",
        "title": "Principais fragilidades e riscos",
        "content": "Os riscos mais relevantes são a oferta não captar ou compensar créditos na escala prevista, manutenção da alavancagem ampla acima da política declarada, distribuição depender de ganhos ou reservas, cotas entregues a vendedores pressionarem o mercado após os lock-ups, atraso ou aumento de custo nas obras e concentração futura no Mercado Livre. Também há sensibilidade a juros: parte material das securitizações está indexada ao CDI e o custo das dívidas IPCA é elevado. As avaliações dos imóveis e participações dependem de premissas de valor justo, o que pode produzir revisão patrimonial caso os cap rates de mercado se abram."
      },
      {
        "code": "technical_context",
        "title": "Contexto técnico e comportamento do preço",
        "content": "O preço estava abaixo das médias de 50 e 200 pregões, confirmando tendência de baixa de médio prazo, embora o RSI não indicasse sobrevenda extrema e o histograma do MACD mostrasse melhora marginal. As regiões de R$ 69 a R$ 72 funcionam como suporte relevante; R$ 83, R$ 87 e R$ 91 a R$ 92 são resistências. A análise técnica não determina a qualidade do fundo nem o valor intrínseco, mas ajuda a evitar aportar durante uma pressão vendedora ainda não estabilizada, especialmente enquanto a emissão permanece em andamento."
      },
      {
        "code": "decision",
        "title": "Decisão de investimento",
        "content": "O veredito é esperar preço e execução. Isso significa que o fundo continua investível e merece acompanhamento, mas não foi aprovado para dinheiro novo no preço analisado. Um novo aporte passa a fazer sentido em R$ 72 ou menos com a tese preservada, ou em preço superior se a emissão terminar satisfatoriamente, a alavancagem ampla convergir, as operações condicionais forem concluídas sem deterioração econômica e a renda recorrente cobrir a distribuição. Para o cotista atual, a orientação analítica é manter sob vigilância e não ampliar a posição enquanto essas confirmações não aparecem."
      }
    ],
    "strengths": [
      "Portfólio amplo, diversificado e com vacância operacional muito baixa.",
      "Contratos longos, alta participação de contratos atípicos e locatários de grande porte.",
      "Capacidade comprovada da gestão para originar operações e reciclar ativos.",
      "Liquidez corrente suficiente para as amortizações de curto prazo.",
      "Desconto relevante sobre o valor patrimonial, que pode se tornar oportunidade com margem adicional."
    ],
    "weaknesses": [
      "Alavancagem ampla superior à medida restrita normalmente destacada.",
      "Distribuição recente acima da renda recorrente normalizada.",
      "Pipeline grande, complexo e parcialmente condicionado à 13ª emissão.",
      "Possível pressão vendedora das cotas utilizadas para compensar vendedores.",
      "Riscos de governança e custos em estruturas e veículos relacionados.",
      "Valor patrimonial dependente de avaliações nível 3 e premissas de cap rate."
    ],
    "conditions_to_invest": [
      "Preço de R$ 72 ou menos, mantendo renda, vacância e qualidade do portfólio.",
      "Alavancagem líquida ampla convergindo para 25% ou menos.",
      "Cobertura recorrente da distribuição próxima ou superior a 0,95 vez por pelo menos três meses.",
      "Conclusão da 13ª emissão e das compensações sem necessidade de dívida cara ou venda forçada.",
      "Integração das aquisições condicionais sem atraso ou deterioração relevante do retorno."
    ],
    "limitations": [
      "Contratos integrais, laudos individuais completos, apólices e diligências privadas não são documentos públicos.",
      "As probabilidades dos cenários representam julgamento analítico, não frequência estatística observada.",
      "Operações ainda condicionais podem mudar após a data de corte de 31/08/2026.",
      "A avaliação precisa ser atualizada após o encerramento da 13ª emissão e novos relatórios gerenciais."
    ]
  }
  $report$::jsonb,
  updated_at = now()
from public.instruments i
where ar.instrument_id = i.id
  and i.ticker = 'TRXF11'
  and ar.version = (
    select max(latest.version) from public.analysis_runs latest where latest.instrument_id = i.id
  );

comment on column public.analysis_runs.final_report is
  'Síntese qualitativa final obrigatória: contexto, interpretação, forças, fragilidades, decisão e limitações.';

alter view public.v_analysis_readiness set (security_invoker = true);

notify pgrst, 'reload schema';
commit;
