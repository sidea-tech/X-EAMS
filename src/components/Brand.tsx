import Image from "next/image";
import { APP_NAME } from "@/lib/appConfig";

/**
 * The company mark. The artwork already carries its own circular badge, so it is
 * rendered bare rather than inside a coloured tile.
 */
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <Image
      src="/Xicon.png"
      alt=""
      width={size}
      height={size}
      // Served in the sidebar of every page, so let it be cached eagerly.
      priority
      className="shrink-0 rounded-full"
    />
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
