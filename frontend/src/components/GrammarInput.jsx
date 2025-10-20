import { useState } from "react";

export default function GrammarInput({ onSubmit }) {
  const [grammar, setGrammar] = useState(`S' -> S
S -> C C
C -> c C
C -> d`);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(grammar);
  };

  return (
    <div className="bg-neutral-800 p-6 rounded-2xl shadow-md border border-neutral-700 w-full max-w-3xl mb-8">
      <h2 className="text-blue-300 font-semibold mb-3">Input Grammar</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          value={grammar}
          onChange={(e) => setGrammar(e.target.value)}
          className="w-full h-32 p-3 rounded-lg bg-neutral-900 border border-neutral-700 text-gray-100 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="self-end bg-blue-600 hover:bg-blue-700 transition-colors text-white px-4 py-2 rounded-lg font-medium"
        >
          Parse Grammar
        </button>
      </form>
    </div>
  );
}
