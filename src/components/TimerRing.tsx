interface Props {
  /** seconds remaining */
  value: number;
  /** total seconds */
  max: number;
  size?: number;
}
export const TimerRing = ({ value, max, size = 64 }: Props) => {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  const offset = circ * (1 - pct);
  const mins = Math.floor(value / 60);
  const secs = value % 60;
  const color = value <= 60 ? "hsl(var(--destructive))" : value <= 180 ? "hsl(var(--warning))" : "hsl(var(--success))";
  const isPulse = value <= 60 && value > 0;

  return (
    <div className={`relative inline-flex items-center justify-center ${isPulse ? "anim-pulse-ring" : ""}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--border))" strokeWidth={4} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-mono text-xs font-semibold tabular-nums">
        {mins}:{secs.toString().padStart(2, "0")}
      </div>
    </div>
  );
};
