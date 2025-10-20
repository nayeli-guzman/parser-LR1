export const mockParserData = {
  first_table: [
    { nonterminal: "S'", first: "{c,d}" },
    { nonterminal: "S", first: "{c,d}" },
    { nonterminal: "C", first: "{c,d}" }
  ],
  lr_table: [
    { state: 0, action_c: "s3", action_d: "s4", goto_S: 1, goto_C: 2 },
    { state: 1, accept: true },
    { state: 2, action_c: "s6", action_d: "s7", goto_C: 5 },
    { state: 3, action_c: "s3", action_d: "s4", goto_C: 8 },
    { state: 4, action_c: "r3", action_d: "r3" },
    { state: 5, action_c: "r2", action_d: "r2" }
  ],
  trace: [
    { step: 1, stack: "0", input: "c d d $", action: "s3" },
    { step: 2, stack: "0 3", input: "d d $", action: "s4" },
    { step: 3, stack: "0 3 4", input: "d $", action: "r3" },
    { step: 4, stack: "0 2", input: "d $", action: "s7" },
    { step: 5, stack: "0 2 7", input: "$", action: "r3" },
    { step: 6, stack: "0 2", input: "$", action: "r2" },
    { step: 7, stack: "0 1", input: "$", action: "acc" }
  ],
  tree: {
    name: "S",
    children: [
      {
        name: "C",
        children: [
          { name: "c" },
          { name: "C", children: [{ name: "d" }] }
        ]
      },
      { name: "C", children: [{ name: "d" }] }
    ]
  }
};
