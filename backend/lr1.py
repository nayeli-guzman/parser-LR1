from __future__ import annotations
from dataclasses import dataclass
from typing import List, Tuple, Dict, Set, Optional
from grammar import Grammar

EPS = "''"   # epsilon
END = "$"    # fin de entrada

def trim(s: str) -> str: 
    return s.strip()

def split(s: str, sep: str) -> List[str]:
    if sep == ' ':
        return [t for t in s.split(sep) if t != ""]
    return [t.strip() for t in s.split(sep)]

def norm(sym: str) -> str:
    """Normaliza símbolos: 'x' -> x, ''/ε -> EPS, quita espacios."""
    sym = sym.strip()
    if sym in (EPS, "ε"):
        return EPS
    if len(sym) >= 2 and sym[0] == sym[-1] == "'":
        return sym[1:-1]
    return sym

@dataclass
class Production:
    left: str
    right: List[str]  # [] significa ε

    def __str__(self):
        return f"{self.left } -> {self.right}"

@dataclass
class NFA:
    Q: Set[LR1Item]
    E: List[Tuple[LR1Item, str, LR1Item]]
    start: LR1Item
    eps_label: str = EPS

@dataclass
class DFA:
    states: List[Set[LR1Item]]                  # cada estado es un conjunto de LR1Item
    trans: Dict[Tuple[int, str], int]           # (state_id, label) -> state_id
    start: int                                  # id del estado inicial (normalmente 0)
    accept: Set[int]                            # ids de estados de aceptación
    labels: Set[str]                            # conjunto de etiquetas usadas (sin eps)
    index: Dict[frozenset, int]                 # 

"""
    LR1Item representa un ítem LR(1): A -> α . β , a
    left: A
    right: (α β) como tupla de símbolos [α, β]
    dot: posición del punto (índice en right)
    look: símbolo de anticipación 'a'
"""
@dataclass(frozen=True)
class LR1Item:
    left: str
    right: Tuple[str, ...]
    dot: int
    look: str

    """
        Retorna el símbolo que está después del punto, o None si está al final.
    """
    def next_symbol(self) -> Optional[str]:
        return self.right[self.dot] if self.dot < len(self.right) else None

    def at_end(self) -> bool:
        return self.dot >= len(self.right)

    """
        Retorna un nuevo ítem con el punto avanzado una posición.
    """
    def advance(self) -> "LR1Item":
        assert not self.at_end()
        return LR1Item(self.left, self.right, self.dot + 1, self.look)

class LR1Builder:
    """
    Construye autómata LR(1) y tablas ACTION/GOTO.
    Acepta terminales con o sin comillas; ''/ε como epsilon.
    """
    def __init__(self,
                 grammar: Grammar,
                 firsts: Dict[str, Set[str]]
                 ):

        self.N: Set[str] = grammar.nonTerminals
        self.T: Set[str] = {norm(t) for t in grammar.terminals if norm(t) != EPS}
        self.S: str = grammar.initialState
        self.rules: List[str] = grammar.rules

        self.prods: Dict[str, List[Production]] = {}
        self._parse_rules(self.rules)  # esto también infiere terminales
        self.T.add(END)  # asegura $

        # Símbolo inicial aumentado S'
        self.S_: str = f"{self.S}'"
        while self.S_ in self.N:
            self.S_ += "'"
        self.N.add(self.S_)
        self.prods.setdefault(self.S_, []).append(Production(self.S_, [self.S]))

        # FIRST para no terminales
        self.first_nt: Dict[str, Set[str]] = firsts

        self.afn: NFA = self.build_nfa()
        self.afd: DFA = self.build_dfa()
        self.tables = self.build_tables()

        print(f"No Terminales: {self.N}")
        print(f"Terminales: {self.T}")
        print(f"Start: {self.S}")
        print(f"Producciones: {self.prods}")
        print(f"FIRST: {self.first_nt}")
       

    def _parse_rules(self, rules: List[str]) -> None:

        for r in rules:
            line = trim(r)
            if not line:
                continue
            pos = line.find("->")
            if pos == -1:
                continue
            A = norm(trim(line[:pos]))
            rhs = trim(line[pos+2:])
            for alt in split(rhs, '|'):
                alt = trim(alt)
                if not alt or alt in (EPS, "ε"):
                    rhs_list: List[str] = []
                else:
                    syms = [norm(s) for s in split(alt, ' ')]
                    rhs_list = [s for s in syms if s != EPS]
                    # Inferir terminales: todo símbolo en RHS que no esté en N es terminal
                    for s in rhs_list:
                        if s not in self.N and s != END:
                            # No sobreescribe N; si luego el usuario quiere que sea no terminal,
                            # debe incluirlo en `nonterminals`.
                            pass
                self.prods.setdefault(A, []).append(Production(A, rhs_list))
            # Asegurar que el lado izquierdo esté en N
            if A not in self.N:
                self.N.add(A)
    
        # Tras leer todas las reglas, define T como "símbolos en RHS que no estén en N"
        rhs_syms: Set[str] = set()
        for plist in self.prods.values():
            for p in plist:
                rhs_syms.update(p.right)
        inferred_T = {s for s in rhs_syms if s not in self.N and s != EPS}
        self.T |= inferred_T

    def first_seq(self, seq: List[str]) -> Set[str]:
        """FIRST de una secuencia (incluye EPS si toda la secuencia es anulable)."""
        if not seq:
            return {EPS}
        out: Set[str] = set()
        nullable = True
        for X in seq:
            if X in self.T:  # terminal (incluye $)
                out.add(X); nullable = False; break
            out.update(t for t in self.first_nt[X] if t != EPS)
            if EPS not in self.first_nt[X]:
                nullable = False; break
        if nullable:
            out.add(EPS)
        return out

    def _set_action(self, ACTION, i, a, entry):
        if (i, a) in ACTION and ACTION[(i, a)] != entry:
            prev = ACTION[(i, a)]
            raise ValueError(f"Conflicto LR(1) en ACTION[{i},{a}]: {prev} vs {entry}")
        ACTION[(i, a)] = entry

    def build_nfa(self) -> NFA:
        """
        Construye el AFN de ítems LR(1).

        - Cada ítem LR1Item es un estado.
        - Añade transiciones etiquetadas con el símbolo siguiente al punto.
        - Añade transiciones epsilon (eps_label) desde un ítem cuando el símbolo
          siguiente es un no terminal B: por cada producción B -> γ y cada b in FIRST(β a)
          crea el ítem B -> . γ , look donde look = (b if b != EPS else original_look).

        Parámetros:
            eps_label: etiqueta para transiciones epsilon (por defecto "ε").
            store: si True guarda la NFA en self.afn antes de devolverla.

        Retorna:
            NFA(Q, E, start, eps_label)
        """
        Q: Set[LR1Item] = set()                     # estados
        E: List[Tuple[LR1Item, str, LR1Item]] = []  # transiciones

        # ítem inicial S' -> . S , $
        start = LR1Item(self.S_, tuple([self.S]), 0, END)
        Q.add(start)
        work = [start]

        while work:
            it = work.pop()
            B = it.next_symbol()  # símbolo después del punto
            if B is None:
                continue

            # 1) transición etiquetada con B hacia it.advance()
            nxt = it.advance()
            E.append((it, B, nxt))
            if nxt not in Q:
                Q.add(nxt)
                work.append(nxt)

            # 2) si B es no terminal, añadir transiciones epsilon a ítems B -> . γ , look
            if B in self.N:
                # β = símbolos después de B en la producción actual
                beta = list(it.right[it.dot + 1 :])
                # FIRST(β a) para determinar lookaheads de las nuevas producciones
                lookseq = beta + [it.look]
                la_set = self.first_seq(lookseq)
                for prod in self.prods.get(B, []):  # cada producción B -> γ
                    for b in la_set:
                        look2 = it.look if b == EPS else b
                        new_it = LR1Item(B, tuple(prod.right), 0, look2)
                        E.append((it, EPS, new_it))
                        if new_it not in Q:
                            Q.add(new_it)
                            work.append(new_it)

        nfa = NFA(Q=Q, E=E, start=start, eps_label=EPS)
        return nfa

    def build_dfa(self) -> DFA:
        """
        Construye el AFD a partir de self.afn (si no existe, lo construye).
        Parámetros:
            only_terminals: si True filtra las etiquetas del AFN a solo terminales (self.T).
            eps_label: etiqueta usada en el AFN para transiciones epsilon (por defecto "ε").
            store: si True guarda el resultado en self.dfa.
        Retorna:
            instancia DFA con estados (conjuntos de LR1Item), transiciones y estados de aceptación.
        """
        # Asegurar que el AFN existe
        if not hasattr(self, "afn") or self.afn is None:
            self.build_nfa()

        Q, E, start = self.afn.Q, self.afn.E, self.afn.start

        E_use = list(E)

        # Construir mapas rápidos: eps_map y trans_map[label][src] -> set(dsts)
        eps_map: Dict[LR1Item, Set[LR1Item]] = {}
        trans_map: Dict[str, Dict[LR1Item, Set[LR1Item]]] = {}
        labels: Set[str] = set()

        for src, lab, dst in E_use:
            if lab == EPS:
                eps_map.setdefault(src, set()).add(dst)
            else:
                trans_map.setdefault(lab, {}).setdefault(src, set()).add(dst)
                labels.add(lab)

        def epsilon_closure(states: Set[LR1Item]) -> Set[LR1Item]:
            stack = list(states)
            res = set(states)
            while stack:
                u = stack.pop()
                for v in eps_map.get(u, ()):
                    if v not in res:
                        res.add(v)
                        stack.append(v)
            return res

        def move(states: Set[LR1Item], sym: str) -> Set[LR1Item]:
            out: Set[LR1Item] = set()
            m = trans_map.get(sym)
            if not m:
                return out
            for s in states:
                out |= m.get(s, set())
            return out

        # Inicial: cierre epsilon del ítem inicial
        start_closure = epsilon_closure({start})
        d_states: List[Set[LR1Item]] = [start_closure]
        d_index: Dict[frozenset, int] = {frozenset(start_closure): 0}
        d_trans: Dict[Tuple[int, str], int] = {}

        work = [start_closure]
        # iterar etiquetas en orden para reproducibilidad
        sorted_labels = sorted(labels)

        while work:
            S = work.pop(0)
            sid = d_index[frozenset(S)]
            for a in sorted_labels:
                m = move(S, a)
                if not m:
                    continue
                C = epsilon_closure(m)
                key = frozenset(C)
                if key not in d_index:
                    nid = len(d_states)
                    d_index[key] = nid
                    d_states.append(C)
                    work.append(C)
                else:
                    nid = d_index[key]
                d_trans[(sid, a)] = nid

        # identificar estados de aceptación (contienen S' -> ... . , $)
        d_accept: Set[int] = set()
        for i, st in enumerate(d_states):
            for it in st:
                if it.left == self.S_ and it.at_end() and it.look == END:
                    d_accept.add(i)
                    break

        dfa = DFA(states=d_states, trans=d_trans, start=0, accept=d_accept, labels=set(sorted_labels), index=d_index)

        return dfa

    def build_tables(self):
        """
        Construye ACTION y GOTO usando el AFD almacenado en self.dfa.

        Parámetros:
            use_dfa_transitions: si True utiliza directamente dfa.trans para SHIFT y GOTO.
                                 si False, usa dfa.trans para SHIFT y calcula GOTO con self.goto().
            ensure_dfa: si True, construye self.dfa si no existe (llama a build_dfa()).

        Retorna:
            ACTION, GOTO, dfa.states
        """

        dfa = self.afd
        ACTION: Dict[Tuple[int, str], Tuple[str, int | Production | None]] = {}
        GOTO: Dict[Tuple[int, str], int] = {}

        # --- 1) SHIFTS y REDUCE/ACCEPT por ítems en cada estado del DFA ---
        for i, I in enumerate(dfa.states):
            # (A) Si usamos dfa.trans para shifts, aplicamos esas transiciones
            # recorremos todas las transiciones que parten de i
            for (s, label), j in dfa.trans.items():
                if s != i:
                    continue
                # shift sólo para terminales
                if label in self.T:
                    self._set_action(ACTION, i, label, ("shift", j))
            # las reducciones/accept deben revisarse por los ítems contenidos en I
            for it in I:
                if it.at_end():
                    if it.left == self.S_ and it.look == END:
                        self._set_action(ACTION, i, END, ("accept", None))
                    else:
                        prod = Production(it.left, list(it.right))
                        self._set_action(ACTION, i, it.look, ("reduce", prod))

        # --- 2) GOTO: preferir transiciones del DFA (si están), o calcular con goto() ---
        for (s, label), j in dfa.trans.items():
            if label in self.N:
                GOTO[(s, label)] = j
        
        return ACTION, GOTO, dfa.states

class LR1Parser:
    def __init__(self, builder: LR1Builder):
        self.builder = builder
        self.ACTION, self.GOTO, self.states = builder.build_tables()

    def parse(self, tokens: List[str]) -> bool:
        if not tokens or tokens[-1] != END:
            tokens = tokens + [END]
        ip = 0
        stack_states: List[int] = [0]
        stack_syms: List[str] = []

        while True:
            s = stack_states[-1]
            a = tokens[ip]
            act = self.ACTION.get((s, a))
            if act is None:
                print(f"[LR1] error en estado {s} con lookahead '{a}'")
                return False

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
                    stack_syms.pop()
                    stack_states.pop()
                t = stack_states[-1]
                j = self.GOTO.get((t, prod.left))
                if j is None:
                    print(f"[LR1] GOTO indefinido desde estado {t} con {prod.left}")
                    return False
                stack_syms.append(prod.left)
                stack_states.append(j)
            elif kind == "accept":
                return True
            else:
                raise RuntimeError("Acción desconocida")
