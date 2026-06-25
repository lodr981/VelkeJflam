import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json().catch(() => ({}));
  const data: { line?: string | null; retired?: boolean } = {};

  if ("line" in body) {
    const line = typeof body.line === "string" ? body.line.trim() : "";
    data.line = line || null;
  }
  if ("retired" in body) {
    data.retired = !!body.retired;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nic k uložení." }, { status: 400 });
  }

  const machine = await prisma.machine.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(machine);
}
