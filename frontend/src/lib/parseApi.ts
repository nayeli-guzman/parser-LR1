const API = "http://localhost:8000";

export type BuildResponse = {
  states: string[][];
  transitions: Record<string, number>;
  action: Record<string, { kind: "shift"; to: number } | { kind: "reduce"; prod:{left:string; right:string[]} } | { kind: "accept" }>;
  goto: Record<string, number>;
  nonTerminals: string[];
  firsts: Record<string, string[]>;
  initialSymbol: string;
};

export type ParseResponse = {
  steps: { stack: string; input: string; action: string }[];
};

export async function buildOnServer(rules: string): Promise<BuildResponse> {
  console.log("Building on server with rules:", rules);
  const res = await fetch(`${API}/build`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ rules }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function parseOnServer(input: string, rules: string): Promise<ParseResponse> {
  const res = await fetch(`${API}/parse`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ input, rules }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
