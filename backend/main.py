from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Tuple, Optional, Set
from lr1 import LR1Builder
from grammar import Grammar
from first_ import First

EPS = "''"   
END = "$"

app = FastAPI()

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,   # NO uses "*"
    allow_credentials=False,         # pon True solo si usas cookies/autenticación
    allow_methods=["*"],
    allow_headers=["*"],
)

class BuildRequest(BaseModel):
    rules: str

class BuildResponse(BaseModel):
    states: List[List[str]]            # cada ítem serializado "A→α|dot|look"
    transitions: Dict[str, int]        # "i::X" -> j
    action: Dict[str, dict]            # "i::a" -> {kind: "shift"/"reduce"/"accept", ...}
    goto: Dict[str, int]               # "i::A" -> j
    nonTerminals: Set[str]
    firsts: Dict[str, Set[str]]
    initialSymbol: str

class ParseRequest(BaseModel):
    input: str
    rules: str

class StepDTO(BaseModel):
    stack: str
    input: str
    action: str

class ParseResponse(BaseModel):
    steps: List[StepDTO]

def _to_list_str(x):
    if isinstance(x, set):
        return sorted(x)
    if isinstance(x, (list, tuple)):
        # aplanar si accidentalmente vino [[...]]
        if len(x) == 1 and isinstance(x[0], (list, set, tuple)):
            return _to_list_str(x[0])
        return [str(i) for i in x]
    return [str(x)]

def parse_grammar(grammar_str: str):

    grammar = Grammar()
    grammar.loadFromString(grammar_str)

    firsts = First(grammar)
    firsts.compute()

    builder = LR1Builder(
        grammar=grammar,
        firsts=firsts.firstSets
    )

    class _Adapter:
        def __init__(self, builder: LR1Builder):
            self._b = builder

        def build_automaton(self):
            return self._b.build_automaton()  # -> (states, trans)

        def build_tables(self):
            ACTION, GOTO, _states = self._b.build_tables()
            return ACTION, GOTO

        def parse_input(self, input_str: str, ACTION, GOTO):

            def fmt_action(entry) -> str:
                kind, data = entry
                if kind == "shift":
                    return f"shift {data}"
                if kind == "reduce":
                    rhs = " ".join(data.right) if data.right else "ε"
                    return f"reduce {data.left} → {rhs}"
                return "accept"

            tokens = [t for t in input_str.split() if t] + [END]
            stack_states: List[int] = [0]
            stack_syms:   List[str] = []
            ip = 0
            steps: List[Dict[str, str]] = []

            while True:
                s = stack_states[-1]
                a = tokens[ip] if ip < len(tokens) else END
                act = ACTION.get((s, a))

                steps.append({
                    "stack": f"[{', '.join(str(x) for x in stack_states)}] " + (" ".join(stack_syms) if stack_syms else "").strip(),
                    "input": " ".join(tokens[ip:]),
                    "action": fmt_action(act) if act else "error"
                })

                if not act:
                    raise ValueError(f"Parse error en estado {s} con token '{a}'")

                kind, data = act
                if kind == "shift":
                    j = int(data)  # type: ignore
                    stack_syms.append(a)
                    stack_states.append(j)
                    ip += 1
                elif kind == "reduce":
                    prod: Production = data  # type: ignore
                    k = len(prod.right)
                    for _ in range(k):
                        if stack_syms: stack_syms.pop()
                        stack_states.pop()
                    t = stack_states[-1]
                    j = GOTO.get((t, prod.left))
                    if j is None:
                        raise ValueError(f"GOTO indefinido desde estado {t} con {prod.left}")
                    stack_syms.append(prod.left)
                    stack_states.append(j)
                elif kind == "accept":
                    steps.append({
                        "stack": f"[{', '.join(str(x) for x in stack_states)}] " + (" ".join(stack_syms) if stack_syms else "").strip(),
                        "input": "",
                        "action": "accept"
                    })
                    break
                else:
                    raise RuntimeError("Acción desconocida")

            return steps

    return _Adapter(builder), grammar.nonTerminals, firsts.firstSets, grammar.initialState

# ---- Endpoints ----

@app.post("/build", response_model=BuildResponse)
def build(req: BuildRequest):

    G, nonTerminals, firstSets, initialSymbol = parse_grammar(req.rules)
    states, trans = G.build_automaton()
    ACTION, GOTO = G.build_tables()

    def item_str(it) -> str:
        right = list(it.right)
        right.insert(it.dot, "·")
        body = " ".join(right) if right else "·"
        return f"{it.left} → {body} , {it.look}"

    states_ser = [[item_str(it) for it in sorted(I, key=lambda x: (x.left, x.dot, x.look, tuple(x.right)))]
                  for I in states]

    trans_ser = {f"{i}::{X}": j for (i, X), j in trans.items()}

    action_ser: Dict[str, dict] = {}
    for (i, a), entry in ACTION.items():
        if entry[0] == "shift":
            action_ser[f"{i}::{a}"] = {"kind": "shift", "to": entry[1]}
        elif entry[0] == "reduce":
            prod = entry[1]
            action_ser[f"{i}::{a}"] = {"kind": "reduce", "prod": {"left": prod.left, "right": prod.right}}
        else:
            action_ser[f"{i}::{a}"] = {"kind": "accept"}

    goto_ser = {f"{i}::{A}": j for (i, A), j in GOTO.items()}

    nonTerminals = _to_list_str(nonTerminals) 
    firsts={k: sorted(list(v)) for k, v in firstSets.items()}

    return BuildResponse(states=states_ser, 
                         transitions=trans_ser, 
                         action=action_ser, 
                         goto=goto_ser,
                         nonTerminals=nonTerminals,
                         firsts=firsts,
                         initialSymbol=initialSymbol
                        )

@app.post("/parse", response_model=ParseResponse)
def parse(req: ParseRequest):
    
    G, _ , _, _ = parse_grammar(req.rules)
    states, trans = G.build_automaton()
    ACTION, GOTO = G.build_tables()

    steps = G.parse_input(req.input, ACTION, GOTO) 

    out = [StepDTO(stack=s["stack"], input=s["input"], action=s["action"]) for s in steps]
    
    return ParseResponse(steps=out)
