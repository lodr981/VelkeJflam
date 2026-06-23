import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { askFleet, aiErrorMessage } from "@/lib/ai";

export const dynamic = "force-dynamic";

const MAX_MACHINES = 40;
const ENTRIES_PER_MACHINE = 80;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const filter = body?.filter?.trim();
  const question = body?.question?.trim();
  if (!filter) {
    return NextResponse.json({ error: "Zadej filtr (např. FOAMFLEX)." }, { status: 400 });
  }
  if (!question) {
    return NextResponse.json({ error: "Dotaz je prázdný." }, { status: 400 });
  }

  const machines = await prisma.machine.findMany({
    where: { name: { contains: filter, mode: "insensitive" } },
    take: MAX_MACHINES,
    orderBy: { name: "asc" },
    include: {
      entries: { orderBy: { occurredAt: "desc" }, take: ENTRIES_PER_MACHINE },
    },
  });

  if (machines.length === 0) {
    return NextResponse.json(
      { error: `Žádný stroj neodpovídá filtru „${filter}".` },
      { status: 404 }
    );
  }

  const history = Array.isArray(body.history)
    ? body.history
        .filter(
          (m: unknown): m is { role: string; content: string } =>
            !!m &&
            typeof (m as { content?: unknown }).content === "string" &&
            ((m as { role?: unknown }).role === "user" ||
              (m as { role?: unknown }).role === "assistant")
        )
        .slice(-8)
    : [];

  const fleet = machines.map((m) => ({
    name: m.name,
    entries: m.entries.map((e) => ({
      occurredAt: e.occurredAt,
      problem: e.problem,
      solution: e.solution,
      downtimeMinutes: e.downtimeMinutes,
    })),
  }));

  try {
    const answer = await askFleet(fleet, filter, history, question);
    return NextResponse.json({
      answer,
      machineCount: machines.length,
      machineNames: machines.map((m) => m.name),
    });
  } catch (err) {
    console.error("Fleet AI chyba:", err);
    return NextResponse.json({ error: aiErrorMessage(err) }, { status: 502 });
  }
}
