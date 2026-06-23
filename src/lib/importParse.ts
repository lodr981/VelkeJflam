import * as XLSX from "xlsx";

export type FieldMap = {
  occurredAt?: string | null;
  problem?: string | null;
  solution?: string | null;
  downtimeMinutes?: string | null;
  technician?: string | null;
};

export type ParsedSheet = {
  headers: string[];
  rows: Record<string, unknown>[];
};

/** Přečte .xlsx / .xls / .csv z bufferu na hlavičky + řádky. */
export function parseSpreadsheet(buf: Buffer, isCsv = false): ParsedSheet {
  // CSV: čteme jako UTF-8 text a NEcháme datumy jako řetězce (parsujeme si je sami
  //   v parseDate jako dd.mm.rrrr – jinak SheetJS prohazuje den/měsíc po americku).
  // XLSX: datové buňky jsou seriály, proto cellDates: true.
  const wb = isCsv
    ? XLSX.read(buf.toString("utf8"), { type: "string", raw: true })
    : XLSX.read(buf, { type: "buffer", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { headers: [], rows: [] };

  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    blankrows: false,
  });
  if (aoa.length === 0) return { headers: [], rows: [] };

  const headers = (aoa[0] as unknown[]).map((h) => String(h ?? "").trim());
  const rows = aoa.slice(1).map((r) => {
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (h) row[h] = (r as unknown[])[i] ?? null;
    });
    return row;
  });
  return { headers, rows };
}

const RX = {
  problem: /probl[ée]m|z[áa]vad|porucha|popis|description|fault|issue|chyba/i,
  solution:
    /[řr]e[šs]en|oprav|n[áa]prav|solution|fix|action|z[áa]sah|provedeno|repair/i,
  date: /datum|date|den|kdy|čas|cas|time/i,
  downtime: /prostoj|odst[áa]vk|downtime|min|doba/i,
  technician: /technik|opravil|kdo|technician|jm[ée]no|jmeno|operator|prov[áa]d/i,
};

/** Záložní rozpoznání sloupců podle názvů (když AI není k dispozici). */
export function heuristicMap(headers: string[]): FieldMap {
  const find = (rx: RegExp) => headers.find((h) => rx.test(h)) ?? null;
  return {
    problem: find(RX.problem),
    solution: find(RX.solution),
    occurredAt: find(RX.date),
    downtimeMinutes: find(RX.downtime),
    technician: find(RX.technician),
  };
}

/** Zkusí rozparsovat datum z různých formátů (Date, ISO, dd.mm.rrrr, dd/mm/rrrr). */
export function parseDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value;

  const s = String(value).trim();
  // dd.mm.yyyy nebo dd/mm/yyyy (i s časem)
  const m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/);
  if (m) {
    let [, d, mo, y] = m;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const dt = new Date(year, Number(mo) - 1, Number(d));
    if (!isNaN(dt.getTime())) return dt;
  }
  const iso = new Date(s);
  return isNaN(iso.getTime()) ? null : iso;
}

function toInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = parseInt(String(value).replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

export type EntryCreate = {
  problem: string;
  solution: string | null;
  downtimeMinutes: number | null;
  technician: string | null;
  occurredAt?: Date;
};

/** Z řádků + mapování sloupců sestaví záznamy poruch k uložení. */
export function buildEntries(
  rows: Record<string, unknown>[],
  map: FieldMap
): EntryCreate[] {
  const out: EntryCreate[] = [];
  for (const row of rows) {
    const problemRaw = map.problem ? row[map.problem] : null;
    const problem = problemRaw == null ? "" : String(problemRaw).trim();
    if (!problem) continue; // řádek bez popisu problému přeskočíme

    const solutionRaw = map.solution ? row[map.solution] : null;
    const techRaw = map.technician ? row[map.technician] : null;
    const date = map.occurredAt ? parseDate(row[map.occurredAt]) : null;

    out.push({
      problem,
      solution: solutionRaw ? String(solutionRaw).trim() : null,
      downtimeMinutes: map.downtimeMinutes ? toInt(row[map.downtimeMinutes]) : null,
      technician: techRaw ? String(techRaw).trim() : null,
      ...(date ? { occurredAt: date } : {}),
    });
  }
  return out;
}
