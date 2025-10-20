# table_ll1.py
from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, List, Tuple, Set

def trim(s: str) -> str:
    return s.strip()

def split(s: str, sep: str) -> List[str]:
    if sep == ' ':
        return [t for t in s.split(sep) if t != ""]
    return [t.strip() for t in s.split(sep)]


# -------------------------
# Tipos y símbolos
# -------------------------
TERMINAL = 0
NONTERMINAL = 1

@dataclass(frozen=True)
class Symbol:
    type: int   # TERMINAL | NONTERMINAL
    value: int  # id


# -------------------------
# Tabla LL(1)
# -------------------------
class Table:
    """
    Construye y mantiene la tabla predictiva LL(1).
    - parserTable[(nt_id, t_id)] = List[Symbol]  (RHS de la producción)
      * RHS vacío -> producción ε
      * También soporta epsilon explícito como terminal "''" (ver abajo)
    - ntMap / termMap: mapeos nombre -> id
    - ntsVec / tsVec: id -> nombre
    """

    def __init__(self, g, first, follow) -> None:
        self.parserTable: Dict[Tuple[int, int], List[Symbol]] = {}
        self.ntMap: Dict[str, int] = {}
        self.ntsVec: List[str] = []
        self.termMap: Dict[str, int] = {}
        self.tsVec: List[str] = []

        # -------------------------
        # IDs para no terminales (usar orden determinista)
        # -------------------------
        for i, nt in enumerate(sorted(g.nonTerminals)):
            self.ntMap[nt] = i
            self.ntsVec.append(nt)

        # -------------------------
        # IDs para terminales (orden determinista)
        # -------------------------
        for i, t in enumerate(sorted(g.terminals)):
            self.termMap[t] = i
            self.tsVec.append(t)

        # Añadir epsilon explícito como terminal "''" al final (igual que C++)
        if "''" not in self.termMap:
            eid = len(self.tsVec)
            self.termMap["''"] = eid
            self.tsVec.append("''")

        # -------------------------
        # Construcción de la tabla
        # -------------------------
        for ruleStr in g.rules:
            pos = ruleStr.find("->")
            if pos == -1:
                continue

            lhs = trim(ruleStr[:pos])       # LHS (no terminal)
            rhs = trim(ruleStr[pos + 2:])   # RHS (alternativas)

            alternatives = split(rhs, '|')

            for alt in alternatives:
                alt = trim(alt)

                # --- Manejo de ε explícito ---
                # Si la alternativa es vacía o ''/ε, rellenar con FOLLOW(lhs)
                if not alt or alt in ("''", "ε"):
                    for term in follow.followSets.get(lhs, set()):
                        lhs_id = self.getNonTerminalId(lhs)
                        t_id = self.getTerminalId("$" if term == "''" else term)
                        # En la versión C++ empujan un TERMINAL "''" como RHS de la producción
                        self.parserTable[(lhs_id, t_id)] = [Symbol(TERMINAL, self.termMap["''"])]
                    continue

                # --- Calcular FIRST(α) y si α ⇒* ε ---
                first_alpha: Set[str] = set()
                can_be_epsilon = True
                symbols = split(alt, ' ')

                for s in symbols:
                    s = trim(s)
                    if s in g.nonTerminals:
                        first_s = set(first.firstSets.get(s, set()))
                    else:
                        # terminal (implícito o explícito ya “normalizado” en Grammar)
                        first_s = {s}

                    # FIRST(α) += FIRST(s) - {ε}
                    for f in first_s:
                        if f != "''":
                            first_alpha.add(f)

                    # Si FIRST(s) no contiene ε, paramos la cadena anulable
                    if "''" not in first_s:
                        can_be_epsilon = False
                        break

                # --- Insertar producción para cada terminal de FIRST(α) ---
                lhs_id = self.getNonTerminalId(lhs)
                for term in first_alpha:
                    tid = self.getTerminalId(term)
                    # Construir RHS como lista de Symbols (NT o T)
                    rhs_syms: List[Symbol] = []
                    for sym in symbols:
                        if sym in self.ntMap:
                            rhs_syms.append(Symbol(NONTERMINAL, self.ntMap[sym]))
                        elif sym in self.termMap:
                            rhs_syms.append(Symbol(TERMINAL, self.termMap[sym]))
                        else:
                            # Si el símbolo no está en termMap pero es terminal válido,
                            # podrías normalizar aquí (p. ej., quitar comillas si decides usarlas en gramática).
                            # Por ahora, sólo lo añadimos si existe.
                            pass
                    self.parserTable[(lhs_id, tid)] = rhs_syms

                # --- Si α ⇒* ε, agregar entradas con FOLLOW(LHS) y RHS = ε (lista vacía) ---
                if can_be_epsilon:
                    for term in follow.followSets.get(lhs, set()):
                        tid = self.getTerminalId("$" if term == "''" else term)
                        self.parserTable[(lhs_id, tid)] = []  # producción ε

    # -------------------------
    # Utilidades públicas
    # -------------------------
    def print(self) -> None:
        # Encabezado
        from math import ceil
        width_nt = 8
        width_t = 12

        print(f"{'NT/T':<{width_nt}}", end="")
        for t in self.tsVec:
            print(f"{t:<{width_t}}", end="")
        print()

        print("-" * (width_nt + width_t * len(self.tsVec)))

        for i, nt in enumerate(self.ntsVec):
            print(f"{nt:<{width_nt}}", end="")
            for j, t in enumerate(self.tsVec):
                key = (i, j)
                if key in self.parserTable and self.parserTable[key] is not None:
                    rhs = self.parserTable[key]
                    if not rhs:
                        rhs_str = "ε"
                    else:
                        parts = []
                        for s in rhs:
                            parts.append(self.ntsVec[s.value] if s.type == NONTERMINAL else self.tsVec[s.value])
                        rhs_str = " ".join(parts)
                    print(f"{rhs_str:<{width_t}}", end="")
                else:
                    print(f"{'-':<{width_t}}", end="")
            print()

    def getNonTerminalId(self, nt: str) -> int:
        return self.ntMap.get(nt, -1)

    def getTerminalId(self, t: str) -> int:
        return self.termMap.get(t, -1)
