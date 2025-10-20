# parser_ll1.py
from __future__ import annotations
from typing import List
from table import Table, Symbol, TERMINAL, NONTERMINAL

class LL1Parser:
    def __init__(self, table: Table, start_symbol_id: int) -> None:
        self.table = table
        self.startSymbol = start_symbol_id

    def parse(self, tokens: List[str]) -> bool:
        # Convertir tokens a IDs de terminales
        input_ids: List[int] = []
        for tok in tokens:
            tid = self.table.getTerminalId(tok)
            if tid < 0:
                print(f"[Parser] Token desconocido: {tok}")
                return False
            input_ids.append(tid)

        # Asegurar fin de entrada $
        dollar_id = self.table.getTerminalId("$")
        if not input_ids or input_ids[-1] != dollar_id:
            input_ids.append(dollar_id)

        # Pila: [$, Start]
        stack: List[Symbol] = []
        stack.append(Symbol(TERMINAL, dollar_id))
        stack.append(Symbol(NONTERMINAL, self.startSymbol))

        ip = 0  # índice de lectura

        # Anchos para impresión (similar a setw)
        width_pila = 25
        width_entrada = 25
        width_regla = 30

        def pad(s: str, w: int) -> str:
            return f"{s:<{w}}"

        print("\n=== Tabla de derivación ===")
        print(
            pad("Pila", width_pila)
            + pad("Entrada", width_entrada)
            + pad("Regla aplicada", width_regla)
        )
        print("-" * (width_pila + width_entrada + width_regla))

        def stack_to_str(stk: List[Symbol]) -> str:
            # Mostrar de base a cima (igual que tu C++)
            names: List[str] = []
            for s in stk:
                names.append(self.table.ntsVec[s.value] if s.type == NONTERMINAL else self.table.tsVec[s.value])
            return " ".join(names)

        def input_rest_to_str(ids: List[int], start: int) -> str:
            return " ".join(self.table.tsVec[i] for i in ids[start:])

        while stack:
            top = stack[-1]
            lookahead = input_ids[ip]

            pila_str = stack_to_str(stack)
            entrada_str = input_rest_to_str(input_ids, ip)

            if top.type == TERMINAL:
                top_name = self.table.tsVec[top.value]
                la_name = self.table.tsVec[lookahead]

                if top.value == lookahead or top_name == "''":
                    # Match
                    print(
                        pad(pila_str, width_pila)
                        + pad(entrada_str, width_entrada)
                        + pad(f"Match: {top_name}", width_regla)
                    )
                    stack.pop()
                    # Avanzar input salvo epsilon
                    if top_name != "''":
                        ip += 1
                else:
                    print(f"[Parser] Error: esperaba '{top_name}' pero llegó '{la_name}'")
                    return False
            else:
                key = (top.value, lookahead)
                if key not in self.table.parserTable:
                    print(f"[Parser] Error: no hay regla para {self.table.ntsVec[top.value]} con lookahead={self.table.tsVec[lookahead]}")
                    return False

                stack.pop()
                rhs = self.table.parserTable[key]  # list[Symbol]

                # Construir RHS en texto
                if not rhs:
                    rhs_str = "ε"
                else:
                    parts = []
                    for s in rhs:
                        parts.append(self.table.ntsVec[s.value] if s.type == NONTERMINAL else self.table.tsVec[s.value])
                    rhs_str = " ".join(parts)

                print(
                    pad(pila_str, width_pila)
                    + pad(entrada_str, width_entrada)
                    + pad(f"{self.table.ntsVec[top.value]} -> {rhs_str}", width_regla)
                )

                # Apilar RHS en orden inverso
                for s in reversed(rhs):
                    stack.append(s)

        if ip == len(input_ids):
            print("\n[Parser] Análisis exitoso ")
            return True
        else:
            print("\n[Parser] Error sintactico ")
            return False


"""
from __future__ import annotations
from typing import Optional

from token_ import Token            # Ojo: si tu archivo se llama token.py, esto funciona.
from scanner import Scanner
from ast_ import (                  # Ajusta el import según tu estructura real
    Program, Stm, Exp,
    AssignStm, PrintStm,
    WhileStm, IfStm, SwitchStm, CaseStm,
    BinaryExp, NumberExp, SqrtExp, IdExp, MonoExp,
    BinaryOp, AND_OP, OR_OP, LE_OP, RE_OP, PLUS_OP, MINUS_OP, MUL_OP, DIV_OP, POW_OP
)


class Parser:
    def __init__(self, sc: Scanner) -> None:
        self.scanner: Scanner = sc
        self.previous: Optional[Token] = None
        self.current: Token = self.scanner.nextToken()
        if self.current.type == Token.ERR:
            raise RuntimeError("Error léxico")

    # -------- utilidades de consumo de tokens --------
    def match(self, ttype: int) -> bool:
        if self.check(ttype):
            self.advance()
            return True
        return False

    def check(self, ttype: int) -> bool:
        if self.isAtEnd():
            return False
        return self.current.type == ttype

    def advance(self) -> bool:
        if not self.isAtEnd():
            self.previous = self.current
            self.current = self.scanner.nextToken()
            if self.check(Token.ERR):
                raise RuntimeError("Error lexico")
            return True
        return False

    def isAtEnd(self) -> bool:
        return self.current.type == Token.END

    # -------- reglas gramaticales --------
    def parseProgram(self) -> Program:
        p = Program()
        p.add(self.parseStm())
        while self.match(Token.SEMICOL):
            p.add(self.parseStm())
        if not self.isAtEnd():
            raise RuntimeError("Error sintáctico")
        print("Parseo exitoso")
        return p

    def parseStm(self) -> Stm:
        # asignación: ID '=' AE
        if self.match(Token.ID):
            variable = self.previous.text
            self.match(Token.ASSIGN)
            e = self.parseAE()
            return AssignStm(variable, e)

        # print: 'print' '(' AE ')'
        elif self.match(Token.PRINT):
            self.match(Token.LPAREN)
            e = self.parseAE()
            self.match(Token.RPAREN)
            return PrintStm(e)

        # while: 'while' AE 'do' stm (';' stm)* 'endwhile'
        elif self.match(Token.WHILE):
            e = self.parseAE()
            w = WhileStm(e)
            self.match(Token.DO)
            w.slist1.append(self.parseStm())
            while self.match(Token.SEMICOL):
                w.slist1.append(self.parseStm())
            self.match(Token.ENDWHILE)
            return w

        # if: 'if' AE 'then' stm (';' stm)* ('else' stm (';' stm)*)? 'endif'
        elif self.match(Token.IF):
            e = self.parseAE()
            node = IfStm(e)
            self.match(Token.THEN)

            node.slist1.append(self.parseStm())
            while self.match(Token.SEMICOL):
                node.slist1.append(self.parseStm())

            if self.match(Token.ELSE):
                node.parteelse = True
                node.slist2.append(self.parseStm())
                while self.match(Token.SEMICOL):
                    node.slist2.append(self.parseStm())

            self.match(Token.ENDIF)
            return node

        # switch/case:
        # 'switch' AE ( 'case' AE ':' stm (';' stm)* )+ ('default' ':' stm (';' stm)*)? 'endswitch'
        elif self.match(Token.SWITCH):
            e = self.parseAE()
            sw = SwitchStm(e)

            self.match(Token.CASE)
            f = self.parseAE()
            self.match(Token.COLON)

            c = CaseStm(f)
            c.slist.append(self.parseStm())
            while self.match(Token.SEMICOL):
                c.slist.append(self.parseStm())
            sw.slist.append(c)

            while self.match(Token.CASE):
                f = self.parseAE()
                self.match(Token.COLON)

                c = CaseStm(f)
                c.slist.append(self.parseStm())
                while self.match(Token.SEMICOL):
                    c.slist.append(self.parseStm())
                sw.slist.append(c)

            if self.match(Token.DEFAULT):
                self.match(Token.COLON)
                sw.deflist.append(self.parseStm())
                while self.match(Token.SEMICOL):
                    sw.deflist.append(self.parseStm())

            self.match(Token.ENDSWITCH)
            return sw

        else:
            raise RuntimeError("Error sintáctico")

    # AE -> BE ((AND|OR) BE)?
    def parseAE(self) -> Exp:
        l = self.parseBE()
        if self.match(Token.AND) or self.match(Token.OR):
            if self.previous.type == Token.AND:
                op = AND_OP
            else:
                op = OR_OP
            r = self.parseBE()
            l = BinaryExp(l, r, op)
        return l

    # BE -> CE ((LE|RE) CE)?
    def parseBE(self) -> Exp:
        l = self.parseCE()
        if self.match(Token.LE) or self.match(Token.RE):
            if self.previous.type == Token.LE:
                op = LE_OP
            else:
                op = RE_OP
            r = self.parseCE()
            l = BinaryExp(l, r, op)
        return l

    # CE -> DE ((PLUS|MINUS) DE)*
    def parseCE(self) -> Exp:
        l = self.parseDE()
        while self.match(Token.PLUS) or self.match(Token.MINUS):
            op = PLUS_OP if self.previous.type == Token.PLUS else MINUS_OP
            r = self.parseDE()
            l = BinaryExp(l, r, op)
        return l

    # DE -> T ((MUL|DIV) T)*
    def parseDE(self) -> Exp:
        l = self.parseT()
        while self.match(Token.MUL) or self.match(Token.DIV):
            op = MUL_OP if self.previous.type == Token.MUL else DIV_OP
            r = self.parseT()
            l = BinaryExp(l, r, op)
        return l

    # E -> T ((MUL|DIV) T)*   (parece duplicar DE en tu código; lo conservo por compatibilidad)
    def parseE(self) -> Exp:
        l = self.parseT()
        while self.match(Token.MUL) or self.match(Token.DIV):
            op = MUL_OP if self.previous.type == Token.MUL else DIV_OP
            r = self.parseT()
            l = BinaryExp(l, r, op)
        return l

    # T -> F (POW F)?
    def parseT(self) -> Exp:
        l = self.parseF()
        if self.match(Token.POW):
            r = self.parseF()
            l = BinaryExp(l, r, POW_OP)
        return l

    # F -> NUM | '(' CE ')' | SQRT '(' AE ')' | ID | TRUE | FALSE | NOT '(' AE ')'
    def parseF(self) -> Exp:
        if self.match(Token.NUM):
            return NumberExp(int(self.previous.text))

        elif self.match(Token.LPAREN):
            e = self.parseCE()
            self.match(Token.RPAREN)
            return e

        elif self.match(Token.SQRT):
            self.match(Token.LPAREN)
            e = self.parseAE()
            self.match(Token.RPAREN)
            return SqrtExp(e)

        elif self.match(Token.ID):
            return IdExp(self.previous.text)

        elif self.match(Token.TRUE):
            return NumberExp(1)

        elif self.match(Token.FALSE):
            return NumberExp(0)

        elif self.match(Token.NOT):
            self.match(Token.LPAREN)
            e = self.parseAE()
            self.match(Token.RPAREN)
            return MonoExp(e, True)

        else:
            raise RuntimeError("Error sintáctico")
"""