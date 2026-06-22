import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const machines = await prisma.machine.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { entries: true } } },
  });
  return NextResponse.json(machines);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body?.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "Název stroje je povinný." }, { status: 400 });
  }
  const machine = await prisma.machine.create({
    data: {
      name: body.name.trim(),
      type: body.type?.trim() || null,
      manufacturer: body.manufacturer?.trim() || null,
      year: body.year ? Number(body.year) : null,
      location: body.location?.trim() || null,
      manualText: body.manualText?.trim() || null,
      notes: body.notes?.trim() || null,
    },
  });
  return NextResponse.json(machine, { status: 201 });
}
