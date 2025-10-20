export default function FirstTable({ data }) {
  return (
    <table className="w-full border border-neutral-700 text-sm rounded-lg overflow-hidden">
      <thead className="bg-neutral-700 text-gray-200">
        <tr>
          <th className="p-2 text-left">Nonterminal</th>
          <th className="p-2 text-left">FIRST</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr
            key={i}
            className={`${i % 2 === 0 ? "bg-neutral-800" : "bg-neutral-900"} hover:bg-neutral-700/50 transition`}
          >
            <td className="p-2 border border-neutral-700">{row.nonterminal}</td>
            <td className="p-2 border border-neutral-700">{row.first}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
