# ast_.py
from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import List, Protocol, runtime_checkable, Optional


# ------------------------------
# Operadores binarios
# ------------------------------
class BinaryOp(Enum):
    PLUS_OP = auto()
    MINUS_OP = auto()
    MUL_OP = auto()
    DIV_OP = auto()
    POW_OP = auto()
    LE_OP = auto()
    RE_OP = auto()
    OR_OP = auto()
    AND_OP = auto()


# Exporta alias con los nombres usados en tu parser
PLUS_OP  = BinaryOp.PLUS_OP
MINUS_OP = BinaryOp.MINUS_OP
MUL_OP   = BinaryOp.MUL_OP
DIV_OP   = BinaryOp.DIV_OP
POW_OP   = BinaryOp.POW_OP
LE_OP    = BinaryOp.LE_OP
RE_OP    = BinaryOp.RE_OP
OR_OP    = BinaryOp.OR_OP
AND_OP   = BinaryOp.AND_OP


# ------------------------------
# Visitor (interfaz)
# ------------------------------
@runtime_checkable
class Visitor(Protocol):
    # Expresiones
    def visit_BinaryExp(self, node: "BinaryExp") -> int: ...
    def visit_MonoExp(self, node: "MonoExp") -> int: ...
    def visit_NumberExp(self, node: "NumberExp") -> int: ...
    def visit_IdExp(self, node: "IdExp") -> int: ...
    def visit_SqrtExp(self, node: "SqrtExp") -> int: ...

    # Sentencias
    def visit_AssignStm(self, node: "AssignStm") -> int: ...
    def visit_PrintStm(self, node: "PrintStm") -> int: ...
    def visit_WhileStm(self, node: "WhileStm") -> int: ...
    def visit_IfStm(self, node: "IfStm") -> int: ...
    def visit_CaseStm(self, node: "CaseStm") -> int: ...
    def visit_SwitchStm(self, node: "SwitchStm") -> int: ...
    def visit_Program(self, node: "Program") -> int: ...


# ------------------------------
# Clases de AST
# ------------------------------
class Exp:
    def accept(self, visitor: Visitor) -> int:
        raise NotImplementedError

    @staticmethod
    def binopToChar(op: BinaryOp) -> str:
        return {
            BinaryOp.PLUS_OP: "+",
            BinaryOp.MINUS_OP: "-",
            BinaryOp.MUL_OP: "*",
            BinaryOp.DIV_OP: "/",
            BinaryOp.POW_OP: "**",
            BinaryOp.LE_OP: "<",
            BinaryOp.RE_OP: ">",
            BinaryOp.OR_OP: "or",
            BinaryOp.AND_OP: "and",
        }.get(op, "?")


@dataclass
class BinaryExp(Exp):
    left: Exp
    right: Exp
    op: BinaryOp

    def accept(self, visitor: Visitor) -> int:
        return visitor.visit_BinaryExp(self)


@dataclass
class MonoExp(Exp):
    exp: Exp
    is_neg: bool  # en tu gramática lo usas para NOT

    def accept(self, visitor: Visitor) -> int:
        return visitor.visit_MonoExp(self)


@dataclass
class NumberExp(Exp):
    value: int

    def accept(self, visitor: Visitor) -> int:
        return visitor.visit_NumberExp(self)


@dataclass
class IdExp(Exp):
    value: str

    def accept(self, visitor: Visitor) -> int:
        return visitor.visit_IdExp(self)


@dataclass
class SqrtExp(Exp):
    value: Exp

    def accept(self, visitor: Visitor) -> int:
        return visitor.visit_SqrtExp(self)


class Stm:
    def accept(self, visitor: Visitor) -> int:
        raise NotImplementedError


@dataclass
class IfStm(Stm):
    condicion: Exp
    parteelse: bool = False
    slist1: List[Stm] = field(default_factory=list)
    slist2: List[Stm] = field(default_factory=list)

    def accept(self, visitor: Visitor) -> int:
        return visitor.visit_IfStm(self)


@dataclass
class WhileStm(Stm):
    condicion: Exp
    slist1: List[Stm] = field(default_factory=list)

    def accept(self, visitor: Visitor) -> int:
        return visitor.visit_WhileStm(self)


@dataclass
class AssignStm(Stm):
    id: str
    e: Exp

    def accept(self, visitor: Visitor) -> int:
        return visitor.visit_AssignStm(self)


@dataclass
class PrintStm(Stm):
    e: Exp

    def accept(self, visitor: Visitor) -> int:
        return visitor.visit_PrintStm(self)


@dataclass
class CaseStm(Stm):
    condition: Exp
    slist: List[Stm] = field(default_factory=list)

    def accept(self, visitor: Visitor) -> int:
        return visitor.visit_CaseStm(self)


@dataclass
class SwitchStm(Stm):
    condition: Exp
    slist: List[CaseStm] = field(default_factory=list)
    deflist: List[Stm] = field(default_factory=list)

    def accept(self, visitor: Visitor) -> int:
        return visitor.visit_SwitchStm(self)


@dataclass
class Program:
    slist: List[Stm] = field(default_factory=list)

    def add(self, s: Stm) -> None:
        self.slist.append(s)

    def accept(self, visitor: Visitor) -> int:
        return visitor.visit_Program(self)
