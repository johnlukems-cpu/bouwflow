import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

const control =
  "block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-500 disabled:bg-slate-100 disabled:text-slate-500";
const invalid = "ring-red-400 focus:ring-red-500";

interface FieldProps {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({ label, name, error, hint, required, className, children }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span className="ml-0.5 text-red-600" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

type ControlExtra = { error?: string };

export function Input({ className, error, name, ...props }: ComponentProps<"input"> & ControlExtra) {
  return (
    <input
      id={name}
      name={name}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${name}-error` : undefined}
      className={cn(control, "h-10", error && invalid, className)}
      {...props}
    />
  );
}

export function Select({ className, error, name, ...props }: ComponentProps<"select"> & ControlExtra) {
  return (
    <select
      id={name}
      name={name}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${name}-error` : undefined}
      className={cn(control, "h-10 pr-8", error && invalid, className)}
      {...props}
    />
  );
}

export function Textarea({ className, error, name, ...props }: ComponentProps<"textarea"> & ControlExtra) {
  return (
    <textarea
      id={name}
      name={name}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${name}-error` : undefined}
      className={cn(control, "min-h-24", error && invalid, className)}
      {...props}
    />
  );
}

export function FormAlert({ message, tone = "error" }: { message?: string; tone?: "error" | "info" }) {
  if (!message) return null;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg px-4 py-3 text-sm",
        tone === "error" ? "bg-red-50 text-red-800 ring-1 ring-red-200" : "bg-brand-50 text-brand-700 ring-1 ring-brand-200",
      )}
    >
      {message}
    </div>
  );
}
