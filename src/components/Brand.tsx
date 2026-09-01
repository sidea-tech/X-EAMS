import { APP_NAME } from "@/lib/appConfig";

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-xl bg-brand text-brand-fg"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path
          d="M12 7v5.2l3.4 2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark size={34} />
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-tight">{APP_NAME}</p>
        <p className="text-[11px] text-muted">{subtitle ?? "Attendance"}</p>
      </div>
    </div>
  );
}
