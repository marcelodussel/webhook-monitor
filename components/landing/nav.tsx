"use client";

import Link from "next/link";
import { ArrowRight, Code2, Menu, Webhook } from "lucide-react";
import { APP_NAME, GITHUB_REPO_URL } from "@/lib/config";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LANDING_SECTION_PAD } from "./constants";

const navLinks = [
  { href: "#architecture", label: "Architecture" },
  { href: "#features", label: "Features" },
  { href: "#decisions", label: "Engineering" },
  { href: "#stack", label: "Stack" },
] as const;

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className={`mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 ${LANDING_SECTION_PAD}`}>
        <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 ring-1 ring-primary/40">
            <Webhook className="h-4 w-4 text-primary" />
          </span>
          <span className="truncate font-mono text-sm font-semibold tracking-tight">
            {APP_NAME.toLowerCase()}
            <span className="text-primary">/</span>
            <span className="text-muted-foreground">infra</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          {navLinks.map((item) => (
            <a key={item.href} href={item.href} className="hover:text-foreground">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          {GITHUB_REPO_URL ? (
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 rounded-md border border-border bg-card/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              <Code2 className="h-3.5 w-3.5" /> Source
            </a>
          ) : null}
          <Dialog>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open section menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="gap-0 p-0 sm:max-w-md">
              <DialogHeader className="border-b border-border px-6 pb-4 pt-6 text-left">
                <DialogTitle className="font-mono text-base">Jump to section</DialogTitle>
              </DialogHeader>
              <nav className="flex flex-col px-2 py-2">
                {navLinks.map((item) => (
                  <DialogClose asChild key={item.href}>
                    <a
                      href={item.href}
                      className="rounded-md px-4 py-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      {item.label}
                    </a>
                  </DialogClose>
                ))}
                {GITHUB_REPO_URL ? (
                  <DialogClose asChild>
                    <a
                      href={GITHUB_REPO_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-md px-4 py-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground sm:hidden"
                    >
                      <Code2 className="h-4 w-4 shrink-0" /> Source on GitHub
                    </a>
                  </DialogClose>
                ) : null}
              </nav>
            </DialogContent>
          </Dialog>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <span className="hidden min-[380px]:inline">Open dashboard</span>
            <span className="min-[380px]:hidden">Dashboard</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </header>
  );
}
