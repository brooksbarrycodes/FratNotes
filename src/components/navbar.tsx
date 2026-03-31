"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Highlighter } from "~/components/ui/highlighter";
import { cn } from "~/lib/utils";

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 border-b border-sky/10 bg-cream/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-display text-2xl font-bold text-dark">
            <Highlighter action="highlight" color="#87CEFA" strokeWidth={2} padding={4}>
              FratNotes
            </Highlighter>
          </span>
        </Link>

        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className={cn(
              "font-body text-sm font-medium transition-colors hover:text-flame",
              pathname === "/dashboard" ? "text-flame" : "text-dark/60",
            )}
          >
            My Notes
          </Link>
          <span className="rounded-xl bg-flame px-4 py-2 font-display text-sm font-semibold text-white shadow-md shadow-flame/20">
            Guest Mode
          </span>
        </div>
      </div>
    </nav>
  );
}
