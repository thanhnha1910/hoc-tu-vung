import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LoginLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const sb = await createSupabaseServerClient();
  const { data } = await sb.auth.getUser();

  if (data.user) redirect("/decks");

  return children;
}
