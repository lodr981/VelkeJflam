import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Odstraní duplicitní poruchy (stejný stroj + čas + problém + řešení),
 *  ponechá vždy jednu (s nejnižším id). */
export async function POST() {
  const before = await prisma.logEntry.count();

  const removed = await prisma.$executeRawUnsafe(`
    DELETE FROM "LogEntry" a
    USING "LogEntry" b
    WHERE a."id" > b."id"
      AND a."machineId" = b."machineId"
      AND a."occurredAt" = b."occurredAt"
      AND a."problem" = b."problem"
      AND COALESCE(a."solution", '') = COALESCE(b."solution", '')
  `);

  const after = await prisma.logEntry.count();

  return NextResponse.json({
    before,
    after,
    removed: typeof removed === "number" ? removed : before - after,
  });
}
