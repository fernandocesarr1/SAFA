/**
 * Liga o papel negociado na B3 ao fundo registrado na CVM.
 *
 * O cruzamento ingênuo — ISIN da última cotação contra `Codigo_ISIN` do
 * informe — perde 133 dos 594 papéis, e a medição mostrou que não é um
 * problema só, são três:
 *
 * 1. **44 não são fundo.** São direitos de subscrição e recibos, que a B3
 *    classifica no mesmo BDI 12 das cotas. Não têm cadastro porque não são
 *    fundo; tratá-los como fundo sem cadastro é erro de classificação.
 * 2. **22 são o mesmo fundo com outro sufixo de ISIN.** O sufixo numera a
 *    emissão; o prefixo identifica o emissor.
 * 3. **67 têm ISIN divergente entre as duas fontes.** Quando o fundo troca de
 *    mnemônico, a B3 passa a publicar o ISIN novo e a CVM mantém o do
 *    registro original. O BTCI11 negocia como `BRBTCICTF005` e está no informe
 *    como `BRFEXCCTF007`, sob o nome antigo — FEXC11 era o ticker anterior.
 *
 * O ISIN, que deveria ser identificador global, não é chave confiável entre
 * estas duas fontes. Por isso o vínculo é tentado em degraus, e **o degrau
 * usado fica registrado**: casar por nome não vale o mesmo que casar por ISIN,
 * e quem lê o resultado precisa poder saber a diferença (`AGENTS.md` §11).
 *
 * Nenhum degrau escolhe entre candidatos. Havendo mais de um, o vínculo falha
 * declarando a ambiguidade — inventar desempate aqui produziria fundamento de
 * um fundo colado no preço de outro, que é o pior defeito possível nesta
 * etapa.
 */

import type { CadastroFundo } from "../coleta/cvm/parser.ts";

/** Como o vínculo foi estabelecido, em ordem decrescente de confiança. */
export type MetodoVinculo = "isin_exato" | "isin_prefixo" | "nome_resumido";

/**
 * Quanto o vínculo se sustenta.
 *
 * `confirmado` — duas chaves independentes concordam, ou o ISIN bate exato.
 * `a_confirmar` — o vínculo é o melhor disponível, mas repousa em heurística.
 *
 * A distinção existe porque a medição sobre o mercado inteiro produziu casos
 * que não se resolvem daqui: o FATN11 negocia com o nome resumido "FII ATHENA
 * I" e o prefixo do ISIN leva ao "BRC RENDA CORPORATIVA FII". Pode ser troca
 * de gestor, pode ser mnemônico reaproveitado pela B3. Escolher um dos dois
 * seria fabricar certeza; o que o SAFA faz nesse caso é seguir com o vínculo
 * mais provável e **declarar que falta confirmar** — quem consome decide se
 * isso basta. Fundo `a_confirmar` não entra na lista principal.
 */
export type ConfiancaVinculo = "confirmado" | "a_confirmar";

export type Vinculo =
  | {
      vinculado: true;
      cadastro: CadastroFundo;
      metodo: MetodoVinculo;
      confianca: ConfiancaVinculo;
      nota: string | null;
    }
  | { vinculado: false; motivo: string };

/**
 * O que o papel é. A B3 publica cotas, direitos de subscrição e recibos sob o
 * mesmo código BDI, e só o ISIN os distingue.
 */
export type ClassePapel = "cota" | "direito";

/**
 * ISIN de direito de subscrição ou recibo: `BR` + 4 do emissor + `D` + 2 + `M`
 * + 2. A cota traz `CTF` no lugar. Lido dos arquivos reais de 2023 a 2026.
 */
const ISIN_DIREITO = /^BR[A-Z0-9]{4}D\d{2}M\d{2}$/;

export function classificarPapel(isins: readonly string[]): ClassePapel {
  const validos = isins.map(normalizarIsin).filter((i) => i !== "");
  if (validos.length === 0) return "cota";
  return validos.every((i) => ISIN_DIREITO.test(i)) ? "direito" : "cota";
}

/**
 * Forma do ISIN: 2 letras de país + 9 alfanuméricos + dígito verificador.
 *
 * A checagem não é purismo. A CVM grava lixo nessa coluna: além de `"0"` no
 * lugar de vazio, o CNPJ 18.308.516/0001-63 aparece em 2023-01 com
 * `Codigo_ISIN = "XPTH12"` — que é um **ticker**, não um ISIN. Sem validar a
 * forma, esse valor viraria chave de índice e casaria com qualquer papel que
 * trouxesse a mesma string.
 */
const FORMA_ISIN = /^[A-Z]{2}[A-Z0-9]{9}\d$/;

export function normalizarIsin(isin: string): string {
  const n = isin.trim().toUpperCase();
  return FORMA_ISIN.test(n) ? n : "";
}

/** `BR` + emissor + tipo de papel. O que sobra do ISIN numera a emissão. */
const TAMANHO_PREFIXO = 9;

function prefixoIsin(isin: string): string {
  const n = normalizarIsin(isin);
  return n.length >= TAMANHO_PREFIXO ? n.slice(0, TAMANHO_PREFIXO) : "";
}

const ACENTOS = /[̀-ͯ]/g;

/**
 * Palavras que todo fundo tem e que portanto não distinguem nenhum. Sem
 * removê-las, "FUNDO DE INVESTIMENTO IMOBILIÁRIO" casaria com o mercado
 * inteiro.
 */
const GENERICAS = new Set([
  "FII", "FDO", "FUNDO", "FUNDOS", "INVESTIMENTO", "INVESTIMENTOS",
  "IMOBILIARIO", "IMOBILIARIA", "IMOB", "RESPONSABILIDADE", "LIMITADA",
  "RESP", "LTDA", "RL", "DE", "DA", "DO", "DOS", "DAS", "E", "II", "III",
  "CLASSE", "UNICA", "A", "B",
]);

export function tokensNome(nome: string): string[] {
  return nome
    .normalize("NFD")
    .replace(ACENTOS, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((t) => t !== "" && !GENERICAS.has(t));
}

/**
 * `abrev` é abreviação de `inteiro`?
 *
 * O nome resumido da B3 tem 12 posições e come vogais: "BTG CRD IMOB" para
 * "BTG CRÉDITO IMOBILIÁRIO". Prefixo não resolve — "CRD" não começa
 * "CREDITO" —, mas subsequência sim: C, R e D aparecem nessa ordem.
 */
function ehAbreviacao(abrev: string, inteiro: string): boolean {
  if (abrev.length > inteiro.length) return false;
  if (abrev[0] !== inteiro[0]) return false; // abreviação preserva a inicial
  let i = 0;
  for (const c of inteiro) {
    if (c === abrev[i]) i += 1;
    if (i === abrev.length) return true;
  }
  return false;
}

/**
 * Mínimo de palavras distintivas que precisam casar. Com uma só, "BTG" casaria
 * com qualquer fundo da casa, e há dezenas.
 */
const TOKENS_MINIMOS = 2;

export function nomeCompativel(resumidoB3: string, nomeCvm: string): boolean {
  const curto = tokensNome(resumidoB3);
  const longo = tokensNome(nomeCvm);
  if (curto.length < TOKENS_MINIMOS) return false;

  let cursor = 0;
  let casados = 0;
  for (const t of curto) {
    let achou = -1;
    for (let j = cursor; j < longo.length; j += 1) {
      if (ehAbreviacao(t, longo[j])) {
        achou = j;
        break;
      }
    }
    if (achou === -1) return false; // ordem preservada: nada casa fora de ordem
    cursor = achou + 1;
    casados += 1;
  }
  return casados >= TOKENS_MINIMOS;
}

/**
 * O nome da B3 **apoia** o vínculo já estabelecido por ISIN?
 *
 * Teste deliberadamente frouxo — uma palavra distintiva basta. Ele nunca
 * estabelece vínculo nenhum: só decide se um vínculo obtido por ISIN pode ser
 * dado como confirmado ou fica pendente de conferência. Frouxo de propósito,
 * porque o nome resumido tem 12 posições e mutila demais para servir de prova
 * contrária sozinho.
 */
export function nomeCorrobora(resumidoB3: string, nomeCvm: string): boolean {
  const curto = tokensNome(resumidoB3);
  const longo = tokensNome(nomeCvm);
  if (curto.length === 0 || longo.length === 0) return false;
  return curto.some((t) => longo.some((l) => ehAbreviacao(t, l)));
}

export type IndiceCadastro = {
  porIsin: Map<string, CadastroFundo>;
  porPrefixo: Map<string, CadastroFundo[]>;
  todos: CadastroFundo[];
};

/** Fica o registro mais recente de cada fundo; o cadastro repete por mês. */
function maisRecente(a: CadastroFundo, b: CadastroFundo): CadastroFundo {
  return b.dataReferencia > a.dataReferencia ? b : a;
}

export function montarIndiceCadastro(
  cadastro: readonly CadastroFundo[],
): IndiceCadastro {
  const porCnpj = new Map<string, CadastroFundo>();
  for (const c of cadastro) {
    const at = porCnpj.get(c.cnpj);
    porCnpj.set(c.cnpj, at ? maisRecente(at, c) : c);
  }
  const todos = [...porCnpj.values()];

  // Indexa TODOS os ISINs já vistos para cada CNPJ, apontando para o registro
  // mais recente do fundo. Indexar só o ISIN do último registro perderia o
  // fundo que trocou de código dentro do próprio cadastro da CVM — e foi
  // exatamente o que aconteceu na primeira versão deste índice: quatro fundos
  // que cruzavam por ISIN exato deixaram de cruzar.
  const porIsin = new Map<string, CadastroFundo>();
  for (const c of cadastro) {
    const isin = normalizarIsin(c.isin);
    if (isin === "") continue;
    const atual = porCnpj.get(c.cnpj);
    if (atual) porIsin.set(isin, atual);
  }

  const porPrefixo = new Map<string, CadastroFundo[]>();
  const vistos = new Map<string, Set<string>>();
  for (const [isin, c] of porIsin) {
    const p = prefixoIsin(isin);
    if (p === "") continue;
    const cnpjs = vistos.get(p) ?? new Set<string>();
    if (cnpjs.has(c.cnpj)) continue; // um fundo conta uma vez por prefixo
    cnpjs.add(c.cnpj);
    vistos.set(p, cnpjs);
    const lista = porPrefixo.get(p);
    if (lista) lista.push(c);
    else porPrefixo.set(p, [c]);
  }

  return { porIsin, porPrefixo, todos };
}

export type EntradaVinculo = {
  /** Todos os ISINs vistos para o ticker, não só o da última cotação. */
  isins: readonly string[];
  /** Nome resumido da B3, 12 posições. */
  nomeResumido: string;
};

export function vincular(indice: IndiceCadastro, e: EntradaVinculo): Vinculo {
  const isins = e.isins.map(normalizarIsin).filter((i) => i !== "");

  for (const isin of isins) {
    const c = indice.porIsin.get(isin);
    if (c) {
      return {
        vinculado: true,
        cadastro: c,
        metodo: "isin_exato",
        confianca: "confirmado",
        nota: null,
      };
    }
  }

  for (const isin of isins) {
    const cands = indice.porPrefixo.get(prefixoIsin(isin)) ?? [];
    if (cands.length === 1) {
      const corrobora = nomeCorrobora(e.nomeResumido, cands[0].nome);
      const par = `ISIN da B3 ${isin} e da CVM ${normalizarIsin(cands[0].isin)}`;
      return {
        vinculado: true,
        cadastro: cands[0],
        metodo: "isin_prefixo",
        confianca: corrobora ? "confirmado" : "a_confirmar",
        nota: corrobora
          ? `${par}: mesmo emissor, emissão diferente`
          : `${par}: mesmo prefixo, mas o nome da B3 ("${e.nomeResumido.trim()}") ` +
            `não corrobora "${cands[0].nome.trim()}" — confirmar identidade`,
      };
    }
    if (cands.length > 1) {
      return {
        vinculado: false,
        motivo: `prefixo de ISIN ${prefixoIsin(isin)} corresponde a ${cands.length} fundos no cadastro; ambíguo`,
      };
    }
  }

  const porNome = indice.todos.filter((c) => nomeCompativel(e.nomeResumido, c.nome));
  if (porNome.length === 1) {
    return {
      vinculado: true,
      cadastro: porNome[0],
      metodo: "nome_resumido",
      confianca: "a_confirmar",
      nota:
        `vínculo por nome ("${e.nomeResumido.trim()}" ≈ "${porNome[0].nome.trim()}"), ` +
        `não por ISIN: a B3 publica ${isins[0] ?? "(sem ISIN)"} e a CVM ${normalizarIsin(porNome[0].isin) || "(sem ISIN)"}`,
    };
  }
  if (porNome.length > 1) {
    return {
      vinculado: false,
      motivo: `nome resumido "${e.nomeResumido.trim()}" casa com ${porNome.length} fundos do cadastro; ambíguo`,
    };
  }

  return {
    vinculado: false,
    motivo: `ISIN ${isins[0] || "(vazio)"} e nome "${e.nomeResumido.trim()}" sem correspondência no cadastro da CVM`,
  };
}
