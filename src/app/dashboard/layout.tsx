import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  return (
    <div className="flex h-screen flex-col">
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
