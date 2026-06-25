import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Odvodí linku z názvu stroje (podle linek: SEAU, L663, UKL, Vstřikovna UAP1). */
function lineFromName(name: string): string | null {
  const n = name.toLowerCase();
  if (/l663/.test(n)) return "L663";
  if (/\bukl\b|ukl/.test(n)) return "UKL";
  if (/seau/.test(n)) return "SEAU";
  if (/\bimm\b|^e0\d|^km0\d|engel|krauss|vst[rř]ik/.test(n))
    return "Vstřikovna UAP1";
  return null;
}

export async function POST() {
  // Pouze stroje BEZ linky (ruční přiřazení nepřepisujeme).
  const machines = await prisma.machine.findMany({
    where: { line: null },
    select: { id: true, name: true },
  });

  const counts: Record<string, number> = {};
  let leftNull = 0;

  for (const m of machines) {
    const line = lineFromName(m.name);
    if (line) {
      await prisma.machine.update({ where: { id: m.id }, data: { line } });
      counts[line] = (counts[line] ?? 0) + 1;
    } else {
      leftNull++;
    }
  }

  return NextResponse.json({
    processed: machines.length,
    assigned: counts,
    leftNull,
  });
}
