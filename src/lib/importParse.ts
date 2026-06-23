import * as XLSX from "xlsx";

export type FieldMap = {
  occurredAt?: string | null;
  endDate?: string | null;
  problem?: string | null;
  solution?: string | null;
  downtimeMinutes?: string | null;
  technician?: string | null;
  machine?: string | null;
  cause?: string | null;
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
  problem: /probl[ée]m|z[áa]vad|porucha|popis|popis pozadav|description|fault|issue|chyba/i,
  solution:
    /[řr]e[šs]en|oprav|n[áa]prav|solution|fix|action|z[áa]sah|provedeno|repair|udrzba|[úu]dr[žz]b/i,
  date: /za[čc][áa]tek|datum|date|den|kdy|start|[čc]as|cas|time/i,
  endDate: /konec|end|ukon[čc]/i,
  downtime: /prostoj|odst[áa]vk|downtime|doba prostoj|duration|trv[áa]n/i,
  technician: /technik|opravil|kdo|technician|jm[ée]no|jmeno|operator|prov[áa]d|zadavatel/i,
  // Nejdřív čitelný název stroje (Nazev stroj / machine name / resource),
  // teprve potom obecné (aby nevyhrálo číselné "SAP stroj").
  machine: /n[áa]zev.*stroj|stroj.*n[áa]zev|machine.*name|name.*machine|resource|za[řr][íi]zen[íi]/i,
  machineFallback: /stroj|machine|equip|asset|linka/i,
  cause: /p[řr][íi][čc]in|cause|d[ůu]vod|root/i,
};

/** Záložní rozpoznání sloupců podle názvů (když AI není k dispozici). */
export function heuristicMap(headers: string[]): FieldMap {
  const find = (rx: RegExp) => headers.find((h) => rx.test(h)) ?? null;
  return {
    problem: find(RX.problem),
    solution: find(RX.solution),
    occurredAt: find(RX.date),
    endDate: find(RX.endDate),
    downtimeMinutes: find(RX.downtime),
    technician: find(RX.technician),
    machine: find(RX.machine) ?? find(RX.machineFallback),
    cause: find(RX.cause),
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

/** Z buňky typu "01/11/2024 03:04:05 - (OP014026): Vypalena spirala" nechá jen text. */
export function cleanPrefix(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  const m = s.match(/^.*?\(\w+\):\s*([\s\S]*)$/);
  const out = (m ? m[1] : s).trim();
  return out || null;
}

/** Parsuje datum i s časem (Date, dd/mm/rrrr hh:mm:ss, dd.mm.rrrr, ISO). */
export function parseDateTime(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  const s = String(value).trim();
  const m = s.match(
    /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (m) {
    const [, d, mo, y, hh, mi, ss] = m;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const dt = new Date(
      year,
      Number(mo) - 1,
      Number(d),
      Number(hh ?? 0),
      Number(mi ?? 0),
      Number(ss ?? 0)
    );
    if (!isNaN(dt.getTime())) return dt;
  }
  const iso = new Date(s);
  return isNaN(iso.getTime()) ? null : iso;
}

function sheetToTable(ws: XLSX.WorkSheet): ParsedSheet {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
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

export type PickedSheet = ParsedSheet & { sheetName: string };

/** Z celého sešitu vybere list, který vypadá jako log poruch (sloupec stroj + problém,
 *  s nejvíc řádky). Přeskočí pivoty, grafy a souhrny. */
export function pickBreakdownSheet(buf: Buffer): PickedSheet | null {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  let best: PickedSheet | null = null;
  let bestScore = 0;
  for (const name of wb.SheetNames) {
    const table = sheetToTable(wb.Sheets[name]);
    if (table.rows.length === 0) continue;
    const map = heuristicMap(table.headers);
    if (map.machine && map.problem && table.rows.length > bestScore) {
      bestScore = table.rows.length;
      best = { sheetName: name, ...table };
    }
  }
  return best;
}

export type BreakdownRow = {
  machineName: string;
  problem: string;
  solution: string | null;
  downtimeMinutes: number | null;
  technician: string | null;
  occurredAt?: Date;
};

/** Z řádků + mapování udělá záznamy poruch i s názvem stroje (pro hromadný import). */
export function buildBreakdownRows(
  rows: Record<string, unknown>[],
  map: FieldMap
): BreakdownRow[] {
  const out: BreakdownRow[] = [];
  for (const row of rows) {
    const machineName = map.machine ? String(row[map.machine] ?? "").trim() : "";
    if (!machineName) continue;

    const problem = map.problem ? cleanPrefix(row[map.problem]) : null;
    if (!problem) continue;

    const cause = map.cause ? String(row[map.cause] ?? "").trim() : "";
    const start = map.occurredAt ? parseDateTime(row[map.occurredAt]) : null;
    const end = map.endDate ? parseDateTime(row[map.endDate]) : null;

    // Prostoj: přímo ze sloupce, jinak dopočítat z konce – začátku.
    let downtime = map.downtimeMinutes ? toInt(row[map.downtimeMinutes]) : null;
    if ((downtime == null || downtime === 0) && start && end) {
      const diff = Math.round((end.getTime() - start.getTime()) / 60000);
      if (diff > 0 && diff < 60 * 24 * 14) downtime = diff;
    }

    out.push({
      machineName,
      problem: cause ? `${problem} · příčina: ${cause}` : problem,
      solution: map.solution ? cleanPrefix(row[map.solution]) : null,
      downtimeMinutes: downtime,
      technician: map.technician
        ? String(row[map.technician] ?? "").trim() || null
        : null,
      ...(start ? { occurredAt: start } : {}),
    });
  }
  return out;
}
