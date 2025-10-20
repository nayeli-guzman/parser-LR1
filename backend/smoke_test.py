# smoke_test.py
from lr1 import LR1Builder, LR1Parser, END, print_lr1_tables
from first import First
from follow import Follow
from grammar import Grammar

# Puedes escribir terminales con o sin comillas; el builder normaliza.
nonterm = {"S","C"}
term = {"c","d"}  

rules = [
    "S  -> C C",
    "C -> c C",
    "C  -> d"
]

start = "S"

gramatica = Grammar()
gfile = "inputs/input-1.txt"
if not gramatica.loadFromFile(gfile):
    print("Error al cargar la gramática.")
    
print("=== Gramática cargada ===")
gramatica.print()

primeros = First(gramatica)
primeros.compute()
print("\n=== Conjuntos First ===")
primeros.print()

siguientes = Follow(gramatica, primeros)
siguientes.compute()
print("\n=== Conjuntos Follow ===")
siguientes.print()

b = LR1Builder(nonterm, term, rules, start, primeros.firstSets)
p = LR1Parser(b)

print_lr1_tables(b, show_states=True)

# Prueba de parseo
tokens = ["c","d","d", END]
print("OK?", p.parse(tokens))
