const API = "http://localhost:8000";

export type BuildResponse = {
  states: string[][];
  transitions: Record<string, number>;
  action: Record<
    string,
    | { kind: "shift"; to: number }
    | { kind: "reduce"; prod: { left: string; right: string[] } }
    | { kind: "accept" }
  >;
  goto: Record<string, number>;
  nonTerminals: string[];
  firsts: Record<string, string[]>;
  initialSymbol: string;
};

export type ParseResponse = {
  steps: { stack: string; input: string; action: string }[];
};

export async function buildOnServer(rules: string): Promise<BuildResponse> {
  const res = await fetch(`${API}/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rules }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function parseOnServer(input: string, rules: string): Promise<ParseResponse> {
  const res = await fetch(`${API}/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, rules }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function downloadAutomatonPNG(grammar: string, detail: "simple" | "items" = "simple") {
  const res = await fetch(`${API}/automaton/dfa/png?detail=${detail}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rules: grammar }),
  });
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lr1_automaton.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}


export async function fetchAutomaton(
  _kind: "svg" | "png",               
  grammar: string,
  detail: "simple" | "items" | "nfa" = "simple"
): Promise<Blob> {
  const endpoint =
    detail === "nfa"
      ? `${API}/automaton/nfa/png`
      : `${API}/automaton/dfa/png?detail=${detail}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rules: grammar }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.blob();
}
