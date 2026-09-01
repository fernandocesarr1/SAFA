import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const labels: Record<string, string> = {
  backlog: "Na fila",
  research: "Em pesquisa",
  first_review: "1ª revisão",
  second_review: "2ª revisão",
  completed: "Concluída",
  blocked: "Bloqueada",
  pending: "Pendente",
  in_progress: "Em andamento",
  complete: "Concluído",
};

const styles: Record<string, string> = {
  backlog: "border-slate-700 bg-slate-800/70 text-slate-300",
  pending: "border-slate-700 bg-slate-800/70 text-slate-300",
  research: "border-cyan-400/25 bg-cyan-400/10 text-cyan-200",
  in_progress: "border-cyan-400/25 bg-cyan-400/10 text-cyan-200",
  first_review: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  second_review: "border-violet-400/25 bg-violet-400/10 text-violet-200",
  completed: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  complete: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  blocked: "border-rose-400/25 bg-rose-400/10 text-rose-200",
};

export function StatusPill({ status, className }: { status: string | null; className?: string }) {
  const key = status ?? "backlog";
  return (
    <Badge variant="outline" className={cn("font-normal", styles[key] ?? styles.backlog, className)}>
      {labels[key] ?? key}
    </Badge>
  );
}

