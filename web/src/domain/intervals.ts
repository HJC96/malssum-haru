// 절 단위 집합 연산의 바탕. 한 책 안의 절을 0부터 매긴 순번으로 보고, 반열린 구간 [start, end)로 다룬다.

/** [start, end) 반열린 구간. start < end. */
export type Interval = readonly [number, number];

/** 정렬되고 서로 겹치거나 맞닿지 않은 구간 목록. */
export type IntervalList = ReadonlyArray<Interval>;

export function normalizeIntervals(input: ReadonlyArray<Interval>): Interval[] {
  const sorted = input.filter(([s, e]) => s < e).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out: Array<[number, number]> = [];
  for (const [s, e] of sorted) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) {
      if (e > last[1]) last[1] = e;
    } else {
      out.push([s, e]);
    }
  }
  return out;
}

export function unionIntervals(a: IntervalList, b: IntervalList): Interval[] {
  return normalizeIntervals([...a, ...b]);
}

export function subtractIntervals(a: IntervalList, b: IntervalList): Interval[] {
  const out: Interval[] = [];
  let j = 0;
  for (const [as, ae] of a) {
    let cursor = as;
    while (j < b.length && (b[j] as Interval)[1] <= cursor) j++;
    let k = j;
    while (k < b.length && (b[k] as Interval)[0] < ae) {
      const [bs, be] = b[k] as Interval;
      if (bs > cursor) out.push([cursor, bs]);
      cursor = Math.max(cursor, be);
      if (cursor >= ae) break;
      k++;
    }
    if (cursor < ae) out.push([cursor, ae]);
  }
  return out;
}

export function intersectIntervals(a: IntervalList, b: IntervalList): Interval[] {
  const out: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const [as, ae] = a[i] as Interval;
    const [bs, be] = b[j] as Interval;
    const s = Math.max(as, bs);
    const e = Math.min(ae, be);
    if (s < e) out.push([s, e]);
    if (ae < be) i++;
    else j++;
  }
  return out;
}

export function countIntervals(list: IntervalList): number {
  let n = 0;
  for (const [s, e] of list) n += e - s;
  return n;
}
