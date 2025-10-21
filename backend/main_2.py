from __future__ import annotations
from pathlib import Path

from grammar import Grammar
from first import First
from follow import Follow

from table import Table
from parser import LL1Parser


def main() -> int:
    
    # ====================================================
    # 1. Cargar la gramática desde archivo
    # ====================================================
    gramatica = Grammar()
    gfile = "gramatica.txt"
    if not gramatica.loadFromFile(gfile):
        print("Error al cargar la gramática.")
        return 1

    print("=== Gramática cargada ===")
    gramatica.print()

    # ====================================================
    # 2. Calcular conjuntos First
    # ====================================================
    primeros = First(gramatica)
    primeros.compute()
    print("\n=== Conjuntos First ===")
    primeros.print()

    # ====================================================
    # 3. Calcular conjuntos Follow
    # ====================================================
    siguientes = Follow(gramatica, primeros)
    siguientes.compute()
    print("\n=== Conjuntos Follow ===")
    siguientes.print()

    # ====================================================
    # 4. Construir tabla LL(1)
    # ====================================================
    tablapredictiva = Table(gramatica, primeros, siguientes)
    print("\n=== Tabla LL(1) ===")
    tablapredictiva.print()

    # ====================================================
    # 5. Inicializar parser y parsear entrada
    # ====================================================
    start_id = tablapredictiva.getNonTerminalId(gramatica.initialState)
    parser = LL1Parser(tablapredictiva, start_id)

    # Entrada tokenizada (terminales según la gramática)
    # entrada = ["1", "3", "$"]
    entrada = ["1", "+", "1", "*", "1", "$"]

    print("\n=== Parseando entrada ===")
    ok = parser.parse(entrada)
    print(f"Resultado del parseo: {ok}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""
from __future__ import annotations
import sys
from pathlib import Path

from scanner import Scanner, ejecutar_scanner
from parser import Parser
from ast_ import Program  # noqa: F401  # Solo para indicar que existe
#from visitor import PrintVisitor, EVALVisitor
"""

"""
def leer_archivo_completo(ruta: Path) -> str:
"""
"""Lee todo el archivo y devuelve su contenido como string."""
"""
    try:
        return ruta.read_text(encoding="utf-8")
    except FileNotFoundError:
        print(f"No se pudo abrir el archivo: {ruta}")
        sys.exit(1)
    except OSError as e:
        print(f"Error al leer el archivo '{ruta}': {e}")
        sys.exit(1)


def main(argv: list[str]) -> int:
    # Verificar número de argumentos
    if len(argv) != 2:
        prog = Path(argv[0]).name if argv else "programa"
        print("Número incorrecto de argumentos.")
        print(f"Uso: {prog} <archivo_de_entrada>")
        return 1

    ruta = Path(argv[1])

    # Leer contenido completo del archivo
    input_text = leer_archivo_completo(ruta)

    # Crear instancias de Scanner
    scanner1 = Scanner(input_text)
    scanner2 = Scanner(input_text)

    # Tokens
    ejecutar_scanner(scanner1, str(ruta))

    # Crear instancia de Parser
    parser = Parser(scanner2)

    # Parsear y generar AST
    ast = None
    try:
        ast = parser.parseProgram()
    except Exception as e:
        # Equivalente a `cerr << "Error al parsear: " << e.what()`
        print(f"Error al parsear: {e}")
        ast = None

    # Visitas
    # impresion = PrintVisitor()
    # impresion.imprimir(ast)

    # interprete = EVALVisitor()
    # interprete.interprete(ast)

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
"""