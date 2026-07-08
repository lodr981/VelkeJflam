import { NextRequest, NextResponse } from "next/server";
import { lastDaysReport, reportToContext } from "@/lib/report";
import { askPlant, aiErrorMessage } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const days = Number(body?.days) > 0 ? Math.min(Number(body.days), 60) : 5;

  const report = await lastDaysReport(days);
  if (report.total === 0) {
    return NextResponse.json({ error: "V daném období nejsou žádné poruchy." }, { status: 404 });
  }

  const context = reportToContext(report);
  const question =
    "Napiš stručné manažerské shrnutí posledních dní pro vedoucího údržby: " +
    "co se dělo, kde byl největší prostoj (linka i stroj), nejčastější příčiny, " +
    "a 2–3 konkrétní doporučení, na co se zaměřit. Buď věcný.";

  try {
    const answer = await askPlant(context, [], question);
    return NextResponse.json({ answer });
  } catch (err) {
    console.error("Report AI chyba:", err);
    return NextResponse.json({ error: aiErrorMessage(err) }, { status: 502 });
  }
}
