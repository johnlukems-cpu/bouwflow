import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-navy-900 p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-brand-600/20 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-accent-500/15 blur-3xl" aria-hidden />
        <p className="relative text-2xl font-bold">
          Bouw<span className="text-accent-500">Flow</span>
        </p>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">Van calculatie tot na-calculatie in één platform.</h2>
          <p className="mt-4 text-white/70">
            Beheer klanten, projecten, offertes, werkbonnen en facturen — en zie per project direct wat begroot is en wat het werkelijk kost.
          </p>
        </div>
        <p className="relative text-sm text-white/40">Projecten in vertrouwen</p>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <Image src="/brand/bouwflow-logo.png" alt="BouwFlow — projecten in vertrouwen" width={180} height={180} className="mx-auto mb-6 h-auto w-40" priority />
          {children}
        </div>
      </div>
    </div>
  );
}
