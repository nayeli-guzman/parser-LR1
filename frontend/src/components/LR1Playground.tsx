import React, { useMemo, useState } from "react";
import { buildOnServer, parseOnServer } from "../lib/parseApi";


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
  const [nonterminals, setNonterminals] = useState(DEFAULT_N);
  const [terminals, setTerminals] = useState(DEFAULT_T);
  const [start, setStart] = useState(DEFAULT_S);
  const [input, setInput] = useState(DEFAULT_INPUT);

  const [auto, setAuto] = useState<ReturnType<typeof buildAutomaton> | null>(null);
  const [tables, setTables] = useState<ReturnType<typeof buildTables> | null>(null);
  const [steps, setSteps] = useState<{ stack: string; input: string; action: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [serverNonTerminals, setServerNonTerminals] = useState<string[] | null>(null);
  const [serverFirsts, setServerFirsts] = useState<Record<string, string[]> | null>(null);
  const [serverStart, setServerStart] = useState<string | null>(null);

  
  const grammar = useMemo(() => {
    try {
      return parseGrammar(rules, nonterminals, terminals, start);
    } catch (e: any) {
      return null;
    }
  }, [rules, nonterminals, terminals, start]);

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
      setError(e.message || String(e));
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold">LR(1) Parser Playground</h1>
          <div className="text-sm text-gray-500">ε = "{EPS}" • end = "{END}"</div>
        </div>
      </header>

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
              <h3 className="text-base font-medium mb-2">FIRST (desde backend)</h3>

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
                <button onClick={buildAll} className="rounded-xl px-3 py-2 bg-black text-white text-sm shadow hover:opacity-90 w-full">Construir LR(1)</button>
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
        </section>

        {/* Right: automaton & tables */}
        <section className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="text-lg font-medium mb-3">Estados LR(1)</h2>
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
                    <div className="mt-2 font-mono text-xs whitespace-pre">
                      {Array.from(I).sort().join("\n")}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="text-lg font-medium mb-3">Transiciones</h2>
            {!auto ? (
              <p className="text-sm text-gray-500">Construye el autómata para ver las transiciones.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-4">(i, X)</th>
                      <th className="py-2">j</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(auto.trans.entries()).map(([k, j]) => (
                      <tr key={k} className="border-b last:border-0">
                        <td className="py-1 pr-4 font-mono">{k}</td>
                        <td className="py-1">{j}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="text-lg font-medium mb-3">Tablas ACTION / GOTO</h2>
            {!tables ? (
              <p className="text-sm text-gray-500">Construye las tablas para ver ACTION y GOTO.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-2">ACTION</h3>
                  <div className="overflow-x-auto max-h-72 overflow-y-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left border-b">
                          <th className="py-2 pr-4">(i, a)</th>
                          <th className="py-2">acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from(tables.ACTION.entries()).map(([k, v]) => (
                          <tr key={k} className="border-b last:border-0">
                            <td className="py-1 pr-4 font-mono">{k}</td>
                            <td className="py-1">{fmtAction(v)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h3 className="font-medium mb-2">GOTO</h3>
                  <div className="overflow-x-auto max-h-72 overflow-y-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left border-b">
                          <th className="py-2 pr-4">(i, A)</th>
                          <th className="py-2">j</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from(tables.GOTO.entries()).map(([k, v]) => (
                          <tr key={k} className="border-b last:border-0">
                            <td className="py-1 pr-4 font-mono">{k}</td>
                            <td className="py-1">{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
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
