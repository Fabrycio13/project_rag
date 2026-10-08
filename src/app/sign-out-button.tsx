"use client";

import { SignOutButton as ClerkSignOutButton } from "@clerk/nextjs";

export function SignOutButton({ label = "Sair" }: { label?: string }) {
  return (
    <ClerkSignOutButton redirectUrl="/sign-in">
      <button
        className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-blue-500/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
        type="button"
      >
        {label}
      </button>
    </ClerkSignOutButton>
  );
}
