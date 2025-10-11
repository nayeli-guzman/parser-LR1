# first.py
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Set, List, Dict

# --- Helpers (equivalentes a utils.h: trim, split) ---
def trim(s: str) -> str:
    return s.strip()

def split(s: str, sep: str) -> List[str]:
    if sep == ' ':
        # Mantener el comportamiento del C++: separar por espacios únicos
        # (no split por cualquier whitespace).
        return [t for t in s.split(sep) if t != ""]
    return [t.strip() for t in s.split(sep)]


# --- Interfaz mínima de Grammar para contexto ---
@dataclass
class Grammar:
    nonTerminals: Set[str] = field(default_factory=set)  # e.g., {"E", "T", "F"}
    rules: List[str] = field(default_factory=list)       # e.g., ["E -> T E'", "T -> F T'"]


class First:
    """
    Calcula conjuntos FIRST de una GLC.
    Nota: Fiel a tu C++, solo mira el PRIMER símbolo de cada alternativa y
    no propaga a través de anulables (ε), excepto por el literal '' tal cual.
    """
    def __init__(self, g: Grammar) -> None:
        self.grammar: Grammar = g
        self.firstSets: Dict[str, Set[str]] = {}

    def compute(self) -> None:
        # 1) Inicializar conjuntos FIRST vacíos
        for nt in self.grammar.nonTerminals:
            self.firstSets[nt] = set()

        changed = True
        while changed:
            changed = False

            # 2) Recorrer reglas
            for r in self.grammar.rules:
                line = trim(r)
                if not line:
                    continue

                pos = line.find("->")
                if pos == -1:
                    continue

                left = trim(line[:pos])
                right = trim(line[pos + 2:])

                # 2.1) Alternativas separadas por '|'
                alternatives = split(right, '|')

                for alt in alternatives:
                    symbols = split(trim(alt), ' ')
                    if not symbols:
                        continue

                    sym = trim(symbols[0])
                    if not sym:
                        continue

                    firstSym: Set[str] = set()

                    # Regla 1: si es terminal entre comillas (p.ej., 'a' ó '')
                    if sym.startswith("'") and sym.endswith("'"):
                        if sym == "''":
                            firstSym.add("''")  # ε representado como ''
                        else:
                            # quitar comillas
                            firstSym.add(sym[1:-1])

                    # Regla 2: si es no terminal, copiar FIRST(X1)
                    elif sym in self.grammar.nonTerminals:
                        firstSym = set(self.firstSets.get(sym, set()))

                    # Caso: terminal "implícito" sin comillas
                    else:
                        firstSym.add(sym)

                    # Insertar en FIRST(LHS)
                    before = len(self.firstSets[left])
                    self.firstSets[left].update(firstSym)
                    if len(self.firstSets[left]) > before:
                        changed = True

    def print(self) -> None:
        for nt, fset in self.firstSets.items():
            items = ", ".join(list(fset))
            print(f"First({nt}) = {{ {items} }}")
