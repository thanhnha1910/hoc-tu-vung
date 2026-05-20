import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const sb = await createSupabaseServerClient();
  await sb.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
