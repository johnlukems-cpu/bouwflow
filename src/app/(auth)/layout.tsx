import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-navy-900 p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-brand-600/20 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-accent-500/15 blur-3xl" aria-hidden />
        <Image src="/brand/bouwflow-compact-dark.png" alt="BouwFlow" width={777} height={160} className="relative h-10 w-auto" priority />
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">Van calculatie tot na-calculatie in één platform.</h2>
          <p className="mt-4 text-white/70">
            Beheer klanten, projecten, offertes, werkbonnen en facturen — en zie per project direct wat begroot is en wat het werkelijk kost.
          </p>
        </div>
        <p className="relative text-sm font-medium tracking-wide text-white/60">Projecten in vertrouwen.</p>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <Image src="/brand/bouwflow-logo-light.png" alt="BouwFlow — Projecten in vertrouwen." width={1161} height={998} className="mx-auto mb-6 h-auto w-44" priority />
          {children}
        </div>
      </div>
    </div>
  );
}
