import Image from "next/image";
import Link from "next/link";

/** Compact logo (officieel beeldmerk + woordmerk). Verhoudingen blijven behouden. */
export function BrandMark({ inverted = false, href = "/dashboard" }: { inverted?: boolean; href?: string }) {
  return (
    <Link href={href} className="flex items-center" aria-label="BouwFlow — naar dashboard">
      <Image
        src={inverted ? "/brand/bouwflow-compact-dark.png" : "/brand/bouwflow-compact-light.png"}
        alt="BouwFlow"
        width={inverted ? 777 : 796}
        height={160}
        className="h-9 w-auto"
        priority
      />
    </Link>
  );
}

/** Alleen het beeldmerk, voor kleine ruimtes (mobiele topbalk). */
export function BrandIcon({ className = "size-9" }: { className?: string }) {
  return <Image src="/brand/icon-192.png" alt="BouwFlow" width={192} height={192} className={`${className} rounded-lg`} priority />;
}
