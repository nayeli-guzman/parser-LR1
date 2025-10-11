import os
import sys
import subprocess
import shutil
from pathlib import Path

# Rutas base
ROOT = Path(__file__).parent.resolve()
INPUT_DIR = ROOT / "inputs"
OUTPUT_DIR = ROOT / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)

PYTHON = sys.executable or "python"
MAIN = ROOT / "main.py"  # tu entrypoint en Python

def have_graphviz_dot() -> bool:
    return shutil.which("dot") is not None

def run_case(i: int) -> None:
    filename = f"input-{i}.txt"
    filepath = INPUT_DIR / filename

    if not filepath.is_file():
        print(f"{filename} no encontrado en {INPUT_DIR}")
        return

    print(f"Ejecutando {filename}")
    run_cmd = [PYTHON, str(MAIN), str(filepath)]
    result = subprocess.run(run_cmd, capture_output=True, text=True)

    # Guardar stdout y stderr
    output_file = OUTPUT_DIR / f"output{i}.txt"
    with output_file.open("w", encoding="utf-8") as f:
        f.write("=== STDOUT ===\n")
        f.write(result.stdout)
        f.write("\n=== STDERR ===\n")
        f.write(result.stderr)

    # ⬇️ FIX 1 + FIX 2: el tokens sale en inputs y se llama input-{i}_tokens.txt
    tokens_file = INPUT_DIR / f"input-{i}_tokens.txt"
    ast_file = ROOT / "ast.dot"

    # Mover tokens si existe
    if tokens_file.is_file():
        dest_tokens = OUTPUT_DIR / f"tokens_{i}.txt"
        try:
            # si ya existe, lo reemplazamos
            if dest_tokens.exists():
                dest_tokens.unlink()
            shutil.move(str(tokens_file), str(dest_tokens))
        except Exception as e:
            print(f"No se pudo mover tokens: {e}")

    # Mover y convertir AST si existe
    if ast_file.is_file():
        dest_ast = OUTPUT_DIR / f"ast_{i}.dot"
        try:
            shutil.move(str(ast_file), str(dest_ast))
        except Exception as e:
            print(f"No se pudo mover AST: {e}")
            dest_ast = None

        # Convertir a PNG si Graphviz está disponible
        if dest_ast and have_graphviz_dot():
            output_img = OUTPUT_DIR / f"ast_{i}.png"
            dot_cmd = ["dot", "-Tpng", str(dest_ast), "-o", str(output_img)]
            dot_res = subprocess.run(dot_cmd, capture_output=True, text=True)
            if dot_res.returncode != 0:
                print("Error al convertir DOT a PNG:\n", dot_res.stderr)
        elif dest_ast:
            print("Graphviz 'dot' no encontrado: omito la conversión a PNG.")

def main():
    # Verificaciones básicas
    if not MAIN.is_file():
        print(f"No se encontró {MAIN}. Ajusta la ruta a tu main.py.")
        sys.exit(1)

    for i in range(1, 2):
        run_case(i)

    print("Listo. Revisa la carpeta:", OUTPUT_DIR)

if __name__ == "__main__":
    main()
