import { NextRequest, NextResponse } from "next/server";
import { categoryReport, categoryToContext } from "@/lib/faultCategory";
import { askPlant, aiErrorMessage } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const line = typeof body?.line === "string" && body.line ? body.line : null;

  const report = await categoryReport(line);
  if (report.totalCount === 0) {
    return NextResponse.json({ error: "Žádné poruchy k vyhodnocení." }, { status: 404 });
  }

  const context = categoryToContext(report, line);
  const scope = line ? `linky ${line}` : "celého závodu";
  const question =
    `Jsi vedoucí údržby. Na základě rozdělení poruch do kategorií pro ${scope} napiš stručné shrnutí: ` +
    "které kategorie závad jsou nejdražší na prostoj, kde je vidět rostoucí trend (a je tedy potřeba zakročit), " +
    "a 3 konkrétní preventivní doporučení (co držet skladem, co plánovaně měnit, kde hledat kořenovou příčinu). Buď věcný a krátký.";

  try {
    const answer = await askPlant(context, [], question);
    return NextResponse.json({ answer });
  } catch (err) {
    console.error("Kategorie AI chyba:", err);
    return NextResponse.json({ error: aiErrorMessage(err) }, { status: 502 });
  }
}
