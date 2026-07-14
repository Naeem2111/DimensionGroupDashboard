import Image from "next/image";
import Link from "next/link";
import { brandAssets } from "@/lib/blocharch-brand";

type Props = {
  className?: string;
  compact?: boolean;
  /** Vertical, centered — for login */
  variant?: "row" | "stack";
};

/** Blocharch logo + Console label. */
export function BrandMark({ className = "", compact = false, variant = "row" }: Props) {
  const stack = variant === "stack";

  return (
    <Link
      href="/dashboard"
      className={`group flex rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)] ${
        stack ? "flex-col items-center gap-3 text-center" : "flex-col gap-1.5 items-start"
      } ${className}`}
    >
      <Image
        src={brandAssets.logo}
        alt="Dimension Group"
        width={100}
        height={100}
        priority
        className={
          stack
            ? "h-20 w-20 max-h-[5.5rem] max-w-[5.5rem] object-contain dark:mix-blend-normal"
            : "h-10 w-10 object-contain object-left dark:mix-blend-normal"
        }
      />
      {!compact && (
        <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Console
        </span>
      )}
    </Link>
  );
}
