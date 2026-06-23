import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  parseSpreadsheet,
  heuristicMap,
  buildEntries,
  type FieldMap,
} from "@/lib/importParse";
import { aiColumnMap } from "@/lib/ai";
import { getUploadedFile } from "@/lib/files";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const machine = await prisma.machine.findUnique({ where: { id: params.id } });
  if (!machine) {
    return NextResponse.json({ error: "Stroj nenalezen." }, { status: 404 });
  }

  const form = await req.formData();
  const file = getUploadedFile(form.get("file"));
  if (!file) {
    return NextResponse.json({ error: "Chybí soubor." }, { status: 400 });
  }
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
    return NextResponse.json(
      { error: "Povolené formáty: .xlsx, .xls, .csv" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Soubor je větší než 10 MB." }, { status: 400 });
  }

  let parsed;
  try {
    const isCsv = /\.csv$/i.test(file.name);
    parsed = parseSpreadsheet(Buffer.from(await file.arrayBuffer()), isCsv);
  } catch (err) {
    console.error("Parse chyba:", err);
    return NextResponse.json({ error: "Soubor se nepodařilo přečíst." }, { status: 400 });
  }

  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: "Soubor neobsahuje žádné řádky." }, { status: 400 });
  }

  // Sloupce přiřadí AI; když selže (chybí klíč apod.), použije se heuristika.
  let map: FieldMap | null = null;
  try {
    map = await aiColumnMap(parsed.headers, parsed.rows);
  } catch (err) {
    console.error("AI mapování selhalo, jedu heuristikou:", err);
  }
  if (!map || !map.problem) {
    map = heuristicMap(parsed.headers);
  }

  if (!map.problem) {
    return NextResponse.json(
      {
        error:
          "Nepodařilo se najít sloupec s popisem poruchy. Zkontroluj, že tabulka má sloupec jako Problém / Závada / Popis.",
        headers: parsed.headers,
      },
      { status: 422 }
    );
  }

  const entries = buildEntries(parsed.rows, map);
  if (entries.length === 0) {
    return NextResponse.json(
      { error: "Žádný řádek neměl vyplněný popis poruchy." },
      { status: 422 }
    );
  }

  await prisma.logEntry.createMany({
    data: entries.map((e) => ({ ...e, machineId: params.id })),
  });

  await prisma.machine.update({
    where: { id: params.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({
    imported: entries.length,
    totalRows: parsed.rows.length,
    skipped: parsed.rows.length - entries.length,
    mapping: map,
  });
}
