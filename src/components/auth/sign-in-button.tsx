"use client";

import { buttonVariants } from "@/components/ui/button";
import { Calendar } from "lucide-react";

export function SignInButton() {
  return (
    <a href="/api/auth/google" className={buttonVariants({ size: "lg" })}>
      <Calendar className="mr-2 h-5 w-5" />
      Sign in with Google
    </a>
  );
}
