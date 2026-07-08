export type Rect = { x: number; y: number; w: number; h: number };

/** Squarified treemap – z hodnot udělá obdélníky v ploše width×height (v %),
 *  ve stejném pořadí jako vstup. Používá se pro dlaždice kategorií. */
export function squarify(values: number[], width: number, height: number): Rect[] {
  const out: Rect[] = new Array(values.length).fill(null).map(() => ({ x: 0, y: 0, w: 0, h: 0 }));
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const area = width * height;
  const items = values.map((v, i) => ({ a: (v / total) * area, i }));

  let c = { x: 0, y: 0, w: width, h: height };

  function worst(row: { a: number }[], side: number) {
    if (!row.length) return Infinity;
    const sum = row.reduce((s, r) => s + r.a, 0);
    const max = Math.max(...row.map((r) => r.a));
    const min = Math.min(...row.map((r) => r.a));
    const s2 = sum * sum;
    return Math.max((side * side * max) / s2, s2 / (side * side * min));
  }

  function place(row: { a: number; i: number }[]) {
    const sum = row.reduce((s, r) => s + r.a, 0);
    if (c.w >= c.h) {
      const rw = sum / c.h;
      let yy = c.y;
      for (const r of row) {
        const rh = r.a / rw;
        out[r.i] = { x: c.x, y: yy, w: rw, h: rh };
        yy += rh;
      }
      c = { x: c.x + rw, y: c.y, w: c.w - rw, h: c.h };
    } else {
      const rh = sum / c.w;
      let xx = c.x;
      for (const r of row) {
        const rw = r.a / rh;
        out[r.i] = { x: xx, y: c.y, w: rw, h: rh };
        xx += rw;
      }
      c = { x: c.x, y: c.y + rh, w: c.w, h: c.h - rh };
    }
  }

  let row: { a: number; i: number }[] = [];
  for (let idx = 0; idx < items.length; ) {
    const side = Math.min(c.w, c.h);
    const next = items[idx];
    if (row.length === 0 || worst(row, side) >= worst([...row, next], side)) {
      row.push(next);
      idx++;
    } else {
      place(row);
      row = [];
    }
  }
  if (row.length) place(row);
  return out;
}
