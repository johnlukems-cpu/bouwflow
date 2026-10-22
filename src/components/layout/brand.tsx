import Image from "next/image";
import Link from "next/link";

export function BrandMark({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5" aria-label="BouwFlow — naar dashboard">
      <span className="flex size-9 items-center justify-center overflow-hidden rounded-lg bg-white p-0.5 ring-1 ring-white/20">
        <Image src="/brand/bouwflow-icon.png" alt="" width={32} height={32} priority />
      </span>
      <span className="text-lg font-bold tracking-tight">
        <span className={inverted ? "text-white" : "text-navy-900"}>Bouw</span>
        <span className="text-accent-500">Flow</span>
      </span>
    </Link>
  );
}
