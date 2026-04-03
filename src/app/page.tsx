import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { SignInButton } from "@/components/auth/sign-in-button";
import { Calendar } from "lucide-react";

export default async function Home() {
  const session = await getSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="flex items-center gap-3">
          <Calendar className="h-10 w-10" />
          <h1 className="text-4xl font-bold tracking-tight">GCA</h1>
        </div>
        <p className="max-w-md text-lg text-muted-foreground">
          Google Calendar Assistant — compare events, find duplicates, and
          manage your calendars from a single dashboard.
        </p>
        <SignInButton />
      </div>
    </div>
  );
}
