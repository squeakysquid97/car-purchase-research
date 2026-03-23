type Severity = "low" | "medium" | "high" | "catastrophic" | null;

type SeverityBadgeProps = {
  severity: Severity;
};

function getSeverityClasses(severity: Severity) {
  switch (severity) {
    case "low":
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-100";
    case "medium":
      return "border-amber-400/30 bg-amber-500/10 text-amber-100";
    case "high":
      return "border-orange-400/30 bg-orange-500/10 text-orange-100";
    case "catastrophic":
      return "border-red-400/35 bg-red-500/10 text-red-100";
    default:
      return "border-white/20 bg-white/5 text-white/75";
  }
}

function formatSeverity(severity: Severity) {
  if (!severity) return "Unknown";
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

export default function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${getSeverityClasses(
        severity
      )}`}
    >
      {formatSeverity(severity)}
    </span>
  );
}
