export default function FollowsTable({ data }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-neutral-700 text-left">
            <th className="px-3 py-2 font-semibold">Nonterminal</th>
            <th className="px-3 py-2 font-semibold">FOLLOW</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={idx}
              className={idx % 2 === 0 ? "bg-neutral-800" : "bg-neutral-900"}
            >
              <td className="px-3 py-2 font-medium">{row.nonterminal}</td>
              <td className="px-3 py-2 text-blue-300">{`{${row.follow}}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
