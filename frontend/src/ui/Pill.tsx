const Pill = ({ children, tone = "gray" }: { children: React.ReactNode; tone?: "gray"|"blue"|"green"|"purple" }) => {
  const tones: Record<string,string> = {
    gray:   "bg-gray-50 text-gray-700 border-gray-200",
    blue:   "bg-blue-50 text-blue-700 border-blue-200",
    green:  "bg-emerald-50 text-emerald-700 border-emerald-200",
    purple: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  };
  return <span className={`px-2 py-1 rounded-full text-xs border ${tones[tone]}`}>{children}</span>;
};