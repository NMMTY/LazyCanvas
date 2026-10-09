import getNavigation from "@/app/utils/getNavigation";
import { NextResponse } from "next/server";

// Built once: the navigation comes from files that are not available at request time.
export const dynamic = "force-static";

export async function GET() {
  const navigation = getNavigation();
  return NextResponse.json(navigation);
}
