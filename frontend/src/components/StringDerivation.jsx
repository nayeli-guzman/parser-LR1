export default function StringDerivation({ steps }) {
  return (
    <div className="overflow-x-auto">
      <h2 className="text-blue-300 font-semibold mb-2">String Derivation</h2>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-neutral-700 text-left">
            <th className="px-3 py-2 font-semibold">Step</th>
            <th className="px-3 py-2 font-semibold">Sentential Form</th>
            <th className="px-3 py-2 font-semibold">Production</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((s, idx) => (
            <tr
              key={idx}
              className={idx % 2 === 0 ? "bg-neutral-800" : "bg-neutral-900"}
            >
              <td className="px-3 py-2">{idx + 1}</td>
              <td className="px-3 py-2 font-mono">{s.form}</td>
              <td className="px-3 py-2 text-blue-300">{s.rule}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
