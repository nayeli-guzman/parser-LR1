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

    """
        Construye el cierre de un conjunto de ítems LR(1).
    """
    def closure(self, I: Set[LR1Item]) -> Set[LR1Item]:
        C = set(I)
        changed = True
        while changed:
            changed = False
            for item in list(C):
                B = item.next_symbol() # S'-> . S , $, retorna S
                if B and B in self.N: # verifica si B es un no terminal
                    beta = list(item.right[item.dot+1:]) # los símbolos después de B
                    look_seq = beta + [item.look] # βa para hallar FIRST(βa)
                    la_set = self.first_seq(look_seq)
                    for prod in self.prods.get(B, []): # por cada producción B -> γ
                        for b in la_set: # cada símbolo en FIRST(βa)
                            # Si FIRST(β a) contiene es vacio, el lookahead es el mismo, sino es el terminal
                            b2 = item.look if b == EPS else b
                            new_item = LR1Item(B, tuple(prod.right), 0, b2) # B -> . γ , b
                            if new_item not in C:
                                C.add(new_item); changed = True # se añade la nueva producción a la clausura
        # el proceso continúa hasta que no se añadan más ítems
        # esto es cuando se hacen las transiciones de EPS
        return C

    """
        Mueve el punto en los ítems de I que tienen X después del punto, y
        retorna la clausura del conjunto resultante.
    """
    def goto(self, I: Set[LR1Item], X: str) -> Set[LR1Item]:
        moved = {it.advance() for it in I if it.next_symbol() == X}
        if not moved:
            return set()
        return self.closure(moved)

    """
     Construye el autómata LR(1) completo.
    """
    def build_automaton(self):
        # se empezará con el ítem aumentado S' -> . S , $
        I0 = self.closure({LR1Item(self.S_, tuple([self.S]), 0, END)}) # estado inicial 
        # {S'-> . S , $; S -> . A B , $; A -> . a A , $; A -> . ε}
        states: List[Set[LR1Item]] = [I0]
        trans: Dict[Tuple[int, str], int] = {}
        work = [I0]
        while work:
            I = work.pop()
            i = states.index(I)
            symbols = set()
            for it in I:
                s = it.next_symbol() # S'-> . S , $ retorna S
                if s:
                    symbols.add(s) # se añaden todos los símbolos después del punto != None
            for X in symbols:
                J = self.goto(I, X) # avanzar el punto a las producciones que tienen X después del punto, con el mismo lookahead y retorna su clausura
                if not J:
                    continue
                if J not in states:
                    states.append(J)
                    work.append(J)
                j = states.index(J)
                trans[(i, X)] = j # transición del estado i al j con símbolo X
        return states, trans

    """
        Construye las tablas ACTION y GOTO.
    """
    def build_tables(self):
        
        states, trans = self.build_automaton() # construye el autómata LR(1)
        ACTION: Dict[Tuple[int, str], Tuple[str, int | Production | None]] = {}
        GOTO: Dict[Tuple[int, str], int] = {}

        for i, I in enumerate(states): # por cada estado y su id
            for it in I:
                a = it.next_symbol()
                if a in self.T:  # si el símbolo es terminal, se reemplaza (shift del punto)
                    j = trans.get((i, a)) # estado destino
                    if j is not None:
                        self._set_action(ACTION, i, a, ("shift", j))
                elif a is None:
                    if it.left == self.S_ and it.look == END:
                        self._set_action(ACTION, i, END, ("accept", None))
                    else:
                        prod = Production(it.left, list(it.right))
                        self._set_action(ACTION, i, it.look, ("reduce", prod))

            # GOTO para no terminales
            for A in self.N:
                j = trans.get((i, A))
                if j is not None:
                    GOTO[(i, A)] = j # solo se coloca el ID del estado destino

        return ACTION, GOTO, states

    def _set_action(self, ACTION, i, a, entry):
        if (i, a) in ACTION and ACTION[(i, a)] != entry:
            prev = ACTION[(i, a)]
            raise ValueError(f"Conflicto LR(1) en ACTION[{i},{a}]: {prev} vs {entry}")
        ACTION[(i, a)] = entry

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


def _prod_str(p) -> str:
    rhs = " ".join(p.right) if p.right else "ε"
    return f"{p.left} → {rhs}"

def print_lr1_tables(builder, show_states: bool = False) -> None:
    
    ACTION, GOTO, states = builder.build_tables()

    terms = sorted(builder.T)                          # incluye $
    nonterms = sorted(builder.N - {builder.S_})        # excluye S'

    width_state = 6
    width_cell = 14

    # ----- ACTION -----
    print("\n=== ACTION ===")
    print(f"{'state':<{width_state}}", end="")
    for a in terms:
        print(f"{a:<{width_cell}}", end="")
    print()
    print("-" * (width_state + width_cell * len(terms)))

    for i, _ in enumerate(states):
        print(f"{i:<{width_state}}", end="")
        for a in terms:
            cell = ACTION.get((i, a))
            if cell is None:
                out = "-"
            else:
                kind, data = cell
                if kind == "shift":
                    out = f"s{data}"
                elif kind == "reduce":
                    out = "r(" + _prod_str(data) + ")"
                elif kind == "accept":
                    out = "acc"
                else:
                    out = "?"
            print(f"{out:<{width_cell}}", end="")
        print()

    # ----- GOTO -----
    print("\n=== GOTO ===")
    print(f"{'state':<{width_state}}", end="")
    for A in nonterms:
        print(f"{A:<{width_cell}}", end="")
    print()
    print("-" * (width_state + width_cell * len(nonterms)))

    for i, _ in enumerate(states):
        print(f"{i:<{width_state}}", end="")
        for A in nonterms:
            j = GOTO.get((i, A))
            out = "-" if j is None else str(j)
            print(f"{out:<{width_cell}}", end="")
        print()

    if show_states:
        print("\n=== Estados (ítems LR(1)) ===")
        for i, I in enumerate(states):
            print(f"State {i}:")
            for it in sorted(I, key=lambda x: (x.left, x.right, x.dot, x.look)):
                right = list(it.right)
                right.insert(it.dot, "·")
                body = " ".join(right) if right else "·"
                print(f"  {it.left} -> {body} , {it.look}")
            print()
