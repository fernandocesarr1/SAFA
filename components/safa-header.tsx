import Link from "next/link";
import { BarChart3, BookOpenCheck, Building2, GitCompareArrows, Workflow } from "lucide-react";

const navItems = [
  { href: "/", label: "Painel", icon: BarChart3 },
  { href: "/#fila", label: "Fila", icon: Building2 },
  { href: "/operacao", label: "Operação", icon: Workflow },
  { href: "/comparador", label: "Comparador", icon: GitCompareArrows },
  { href: "/metodologia", label: "Método", icon: BookOpenCheck },
];

export function SafaHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-[#07111f]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between gap-5 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="SAFA — início">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-teal-300/20 bg-teal-300/10 font-serif text-lg font-semibold text-teal-100 shadow-[0_0_24px_rgba(45,212,191,0.08)]">
            S
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold tracking-[0.22em] text-white">SAFA</span>
            <span className="hidden truncate text-[11px] text-slate-400 sm:block">Sistema de Análise de FIIs e Ações</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1" aria-label="Navegação principal">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-slate-300 transition hover:bg-white/6 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/60"
            >
              <Icon className="size-4" aria-hidden="true" />
              <span className={label === "Fila" || label === "Método" ? "hidden md:inline" : label === "Operação" ? "hidden sm:inline" : "inline"}>{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
