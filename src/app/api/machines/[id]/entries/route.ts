import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { structureLogEntry } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const machine = await prisma.machine.findUnique({ where: { id: params.id } });
  if (!machine) {
    return NextResponse.json({ error: "Stroj nenalezen." }, { status: 404 });
  }

  let data = {
    problem: body.problem?.trim() || "",
    solution: body.solution?.trim() || null,
    partsCost: body.partsCost != null && body.partsCost !== "" ? Number(body.partsCost) : null,
    downtimeMinutes:
      body.downtimeMinutes != null && body.downtimeMinutes !== ""
        ? Number(body.downtimeMinutes)
        : null,
    technician: body.technician?.trim() || null,
  };

  // Hlasový / volný zápis: pole `rawText` necháme strukturovat AI.
  if (body.rawText && typeof body.rawText === "string" && body.rawText.trim()) {
    const structured = await structureLogEntry(body.rawText.trim());
    data = { ...data, ...structured };
  }

  if (!data.problem) {
    return NextResponse.json({ error: "Popis problému je povinný." }, { status: 400 });
  }

  const entry = await prisma.logEntry.create({
    data: {
      machineId: params.id,
      problem: data.problem,
      solution: data.solution,
      partsCost: Number.isFinite(data.partsCost) ? data.partsCost : null,
      downtimeMinutes: Number.isFinite(data.downtimeMinutes) ? data.downtimeMinutes : null,
      technician: data.technician,
      occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
    },
  });

  await prisma.machine.update({
    where: { id: params.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json(entry, { status: 201 });
}
