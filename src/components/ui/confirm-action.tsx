"use client";

import { useRef, type ReactNode } from "react";
import { Button } from "./button";
import { SubmitButton } from "./submit-button";

/**
 * Knop met bevestigingsvenster die daarna een server action uitvoert.
 * Verborgen velden worden meegestuurd met het formulier.
 */
export function ConfirmAction({
  action,
  fields,
  trigger,
  title,
  description,
  confirmLabel,
  variant = "secondary",
  confirmVariant = "danger",
  disabled,
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  variant?: "secondary" | "danger" | "ghost";
  confirmVariant?: "danger" | "primary";
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <Button variant={variant} onClick={() => ref.current?.showModal()} disabled={disabled}>
        {trigger}
      </Button>
      <dialog
        ref={ref}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl p-0 shadow-xl backdrop:bg-navy-950/50"
        aria-labelledby="confirm-title"
      >
        <form action={action} className="p-6">
          {Object.entries(fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <h2 id="confirm-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <div className="mt-2 text-sm text-slate-600">{description}</div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => ref.current?.close()}>
              Annuleren
            </Button>
            <SubmitButton variant={confirmVariant} pendingText="Bezig…">
              {confirmLabel}
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
