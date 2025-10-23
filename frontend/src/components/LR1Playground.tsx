import React, { useMemo, useState } from "react";
import { buildOnServer, downloadAutomatonPNG, fetchAutomaton, parseOnServer } from "../lib/parseApi";
import VisualHeaderMinimal from "./VisualHeader";


/**
 * LR(1) Parser Playground – Single-file React UI
 * - Paste a grammar (one production per line)
 * - Define Nonterminals, Terminals, Start symbol
 * - Build LR(1) automaton, ACTION/GOTO tables
 * - Try parsing an input string and see the steps
 *
 * Styling: Tailwind (no extra imports needed). Uses modern, clean UI.
 */

type Symbol = string;

const EPS = "ε"; // epsilon
const END = "$"; // end marker

// Production A -> right
interface Production {
  left: Symbol;
  right: Symbol[]; // use array here; serialize to tuples when hashing
}

// LR(1) Item: A -> α · β , look
interface LR1Item {
  left: Symbol;
  right: Symbol[];
  dot: number;
  look: Symbol;
}

// Utility – stable string keys for sets/maps of items and states
const itemKey = (it: LR1Item) => `${it.left}→${it.right.join(" ")}|${it.dot}|${it.look}`;
const stateKey = (I: Set<string>) => Array.from(I).sort().join("\n");

// Grammar container
interface Grammar {
  N: Set<Symbol>; // nonterminals
  T: Set<Symbol>; // terminals
  S: Symbol;      // start
  prods: Map<Symbol, Production[]>; // B -> [B->γ]
}

// ACTION entries: shift j | reduce prod | accept
// Represent as discriminated union
 type ActionEntry =
   | { kind: "shift"; to: number }
   | { kind: "reduce"; prod: Production }
   | { kind: "accept" };

// Parse a grammar spec from user inputs
function parseGrammar(rawRules: string, rawN: string, rawT: string, S: string): Grammar {
  const N = new Set(rawN.split(/\s+|,|;/).map(s => s.trim()).filter(Boolean));
  const T = new Set(rawT.split(/\s+|,|;/).map(s => s.trim()).filter(Boolean));
  const prods = new Map<Symbol, Production[]>();

  const lines = rawRules
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith("#"));

  for (const line of lines) {
    const pos = line.indexOf("->");
    if (pos === -1) continue;
    const A = line.slice(0, pos).trim();
    const rhs = line.slice(pos + 2).trim();
    for (const alt of rhs.split("|").map(s => s.trim())) {
      const syms = alt ? alt.split(/\s+/).map(x => x.trim()).filter(Boolean) : [];
      const right = syms.filter(s => s !== EPS);
      const p: Production = { left: A, right };
      if (!prods.has(A)) prods.set(A, []);
      prods.get(A)!.push(p);
    }
  }

  return { N, T, S, prods };
}

// Compute FIRST sets (terminals only + EPS)
function firstSeq(grammar: Grammar, seq: Symbol[]): Set<Symbol> {
  // returns FIRST(seq) as set of terminals plus possibly EPS
  const { N, T, prods } = grammar;
  const FIRST = new Map<Symbol, Set<Symbol>>();

  // init FIRST(X)
  const getFIRST = (X: Symbol): Set<Symbol> => {
    if (!FIRST.has(X)) FIRST.set(X, new Set());
    return FIRST.get(X)!;
  };

  // terminals
  for (const t of T) getFIRST(t).add(t);
  getFIRST(EPS).add(EPS);

  // nonterminals iterative
  let changed = true;
  while (changed) {
    changed = false;
    for (const [A, list] of prods) {
      for (const p of list) {
        // A -> α
        if (p.right.length === 0) {
          if (!getFIRST(A).has(EPS)) { getFIRST(A).add(EPS); changed = true; }
          continue;
        }
        let allNullable = true;
        for (const X of p.right) {
          for (const a of getFIRST(X)) {
            if (a !== EPS && !getFIRST(A).has(a)) { getFIRST(A).add(a); changed = true; }
          }
          if (!getFIRST(X).has(EPS)) { allNullable = false; break; }
        }
        if (allNullable) {
          if (!getFIRST(A).has(EPS)) { getFIRST(A).add(EPS); changed = true; }
        }
      }
    }
  }

  // Now compute FIRST(seq)
  const out = new Set<Symbol>();
  let nullablePrefix = true;
  for (const X of seq) {
    const FX = getFIRST(X);
    for (const a of FX) if (a !== EPS) out.add(a);
    if (!FX.has(EPS)) { nullablePrefix = false; break; }
  }
  if (nullablePrefix) out.add(EPS);
  return out;
}

function nextSymbol(it: LR1Item): Symbol | null {
  return it.dot < it.right.length ? it.right[it.dot] : null;
}

function advance(it: LR1Item): LR1Item {
  return { ...it, dot: it.dot + 1 };
}

function closure(grammar: Grammar, I: Set<string>): Set<string> {
  const { N, prods } = grammar;
  const C = new Set(I);
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of Array.from(C)) {
      // decode item
      const [leftPart, rest] = key.split("→");
      const [rightPart, dotStr, look] = rest.split("|");
      const right = rightPart.length ? rightPart.split(" ") : [];
      const dot = parseInt(dotStr, 10);
      const it: LR1Item = { left: leftPart, right, dot, look };

      const B = nextSymbol(it);
      if (B && N.has(B)) {
        const beta = it.right.slice(it.dot + 1);
        const lookSeq = beta.concat([it.look]);
        const la = firstSeq(grammar, lookSeq);
        const prodsB = prods.get(B) || [];
        for (const p of prodsB) {
          for (const b of la) {
            const look2 = b === EPS ? it.look : b;
            const newItem: LR1Item = { left: B, right: p.right, dot: 0, look: look2 };
            const k = itemKey(newItem);
            if (!C.has(k)) { C.add(k); changed = true; }
          }
        }
      }
    }
  }
  return C;
}

function gotoState(grammar: Grammar, I: Set<string>, X: Symbol): Set<string> {
  const moved = new Set<string>();
  for (const k of I) {
    const [leftPart, rest] = k.split("→");
    const [rightPart, dotStr, look] = rest.split("|");
    const right = rightPart.length ? rightPart.split(" ") : [];
    const dot = parseInt(dotStr, 10);
    const it: LR1Item = { left: leftPart, right, dot, look };
    if (nextSymbol(it) === X) moved.add(itemKey(advance(it)));
  }
  return moved.size ? closure(grammar, moved) : new Set();
}

function augmentStart(S: Symbol): Symbol { return `${S}'`; }

function buildAutomaton(grammarInput: Grammar) {
  // Copy grammar and augment S' -> S
  const S_ = augmentStart(grammarInput.S);
  const prods = new Map(grammarInput.prods);
  const N = new Set(grammarInput.N);
  N.add(S_);
  const T = new Set(grammarInput.T);
  const startProd: Production = { left: S_, right: [grammarInput.S] };
  if (!prods.has(S_)) prods.set(S_, []);
  prods.get(S_)!.unshift(startProd);
  const grammar: Grammar = { N, T, S: grammarInput.S, prods };

  const I0 = closure(grammar, new Set([itemKey({ left: S_, right: [grammar.S], dot: 0, look: END })]));
  const states: Set<string>[] = [I0];
  const trans = new Map<string, number>(); // key: `${i}::${X}` -> j
  const work: Set<string>[] = [I0];

  while (work.length) {
    const I = work.pop()!;
    const i = states.findIndex(s => stateKey(s) === stateKey(I));
    // Collect symbols after dot
    const symSet = new Set<Symbol>();
    for (const k of I) {
      const [_, rest] = k.split("→");
      const [rightPart, dotStr] = rest.split("|");
      const right = rightPart.length ? rightPart.split(" ") : [];
      const dot = parseInt(dotStr, 10);
      const sym = dot < right.length ? right[dot] : null;
      if (sym) symSet.add(sym);
    }

    for (const X of symSet) {
      const J = gotoState(grammar, I, X);
      if (J.size === 0) continue;
      const key = stateKey(J);
      let j = states.findIndex(s => stateKey(s) === key);
      if (j === -1) {
        states.push(J);
        work.push(J);
        j = states.length - 1;
      }
      trans.set(`${i}::${X}`, j);
    }
  }
  return { grammar, S_, states, trans };
}

function buildTables(automaton: ReturnType<typeof buildAutomaton>) {
  const { grammar, S_, states, trans } = automaton;
  const ACTION = new Map<string, ActionEntry>(); // key: `${i}::${a}`
  const GOTO = new Map<string, number>();       // key: `${i}::${A}`

  const isTerminal = (x: Symbol) => grammar.T.has(x) || x === END;

  for (let i = 0; i < states.length; i++) {
    const I = states[i];
    for (const k of I) {
      const [leftPart, rest] = k.split("→");
      const [rightPart, dotStr, look] = rest.split("|");
      const right = rightPart.length ? rightPart.split(" ") : [];
      const dot = parseInt(dotStr, 10);
      const a = dot < right.length ? right[dot] : null;

      if (a && grammar.T.has(a)) {
        // shift
        const j = trans.get(`${i}::${a}`);
        if (j !== undefined) setAction(ACTION, i, a, { kind: "shift", to: j });
      } else if (a === null) {
        if (leftPart === S_ && look === END) {
          setAction(ACTION, i, END, { kind: "accept" });
        } else {
          setAction(ACTION, i, look, { kind: "reduce", prod: { left: leftPart, right } });
        }
      }
    }

    // GOTO for nonterminals
    for (const A of grammar.N) {
      const j = trans.get(`${i}::${A}`);
      if (j !== undefined) GOTO.set(`${i}::${A}`, j);
    }
  }

  return { ACTION, GOTO };
}

function setAction(ACTION: Map<string, ActionEntry>, i: number, a: Symbol, entry: ActionEntry) {
  const key = `${i}::${a}`;
  const prev = ACTION.get(key);
  if (!prev) { ACTION.set(key, entry); return; }
  // Resolve identical entries silently
  if (JSON.stringify(prev) === JSON.stringify(entry)) return;
  // Conflict – keep both info in error entry? For simplicity, throw.
  throw new Error(`LR conflict at state ${i} on '${a}': ${fmtAction(prev)} vs ${fmtAction(entry)}`);
}

// Simple LR(1) parse simulation
function parseInput(
  grammar: Grammar,
  ACTION: Map<string, ActionEntry>,
  GOTO: Map<string, number>,
  input: string
) {
  const tokens = input.split(/\s+/).filter(Boolean).concat([END]);
  const stackStates: number[] = [0];
  const stackSymbols: Symbol[] = [];
  const steps: { stack: string; input: string; action: string }[] = [];

  let ip = 0;
  while (true) {
    const s = stackStates[stackStates.length - 1];
    const a = tokens[ip] ?? END;
    const act = ACTION.get(`${s}::${a}`);
    steps.push({
      stack: `[${stackStates.join(", ")}] ${stackSymbols.join(" ")}`.trim(),
      input: tokens.slice(ip).join(" "),
      action: act ? fmtAction(act) : "error"
    });

    if (!act) throw new Error(`Parse error at token '${a}' in state ${s}`);

    if (act.kind === "shift") {
      stackSymbols.push(a);
      stackStates.push(act.to);
      ip += 1;
    } else if (act.kind === "reduce") {
      const { left, right } = act.prod;
      for (let k = 0; k < right.length; k++) {
        stackSymbols.pop();
        stackStates.pop();
      }
      const t = stackStates[stackStates.length - 1];
      const j = GOTO.get(`${t}::${left}`);
      if (j === undefined) throw new Error(`GOTO missing from state ${t} on ${left}`);
      stackSymbols.push(left);
      stackStates.push(j);
    } else if (act.kind === "accept") {
      steps.push({ stack: `[${stackStates.join(", ")}] ${stackSymbols.join(" ")}`.trim(), input: "", action: "accept" });
      break;
    }
  }
  return steps;
}

function fmtAction(a: ActionEntry): string {
  if (a.kind === "shift") return `shift ${a.to}`;
  if (a.kind === "reduce") return `reduce ${a.prod.left} → ${a.prod.right.join(" ") || EPS}`;
  return "accept";
}

// Example default grammar
const DEFAULT_RULES = `# Grammar: classic expression grammar
E -> E + T | T
T -> T * F | F
F -> ( E ) | id`;

const DEFAULT_N = "E T F";
const DEFAULT_T = "+ * ( ) id";
const DEFAULT_S = "E";
const DEFAULT_INPUT = "id + id * id";

export default function LR1Playground() {
  const [rules, setRules] = useState(DEFAULT_RULES);
  
  const [start, setStart] = useState(DEFAULT_S);
  const [input, setInput] = useState(DEFAULT_INPUT);

  const [auto, setAuto] = useState<ReturnType<typeof buildAutomaton> | null>(null);
  const [tables, setTables] = useState<ReturnType<typeof buildTables> | null>(null);
  const [steps, setSteps] = useState<{ stack: string; input: string; action: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [serverNonTerminals, setServerNonTerminals] = useState<string[] | null>(null);
  const [serverFirsts, setServerFirsts] = useState<Record<string, string[]> | null>(null);
  const [serverStart, setServerStart] = useState<string | null>(null);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<"svg" | "png" | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const [previewDetail, setPreviewDetail] = useState<"simple"|"items">("simple");
  const prodRows = useMemo(() => buildProdIndexFromTables(tables), [tables]);


  type ProdKey = string;
  type ProdRow = { id: number; left: string; right: string[] };

  function buildProdIndexFromTables(tables: ReturnType<typeof buildTables> | null): ProdRow[] {
    if (!tables) return [];
    // recolecta todas las reducciones presentes en ACTION
    const set = new Map<ProdKey, { left: string; right: string[] }>();
    for (const v of tables.ACTION.values()) {
      if (v.kind === "reduce") {
        const key = `${v.prod.left}→${v.prod.right.join(" ")}`;
        if (!set.has(key)) set.set(key, { left: v.prod.left, right: v.prod.right });
      }
    }
    // asigna índices r1, r2, ... en orden estable
    const rows: ProdRow[] = [];
    let idx = 1;
    for (const { left, right } of set.values()) {
      rows.push({ id: idx++, left, right });
    }
    return rows;
  }

  async function openPreview(kind: "svg"|"png", detail: "simple"|"items") {
    try {
      setIsLoadingPreview(true);
      const blob = await fetchAutomaton(kind, rules, detail);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewKind(kind);
      setPreviewDetail(detail);
      setIsPreviewOpen(true);
    } catch (e:any) {
      setError(e.message || String(e));
    } finally {
      setIsLoadingPreview(false);
    }
  }



  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewKind(null);
    setIsPreviewOpen(false);
  }

  function downloadPreview() {
    if (!previewUrl || !previewKind) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `lr1_automaton.${previewKind}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Nota: no revocamos aquí el URL para que el navegador pueda leerlo;
    // se revoca al cerrar el modal.
  }
    

  const buildAll = async () => {
    try {
      const payload = await buildOnServer(rules);

      const states = payload.states.map((arr: string[]) => new Set(arr));
      const trans = new Map(Object.entries(payload.transitions));
      const ACTION = new Map(Object.entries(payload.action));
      const GOTO = new Map(Object.entries(payload.goto));

      setAuto({ grammar: null as any, S_: start + "'", states, trans } as any);
      setTables({ ACTION, GOTO } as any);

      setServerStart(payload.initialSymbol ?? null);   
      setServerNonTerminals(payload.nonTerminals || null);
      setServerFirsts(payload.firsts || null);

      setSteps(null);
      setError(null);
    } catch (e: any) {
      setError(e.message || String(e));
    }
  };

  const runParse = async () => {
    try {
      const { steps } = await parseOnServer(input, rules);
      setSteps(steps);
      setError(null);
    } catch (e: any) {
      setError("Cadena incorrecta");
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <VisualHeaderMinimal
        EPS={EPS}
        END={END}
        repoUrl="https://github.com/nayeli-guzman/parser-LR1"
      />

      <main className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: grammar inputs */}
        <section className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="text-lg font-medium mb-2">Gramática</h2>
            <label className="block text-sm font-medium mb-1">Producciones (una por línea)</label>
            <textarea
              className="w-full rounded-xl border p-2 font-mono text-sm h-40"
              value={rules}
              onChange={e => setRules(e.target.value)}
            />
            <div className="bg-white rounded-2xl shadow p-4 mt-3">
              <h3 className="text-base font-medium mb-2">FIRST Table</h3>

              {!serverFirsts ? (
                <p className="text-sm text-gray-500">
                  Construye la gramática para ver la tabla FIRST.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border border-gray-300 rounded">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-3 py-2 text-left font-semibold border-b">Nonterminal</th>
                        <th className="px-3 py-2 text-left font-semibold border-b">FIRST</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(serverFirsts)
                        .sort((a, b) => a.localeCompare(b)) // orden estable
                        .map((A) => (
                          <tr key={A} className="border-b last:border-0">
                            <td className="px-3 py-2 font-mono">{A}</td>
                            <td className="px-3 py-2 font-mono">
                              {"{ "}{serverFirsts[A].join(", ")}{" }"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* (Opcional) Muestra la lista de No terminales recibidos */}
              {serverNonTerminals && (
                <div className="mt-3">
                  <div className="text-sm text-gray-500 mb-1">No terminales detectados:</div>
                  <div className="flex flex-wrap gap-2">
                    {serverNonTerminals.map((nt) => (
                      <span key={nt} className="px-2 py-1 text-xs rounded-full bg-gray-100 border">
                        {nt}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <div>
                <label className="block text-sm font-medium mb-1">Símbolo inicial</label>
                <div className="w-full rounded-xl border px-3 py-2 text-sm bg-gray-50">
                  <span className="inline-flex items-center px-2 py-1 rounded-full border text-xs">
                    {serverStart ?? "—"}
                  </span>
                </div>
              </div>

              <div className="flex items-end justify-end">
<button
  onClick={buildAll}
  className="w-full rounded-xl px-4 py-2.5 text-sm font-medium
             bg-neutral-900 text-white shadow-sm
             transform-gpu transition-transform duration-150 ease-out
             hover:scale-105 active:scale-95 hover:shadow-md
             focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900"
>
  Construir LR(1)
</button>
              </div>
            </div>
            {error && (
              <div className="mt-3 text-sm text-red-600 whitespace-pre-wrap">{error}</div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="text-lg font-medium mb-2">Entrada a parsear</h2>
            <input className="w-full rounded-xl border p-2 text-sm" value={input} onChange={e => setInput(e.target.value)} />
            <button onClick={runParse} className="mt-3 rounded-xl px-3 py-2 bg-indigo-600 text-white text-sm shadow hover:opacity-90 w-full">Ejecutar parse</button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
  <div className="flex items-center justify-between mb-2">
    <h2 className="text-lg font-medium">Producciones (ids)</h2>
  </div>

  {!prodRows.length ? (
    <p className="text-sm text-gray-500">Construye LR(1) para ver las producciones.</p>
  ) : (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2 pr-4">ID</th>
            <th className="py-2">Producción</th>
          </tr>
        </thead>
        <tbody>
          {prodRows.map((p) => (
            <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50/50">
              <td className="py-1 pr-4 font-semibold">r{p.id}</td>
              <td className="py-1 font-mono">
                {p.left} → {p.right.length ? p.right.join(" ") : "ε"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>

        </section>

        {/* Right: automaton & tables */}
        <section className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="text-lg font-medium mb-3 flex items-center justify-between">
  <span>Estados LR(1)</span>
  <div className="flex items-center gap-2">
    <button
      onClick={() => openPreview("png", "simple")}
      className="px-3 py-1 rounded-lg border text-sm hover:bg-gray-50"
      title="Vista previa PNG (simple)"
    >
      AFD simple
    </button>
    <button
      onClick={() => openPreview("png", "items")}
      className="px-3 py-1 rounded-lg border text-sm hover:bg-gray-50"
      title="Vista previa PNG (con ítems)"
    >
      AFD
    </button>
    <button
      onClick={() => openPreview("png", "nfa")}
      className="px-3 py-1 rounded-lg border text-sm hover:bg-gray-50 text-indigo-600"
      title="Vista previa AFN de ítems LR(1)"
    >
      AFN
    </button>
  </div>
</h2>




            {!auto ? (
              <p className="text-sm text-gray-500">Construye el autómata para ver los estados.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-auto pr-2">
                {auto.states.map((I, idx) => (
                  <details key={idx} className="border rounded-xl p-3">
                    <summary className="cursor-pointer select-none flex items-center justify-between">
                      <span className="font-medium">I{idx}</span>
                      <span className="text-xs text-gray-500">{Array.from(I).length} ítems</span>
                    </summary>

                    {/* Ítems del estado */}
                    <div className="mt-2 font-mono text-xs whitespace-pre">
                      {Array.from(I).sort().join("\n")}
                    </div>

                    {/* Transiciones salientes de este estado */}
                    <div className="mt-3 text-xs">
                      <div className="font-semibold mb-1">Transiciones</div>
                      <div className="flex flex-wrap gap-2">
                        {Array.from(auto.trans.entries())
                          .filter(([k]) => k.startsWith(`${idx}::`))
                          .sort((a, b) => {
                            const AX = a[0].split("::")[1];
                            const BX = b[0].split("::")[1];
                            return AX.localeCompare(BX);
                          })
                          .map(([k, j]) => {
                            const X = k.split("::")[1];
                            // Detectar tipo por presencia en ACTION/GOTO
                            const isAction = tables?.ACTION?.has?.(`${idx}::${X}`);
                            const isGoto   = tables?.GOTO?.has?.(`${idx}::${X}`);
                            const kind = isAction ? "ACTION" : isGoto ? "GOTO" : "—";
                            const chipClass =
                              isAction
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : isGoto
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-gray-50 text-gray-600 border-gray-200";
                            return (
                              <span key={k} className={`px-2 py-1 rounded-full border ${chipClass}`}>
                                {X} → {j} <span className="opacity-70">({kind})</span>
                              </span>
                            );
                          })}
                        {/* Si no hay transiciones */}
                        {Array.from(auto.trans.keys()).every(k => !k.startsWith(`${idx}::`)) && (
                          <span className="text-gray-500">—</span>
                        )}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>

          {/* Modal de vista previa del autómata */}
          {isPreviewOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
              onClick={closePreview}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="bg-white rounded-2xl shadow-xl w-[95vw] max-w-5xl max-h-[85vh] overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b px-4 py-2">
            <div className="text-sm text-gray-600">
              Vista previa del autómata ({previewKind?.toUpperCase()} • {previewDetail})
            </div>
            <div className="flex gap-2">
              <button
                onClick={downloadPreview}
                className="px-3 py-1 rounded-lg border text-sm hover:bg-gray-50"
              >
                Descargar
              </button>
              <button onClick={closePreview} className="px-3 py-1 rounded-lg border text-sm hover:bg-gray-50">
                Cerrar
              </button>
            </div>
          </div>


                <div className="p-3 bg-gray-50">
                  {previewUrl ? (
                    <div className="w-full h-[70vh] overflow-auto grid place-items-center">
                      {/* <img> soporta SVG y PNG */}
                      <img
                        src={previewUrl}
                        alt="LR(1) automaton preview"
                        className="max-w-full h-auto"
                        style={{ imageRendering: "crisp-edges" }}
                      />
                    </div>
                  ) : (
                    <div className="h-[70vh] grid place-items-center text-sm text-gray-500">
                      Generando…
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {/* === LR table (matriz) === */}
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="text-lg font-medium mb-3">LR table</h2>

            {!tables || !auto ? (
              <p className="text-sm text-gray-500">Construye para ver la tabla LR.</p>
            ) : (
              (() => {
                // --- Derivar columnas ---
                // Terminals (ACTION)
                const termSet = new Set<string>();
                for (const k of tables.ACTION.keys()) {
                  const [, a] = k.split("::");
                  termSet.add(a);
                }
                // Asegura $ al final si existe
                const terms = Array.from(termSet).sort((a, b) => {
                  if (a === "$") return 1;
                  if (b === "$") return -1;
                  return a.localeCompare(b);
                });

                // Nonterminals (GOTO)
                const ntSet = new Set<string>();
                for (const k of tables.GOTO.keys()) {
                  const [, A] = k.split("::");
                  ntSet.add(A);
                }
                // No mostrar S' si aparece
                const nonterms = Array.from(ntSet).filter(A => !A.endsWith("'")).sort();

                // --- Estados (filas) ---
                const rowCount = auto.states.length; // ya lo tienes

                // --- Índices de producción para "r#" (opcionales, para que luzca como tu screenshot) ---
                type ProdKey = string;
                const prodIndex = new Map<ProdKey, number>();
                let nextIdx = 1;
                for (const v of tables.ACTION.values()) {
                  if (v.kind === "reduce") {
                    const pk = `${v.prod.left}→${v.prod.right.join(" ")}`;
                    if (!prodIndex.has(pk)) prodIndex.set(pk, nextIdx++);
                  }
                }

                const fmtCell = (i: number, sym: string): string | JSX.Element => {
                  const act = tables.ACTION.get(`${i}::${sym}`);
                  if (!act) return "";
                  if (act.kind === "shift") {
                    return <span className="text-blue-600 font-semibold">s{act.to}</span>;
                  }
                  if (act.kind === "reduce") {
                    const pk = `${act.prod.left}→${act.prod.right.join(" ")}`;
                    const idx = prodIndex.get(pk) ?? "";
                    return <span className="text-green-700 font-semibold">r{idx}</span>;
                  }
                  return <span className="text-green-700 font-semibold">acc</span>;
                };

                const fmtGoto = (i: number, A: string): string => {
                  const j = tables.GOTO.get(`${i}::${A}`);
                  return j === undefined ? "" : String(j);
                };

                return (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border border-gray-400">
                      <thead>
                        <tr>
                          <th className="border border-gray-400 px-2 py-1 align-middle" rowSpan={2}>State</th>
                          <th className="border border-gray-400 px-2 py-1 text-center" colSpan={terms.length}>ACTION</th>
                          <th className="border border-gray-400 px-2 py-1 text-center" colSpan={nonterms.length}>GOTO</th>
                        </tr>
                        <tr>
                          {terms.map(t => (
                            <th key={`a-${t}`} className="border border-gray-400 px-2 py-1 font-semibold">{t}</th>
                          ))}
                          {nonterms.map(A => (
                            <th key={`g-${A}`} className="border border-gray-400 px-2 py-1 font-semibold">{A}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: rowCount }).map((_, i) => (
                          <tr key={i}>
                            <td className="border border-gray-400 px-2 py-1 font-semibold">{i}</td>
                            {terms.map(t => (
                              <td key={`c-${i}-${t}`} className="border border-gray-400 px-2 py-1 text-center">
                                {fmtCell(i, t)}
                              </td>
                            ))}
                            {nonterms.map(A => (
                              <td key={`g-${i}-${A}`} className="border border-gray-400 px-2 py-1 text-center">
                                {fmtGoto(i, A)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()
            )}
          </div>


          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="text-lg font-medium mb-3">Trazas del análisis</h2>
            {!steps ? (
              <p className="text-sm text-gray-500">Ejecuta el parser para ver las transiciones de la pila.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-4">Pila (estados, símbolos)</th>
                      <th className="py-2 pr-4">Entrada</th>
                      <th className="py-2">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {steps.map((s, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="py-1 pr-4 font-mono whitespace-pre">{s.stack}</td>
                        <td className="py-1 pr-4 font-mono">{s.input}</td>
                        <td className="py-1">{s.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="max-w-6xl mx-auto p-4 text-xs text-gray-500">
        <p>
          Tip: separa tokens por espacios en la entrada. Puedes usar {EPS} en producciones para ε.
        </p>
      </footer>
    </div>
  );
}
