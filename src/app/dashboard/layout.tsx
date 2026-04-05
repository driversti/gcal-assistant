import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  return <main className="mx-auto h-screen w-full max-w-[1024px] overflow-hidden bg-gradient-to-b from-background to-muted">{children}</main>;
}
