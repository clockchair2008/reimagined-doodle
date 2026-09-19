// Round to 2 decimals (halalas) so stored line amounts and document totals always agree.
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
