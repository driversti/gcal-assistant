import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  return (
    <div className="flex h-screen flex-col">
      <Header email={session.email} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
