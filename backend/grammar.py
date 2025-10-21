
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Set, List

def trim(s: str) -> str:
    return s.strip()

def split(s: str, sep: str) -> List[str]:
    if sep == ' ':
        return [t for t in s.split(sep) if t != ""]
    return [t.strip() for t in s.split(sep)]

@dataclass
class Grammar:

    terminals: Set[str] = field(default_factory=set)
    nonTerminals: Set[str] = field(default_factory=set)
    initialState: str = ""
    rules: List[str] = field(default_factory=list)

    def loadFromFile(self, filename: str) -> bool:

        rhsSymbols: List[str] = []

        try:
            with open(filename, "r", encoding="utf-8") as f:
                for raw in f:
                    line = trim(raw)
                    if not line or line.startswith("#"):
                        continue

                    self.rules.append(line)

                    pos = line.find("->")
                    if pos == -1:
                        print(f"Regla inválida: {line}")
                        continue

                    left = trim(line[:pos])
                    if not self.nonTerminals:
                        self.initialState = left
                    self.nonTerminals.add(left)

                    right = trim(line[pos + 2:])
                    alternatives = split(right, '|')

                    for alt in alternatives:
                        alt = trim(alt)
                        if not alt or alt in ("''", "ε"):
                            continue
                        symbols = split(alt, ' ')
                        for sym in symbols:
                            sym = trim(sym)
                            if sym and sym not in ("''", "ε"):
                                rhsSymbols.append(sym)
        except OSError as e:
            print(f"Error al abrir archivo: {filename} ({e})")
            return False

        for s in rhsSymbols:
            if s not in self.nonTerminals:
                self.terminals.add(s)

        self.terminals.add("$") 
        return True

    def loadFromString(self, text: str, reset: bool = True) -> bool:
       
        if reset:
            self.rules = []
            self.nonTerminals = set()
            self.terminals = set()
            self.initialState = ""

        rhsSymbols: List[str] = []

        for raw in text.splitlines():
            line = trim(raw)
            if not line or line.startswith("#"):
                continue

            self.rules.append(line)

            pos = line.find("->")
            if pos == -1:
                print(f"Regla inválida: {line}")
                continue

            left = trim(line[:pos])
            if not self.nonTerminals:
                self.initialState = left
            self.nonTerminals.add(left)

            right = trim(line[pos + 2:])
            alternatives = split(right, '|')

            for alt in alternatives:
                alt = trim(alt)
                if not alt or alt in ("''", "ε"):
                    continue
                symbols = split(alt, ' ')
                for sym in symbols:
                    sym = trim(sym)
                    if sym and sym not in ("''", "ε"):
                        rhsSymbols.append(sym)

        for s in rhsSymbols:
            if s not in self.nonTerminals:
                self.terminals.add(s)

        self.terminals.add("$")  # EOF
        return True


    def print(self) -> None:
        print(f"Estado inicial: {self.initialState}")
        print("No terminales:", " ".join(sorted(self.nonTerminals)))
        print("Terminales:", " ".join(sorted(self.terminals)))
        print("Reglas:")
        for r in self.rules:
            print(" ", r)
