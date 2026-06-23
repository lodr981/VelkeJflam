import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  pickBreakdownSheet,
  heuristicMap,
  buildBreakdownRows,
  type FieldMap,
} from "@/lib/importParse";
import { aiColumnMap } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export async function POST(req: NextRequest) {
  try {
    let form: FormData;
    try {
      form = await req.formData();
    } catch (e) {
      console.error("formData selhalo:", e);
      return NextResponse.json(
        {
          error:
            "Soubor se nepodařilo nahrát (nejspíš příliš velký upload). Zkus nahrát jen list Databaze jako menší .xlsx.",
        },
        { status: 413 }
      );
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Chybí soubor." }, { status: 400 });
    }
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      return NextResponse.json(
        { error: "Povolené formáty: .xlsx, .xls, .csv" },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Soubor je větší než 25 MB." },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const picked = pickBreakdownSheet(buf);
    if (!picked) {
      return NextResponse.json(
        {
          error:
            "Nepodařilo se najít list se sloupci pro stroj a popis poruchy. Zkontroluj, že tabulka má sloupec s názvem stroje a s popisem závady.",
        },
        { status: 422 }
      );
    }

    // Sloupce přiřadí AI; když selže, použije se heuristika.
    let map: FieldMap | null = null;
    try {
      map = await aiColumnMap(picked.headers, picked.rows.slice(0, 5));
    } catch {
      /* fallback níže */
    }
    if (!map || !map.machine || !map.problem) {
      map = heuristicMap(picked.headers);
    }

    const breakdownRows = buildBreakdownRows(picked.rows, map);
    if (breakdownRows.length === 0) {
      return NextResponse.json(
        { error: "Nepodařilo se přečíst žádný použitelný řádek (stroj + popis)." },
        { status: 422 }
      );
    }

    // Seskup podle stroje.
    const byMachine = new Map<string, typeof breakdownRows>();
    for (const r of breakdownRows) {
      const list = byMachine.get(r.machineName) ?? [];
      list.push(r);
      byMachine.set(r.machineName, list);
    }
    const names = [...byMachine.keys()];

    // Najdi existující stroje podle názvu, chybějící vytvoř.
    const existing = await prisma.machine.findMany({
      where: { name: { in: names } },
      select: { id: true, name: true },
    });
    const idByName = new Map(existing.map((m) => [m.name, m.id]));
    let createdMachines = 0;
    for (const name of names) {
      if (!idByName.has(name)) {
        const m = await prisma.machine.create({ data: { name } });
        idByName.set(name, m.id);
        createdMachines++;
      }
    }

    // Vlož všechny záznamy poruch po dávkách (kvůli limitům a paměti).
    const data = breakdownRows.map((r) => ({
      machineId: idByName.get(r.machineName)!,
      problem: r.problem,
      solution: r.solution,
      downtimeMinutes: r.downtimeMinutes,
      technician: r.technician,
      ...(r.occurredAt ? { occurredAt: r.occurredAt } : {}),
    }));
    const BATCH = 500;
    for (let i = 0; i < data.length; i += BATCH) {
      await prisma.logEntry.createMany({ data: data.slice(i, i + BATCH) });
    }

    return NextResponse.json({
      sheet: picked.sheetName,
      machinesTotal: names.length,
      machinesCreated: createdMachines,
      entries: data.length,
      mapping: map,
    });
  } catch (err) {
    console.error("Hromadný import selhal:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Import selhal: ${msg.slice(0, 300)}` },
      { status: 500 }
    );
  }
}
