import { useEffect, useState } from "react";
import { Github, Sigma, Menu, Sparkles } from "lucide-react";

type Props = {
  EPS?: string;
  END?: string;
  repoUrl?: string;
};

export default function VisualHeaderBasic({
  EPS = "ε",
  END = "$",
  repoUrl,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => setMounted(true), []);

  const zoom =
    "transform-gpu transition-transform duration-150 ease-out hover:scale-105 active:scale-95 motion-reduce:transform-none motion-reduce:transition-none";

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      {/* Accent bar */}
      <div className="relative h-0.5 w-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500" />
      </div>

      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between py-3">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <button
              aria-label="Abrir menú"
              className={`md:hidden p-2 rounded-xl border border-gray-200 hover:bg-gray-100 ${zoom}`}
              onClick={() => setOpen((v) => !v)}
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="relative">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-blue-500/20 to-fuchsia-500/20 blur" />
              <div className="relative flex items-center gap-2 rounded-2xl px-3 py-2 bg-white/80 border border-gray-200 shadow-sm">
                <Sigma className="w-5 h-5" />
                <span className="font-semibold tracking-tight">
                  LR(1) Parser
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5 border border-blue-400/40 bg-blue-50">
                  <Sparkles className="w-3.5 h-3.5" /> v0.1
                </span>
              </div>
            </div>
          </div>

          {/* Right: chips + repo (en la misma línea) */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Chip label={`ε = "${EPS}"`} />
              <Chip label={`end = "${END}"`} />
            </div>

            {repoUrl ? (
              <a
                href={repoUrl}
                target="_blank"
                rel="noreferrer"
                className={`px-3 py-1.5 rounded-xl border border-gray-200 text-sm inline-flex items-center gap-2 hover:bg-gray-100 ${zoom}`}
              >
                <Github className="w-4 h-4" /> Repo
              </a>
            ) : (
              <span className="px-3 py-1.5 rounded-xl border border-gray-200 text-sm inline-flex items-center gap-2 opacity-60 cursor-not-allowed">
                <Github className="w-4 h-4" /> Repo
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Mobile drawer: muestra chips y repo juntos */}
      {mounted && open && (
        <div className="md:hidden border-t border-gray-200 bg-white/90">
          <div className="max-w-6xl mx-auto px-4 py-3 grid gap-3">
            <div className="flex items-center gap-2">
              <Chip label={`ε = "${EPS}"`} />
              <Chip label={`end = "${END}"`} />
            </div>
            <a
              href={repoUrl || undefined}
              target="_blank"
              rel="noreferrer"
              className={`w-full px-3 py-2 rounded-xl border text-left flex items-center gap-2 hover:bg-gray-100 ${zoom} ${
                repoUrl
                  ? "border-gray-200"
                  : "border-gray-200 opacity-60 pointer-events-none"
              }`}
              onClick={() => setOpen(false)}
            >
              <Github className="w-4 h-4" /> Repo
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border border-gray-200 bg-white/70">
      {label}
    </span>
  );
}
