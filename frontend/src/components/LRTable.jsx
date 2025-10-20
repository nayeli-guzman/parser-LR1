export default function LRTable({ data }) {
  return (
    <table className="w-full border border-neutral-700 text-sm rounded-lg overflow-hidden">
      <thead className="bg-neutral-700 text-gray-200">
        <tr>
          <th className="p-2">State</th>
          <th className="p-2">c</th>
          <th className="p-2">d</th>
          <th className="p-2">$</th>
          <th className="p-2">S</th>
          <th className="p-2">C</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr
            key={i}
            className={`${i % 2 === 0 ? "bg-neutral-800" : "bg-neutral-900"} hover:bg-neutral-700/50 transition`}
          >
            <td className="p-2 border border-neutral-700">{row.state}</td>
            <td className="p-2 border border-neutral-700">{row.action_c}</td>
            <td className="p-2 border border-neutral-700">{row.action_d}</td>
            <td className="p-2 border border-neutral-700">
              {row.accept ? "acc" : ""}
            </td>
            <td className="p-2 border border-neutral-700">{row.goto_S}</td>
            <td className="p-2 border border-neutral-700">{row.goto_C}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
