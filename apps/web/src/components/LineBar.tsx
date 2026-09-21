/**
 * 一根爻。阳爻一整条，阴爻中断成两段（像铜钱的方孔）。动爻用朱砂色。
 */
export function LineBar({ yang, moving = false, size = "md" }: { yang: boolean; moving?: boolean; size?: "sm" | "md" }) {
  const h = size === "sm" ? "h-2" : "h-2.5";
  const w = size === "sm" ? "w-14" : "w-20";
  const color = moving ? "bg-cinnabar" : "bg-brass";
  return (
    <span className={`inline-flex ${w} ${h} shrink-0 items-stretch gap-[18%]`} aria-label={yang ? "阳" : "阴"}>
      {yang ? <span className={`flex-1 rounded-[1px] ${color}`} /> : (
        <>
          <span className={`flex-1 rounded-[1px] ${color}`} />
          <span className={`flex-1 rounded-[1px] ${color}`} />
        </>
      )}
    </span>
  );
}
