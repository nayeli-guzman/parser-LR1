# follow.py
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Set, List, Dict

# --- Helpers (equivalentes a utils.h) ---
def trim(s: str) -> str:
    return s.strip()

def split(s: str, sep: str) -> List[str]:
    if sep == ' ':
        return [t for t in s.split(sep) if t != ""]
    return [t.strip() for t in s.split(sep)]


# --- Interfaz mínima de Grammar para contexto ---
@dataclass
class Grammar:
    nonTerminals: Set[str] = field(default_factory=set)
    rules: List[str] = field(default_factory=list)
    initialState: str = ""


# --- Follow ---
class Follow:
    """
    Calcula FOLLOW para una GLC, siguiendo exactamente tu lógica C++:
    - Follow(S) incluye '$'
    - Para B -> α A γ:
        * Si γ existe: FOLLOW(A) += FIRST(γ) - {ε}
        * Si FIRST(γ) contiene ε: FOLLOW(A) += FOLLOW(B)
      Y si A es el último símbolo de la alternativa: FOLLOW(A) += FOLLOW(B)
    """
    def __init__(self, g: Grammar, first) -> None:
        self.grammar: Grammar = g
        self.first = first  # objeto First con .firstSets ya calculado
        self.followSets: Dict[str, Set[str]] = {}

    def compute(self) -> None:
        # 1) Inicializar conjuntos FOLLOW vacíos
        for nt in self.grammar.nonTerminals:
            self.followSets[nt] = set()

        # Regla 1: el símbolo inicial contiene '$'
        if self.grammar.initialState:
            self.followSets[self.grammar.initialState].add("$")

        changed = True
        while changed:
            changed = False

            # 2) Recorrer todas las reglas
            for r in self.grammar.rules:
                line = trim(r)
                if not line:
                    continue

                pos = line.find("->")
                if pos == -1:
                    continue

                left = trim(line[:pos])            # B
                right = trim(line[pos + 2:])       # α | α A γ | ...

                alternatives = split(right, '|')

                for alt in alternatives:
                    symbols = split(trim(alt), ' ')
                    n = len(symbols)
                    if n == 0:
                        continue

                    # 3) Analizar cada símbolo A
                    for i, A in enumerate(symbols):
                        A = trim(A)
                        if not A or A not in self.grammar.nonTerminals:
                            continue  # solo procesamos no terminales

                        # ¿tiene algo a la derecha?
                        if i + 1 < n:
                            nextSym = trim(symbols[i + 1])
                            firstNext: Set[str] = set()

                            if nextSym.startswith("'") and nextSym.endswith("'"):
                                # Terminal explícito
                                if nextSym == "''":
                                    firstNext.add("''")
                                else:
                                    firstNext.add(nextSym[1:-1])
                            elif nextSym in self.grammar.nonTerminals:
                                # No terminal: usar FIRST ya calculado
                                firstNext = set(self.first.firstSets.get(nextSym, set()))
                            else:
                                # Terminal implícito
                                firstNext.add(nextSym)

                            # Insertar FIRST(nextSym) - {ε} en FOLLOW(A)
                            before = len(self.followSets[A])
                            for s in firstNext:
                                if s != "''":
                                    self.followSets[A].add(s)

                            # Si ε ∈ FIRST(nextSym), añadir FOLLOW(left)
                            if "''" in firstNext:
                                follows_left = self.followSets.get(left, set())
                                self.followSets[A].update(follows_left)

                            if len(self.followSets[A]) > before:
                                changed = True

                        # Si A es el último de la alternativa: FOLLOW(A) += FOLLOW(left)
                        if i == n - 1:
                            before = len(self.followSets[A])
                            self.followSets[A].update(self.followSets.get(left, set()))
                            if len(self.followSets[A]) > before:
                                changed = True

    def print(self) -> None:
        for nt, fset in self.followSets.items():
            items = ", ".join(list(fset))
            print(f"Follow({nt}) = {{ {items} }}")
