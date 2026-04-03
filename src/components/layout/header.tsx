"use client";

import { Button } from "@/components/ui/button";
import { Calendar, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function Header({ email }: { email: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      <div className="flex items-center gap-2 font-semibold">
        <Calendar className="h-5 w-5" />
        <span>GCA</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">{email}</span>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </header>
  );
}
