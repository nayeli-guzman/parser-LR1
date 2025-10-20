export const mockParserData = {
  first_table: [
    { nonterminal: "S'", first: "c,d" },
    { nonterminal: "S", first: "c,d" },
    { nonterminal: "C", first: "c,d" },
  ],
  lr_table: [ /* your existing LR data */ ],
  trace: [ /* ... */ ],
  tree: { /* ... */ },
  follow_table: [
    { nonterminal: "S'", follow: "$" },
    { nonterminal: "S", follow: "$" },
    { nonterminal: "C", follow: "c,d,$" },
  ],
  derivation_steps: [
    { form: "S", rule: "S → C C" },
    { form: "C C", rule: "C → c C" },
    { form: "c C C", rule: "C → d" },
    { form: "c d C", rule: "C → d" },
    { form: "c d d", rule: "accept" },
  ],
  nfa: {
    nodes: [
      { id: "0", position: { x: 100, y: 100 }, data: { label: "q0" } },
      { id: "1", position: { x: 300, y: 100 }, data: { label: "q1" } },
      { id: "2", position: { x: 500, y: 100 }, data: { label: "q2 (accept)" } },
    ],
    edges: [
      { id: "e0-1", source: "0", target: "1", label: "c" },
      { id: "e1-2", source: "1", target: "2", label: "d" },
    ],
  },
  dfa: {
    nodes: [
      { id: "A", position: { x: 150, y: 100 }, data: { label: "A" } },
      { id: "B", position: { x: 350, y: 100 }, data: { label: "B" } },
      { id: "C", position: { x: 550, y: 100 }, data: { label: "C (accept)" } },
    ],
    edges: [
      { id: "eA-B", source: "A", target: "B", label: "c" },
      { id: "eB-C", source: "B", target: "C", label: "d" },
    ],
  },
};
