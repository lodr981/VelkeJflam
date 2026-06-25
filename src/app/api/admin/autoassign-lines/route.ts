import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Mrtvé linky, které se už neprovozují → vyřadit. */
function isDeadLine(name: string): boolean {
  const n = name.toLowerCase();
  return /\ba6\b/.test(n) || /br223/.test(n);
}

/** Odvodí linku z názvu stroje (SEAU, L663, UKL, Vstřikovna UAP1). */
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
  const machines = await prisma.machine.findMany({
    select: { id: true, name: true, line: true, retired: true },
  });

  const assigned: Record<string, number> = {};
  let retiredCount = 0;
  let leftNull = 0;

  for (const m of machines) {
    // Mrtvé linky (A6, BR223) → vyřadit.
    if (isDeadLine(m.name)) {
      if (!m.retired) {
        await prisma.machine.update({ where: { id: m.id }, data: { retired: true } });
        retiredCount++;
      }
      continue;
    }
    // Ostatní: doplnit linku, pokud ještě nemá (ruční nepřepisujeme).
    if (m.line == null) {
      const line = lineFromName(m.name);
      if (line) {
        await prisma.machine.update({ where: { id: m.id }, data: { line } });
        assigned[line] = (assigned[line] ?? 0) + 1;
      } else {
        leftNull++;
      }
    }
  }

  return NextResponse.json({
    assigned,
    retired: retiredCount,
    leftNull,
  });
}
