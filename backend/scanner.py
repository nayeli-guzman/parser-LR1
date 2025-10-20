# scanner.py
from __future__ import annotations
from pathlib import Path
from typing import Optional

from token_ import Token  # usamos el módulo renombrado

# ---------------------------------
# Funciones auxiliares
# ---------------------------------
def _is_white_space(c: str) -> bool:
    return c in (" ", "\n", "\r", "\t")


class Scanner:
    def __init__(self, in_s: str) -> None:
        self.input: str = in_s
        self.first: int = 0
        self.current: int = 0

    def nextToken(self) -> Token:
        # Saltar espacios
        n = len(self.input)
        while self.current < n and _is_white_space(self.input[self.current]):
            self.current += 1

        # Fin de la entrada
        if self.current >= n:
            return Token(Token.END)

        c = self.input[self.current]
        self.first = self.current

        # Números
        if c.isdigit():
            self.current += 1
            while self.current < n and self.input[self.current].isdigit():
                self.current += 1
            # substr(first, len) en C++; aquí usamos slicing [first:first+len]
            length = self.current - self.first
            return Token.from_slice(Token.NUM, self.input, self.first, length)

        # Identificadores / palabras clave
        if c.isalpha():
            self.current += 1
            while self.current < n and self.input[self.current].isalnum():
                self.current += 1
            lexema = self.input[self.first:self.current]

            # Palabras clave
            kw = {
                "sqrt": Token.SQRT,
                "print": Token.PRINT,
                "if": Token.IF,
                "while": Token.WHILE,
                "then": Token.THEN,
                "do": Token.DO,
                "endif": Token.ENDIF,
                "endwhile": Token.ENDWHILE,
                "else": Token.ELSE,
                "switch": Token.SWITCH,
                "endswitch": Token.ENDSWITCH,
                "case": Token.CASE,
                "default": Token.DEFAULT,
                "or": Token.OR,
                "and": Token.AND,
                "not": Token.NOT,
                "true": Token.TRUE,
                "false": Token.FALSE,
            }
            ttype = kw.get(lexema, Token.ID)
            length = self.current - self.first
            return Token.from_slice(ttype, self.input, self.first, length)

        # Operadores y signos
        if c in "+/-*();=<>:":
            # Atención especial a '**' (POW)
            if c == "*":
                # ¿Hay otro '*' seguido?
                if (self.current + 1) < n and self.input[self.current + 1] == "*":
                    # Avanza para incluir ambos '*'
                    self.current += 1  # ahora apunta al segundo '*'
                    # Texto desde first hasta current incluido
                    tok = Token.from_slice(Token.POW, self.input, self.first, (self.current + 1) - self.first)
                    self.current += 1  # consumir el segundo '*'
                    return tok
                else:
                    tok = Token.from_char(Token.MUL, "*")
                    self.current += 1
                    return tok

            # Otros signos (igual que el switch de C++)
            mapping = {
                "<": Token.LE,
                ">": Token.RE,
                "+": Token.PLUS,
                "-": Token.MINUS,
                "/": Token.DIV,
                "(": Token.LPAREN,
                ")": Token.RPAREN,
                "=": Token.ASSIGN,
                ";": Token.SEMICOL,
                ":": Token.COLON,
            }
            ttype = mapping.get(c)
            if ttype is not None:
                tok = Token.from_char(ttype, c)
                self.current += 1
                return tok

        # Carácter inválido
        self.current += 1
        return Token.from_char(Token.ERR, c)


# ---------------------------------
# Runner del scanner (genera archivo *_tokens.txt)
# ---------------------------------
def ejecutar_scanner(scanner: Scanner, InputFile: str) -> None:
    # Construir nombre del archivo de tokens como en C++:
    # "<ruta>/input1.txt" -> "<ruta>/input1_tokens.txt"
    input_path = Path(InputFile)
    stem = input_path.with_suffix("")  # quita la extensión
    out_path = Path(f"{stem}_tokens.txt")

    try:
        with out_path.open("w", encoding="utf-8") as out:
            out.write("Scanner\n\n")

            while True:
                tok = scanner.nextToken()

                out.write(str(tok) + "\n")

                if tok.type == Token.END:
                    out.write("\nScanner exitoso\n\n")
                    break

                if tok.type == Token.ERR:
                    out.write("Caracter invalido\n\n")
                    out.write("Scanner no exitoso\n\n")
                    break
    except OSError as e:
        # Comportamiento análogo al C++: reportar y salir de la función
        import sys
        print(f"Error: no se pudo abrir el archivo {out_path}: {e}", file=sys.stderr)
