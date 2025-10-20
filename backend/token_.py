from __future__ import annotations
from dataclasses import dataclass
from enum import Enum, auto

class _Type(Enum):
    PLUS = auto()      # +
    MINUS = auto()     # -
    MUL = auto()       # *
    DIV = auto()       # /
    POW = auto()       # **
    LPAREN = auto()    # (
    RPAREN = auto()    # )
    SQRT = auto()      # sqrt
    NUM = auto()       # Número
    ERR = auto()       # Error
    ID = auto()        # Identificador
    LE = auto()
    RE = auto()
    SEMICOL = auto()
    ASSIGN = auto()
    PRINT = auto()
    IF = auto()
    WHILE = auto()
    DO = auto()
    THEN = auto()
    ENDIF = auto()
    ENDWHILE = auto()
    ELSE = auto()
    SWITCH = auto()
    ENDSWITCH = auto()
    CASE = auto()
    DEFAULT = auto()
    COLON = auto()
    OR = auto()
    AND = auto()
    TRUE = auto()
    FALSE = auto()
    NOT = auto()
    END = auto()       # Fin de entrada


@dataclass
class Token:
    # Para compatibilidad con tu parser: puedes usar Token.PLUS, Token.ERR, etc.
    Type = _Type

    type: Type
    text: str = ""

    # ---------- "Constructores" equivalentes ----------
    @classmethod
    def from_char(cls, ttype: Type, c: str) -> "Token":
        """Equivalente a Token(Type, char)."""
        return cls(ttype, str(c)[0] if c else "")

    @classmethod
    def from_slice(cls, ttype: Type, source: str, first: int, last: int) -> "Token":
        """Equivalente a Token(Type, source, first, last) de C++.
        En C++ 'substr(first, last)' toma 'last' como longitud; replicamos eso.
        """
        return cls(ttype, source[first:first + last])

    # ---------- Representación ----------
    def __str__(self) -> str:
        t = self.type
        # Igual que tus operadores << en C++:
        if t == self.Type.END:
            return "TOKEN(END)"
        name = t.name
        return f'TOKEN({name}, "{self.text}")'

    __repr__ = __str__


# Exportar alias directos (opcional) para escribir Token.PLUS, etc.
# (Ya se puede vía Token.Type.PLUS, pero esto imita tu C++: Token.PLUS)
for _member in Token.Type:
    setattr(Token, _member.name, _member)
