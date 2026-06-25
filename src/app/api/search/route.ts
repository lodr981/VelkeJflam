import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const q: string = (body?.q ?? "").trim();
  const machine: string = (body?.machine ?? "").trim();

  if (!q && !machine) {
    return NextResponse.json({ machines: [], entries: [] });
  }

  // Stroje odpovídající hledání (pro rychlé otevření a zápis).
  const machineWhere = q || machine;
  const machines = machineWhere
    ? await prisma.machine.findMany({
        where: {
          retired: false,
          name: { contains: machineWhere, mode: "insensitive" },
        },
        select: {
          id: true,
          name: true,
          _count: { select: { entries: true } },
        },
        take: 25,
        orderBy: { name: "asc" },
      })
    : [];

  // Poruchy odpovídající textu (v popisu, řešení nebo podle opraváře),
  // volitelně omezené na stroj.
  const andFilters: object[] = [{ machine: { retired: false } }];
  if (q) {
    andFilters.push({
      OR: [
        { problem: { contains: q, mode: "insensitive" } },
        { solution: { contains: q, mode: "insensitive" } },
        { repairer: { contains: q, mode: "insensitive" } },
        { reporter: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (machine) {
    andFilters.push({ machine: { name: { contains: machine, mode: "insensitive" } } });
  }

  const entries = await prisma.logEntry.findMany({
    where: andFilters.length ? { AND: andFilters } : {},
    select: {
      id: true,
      occurredAt: true,
      problem: true,
      solution: true,
      repairer: true,
      reporter: true,
      downtimeMinutes: true,
      machine: { select: { id: true, name: true } },
    },
    orderBy: { occurredAt: "desc" },
    take: 60,
  });

  return NextResponse.json({ machines, entries });
}
