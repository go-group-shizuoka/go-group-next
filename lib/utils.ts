// ==================== 共通ユーティリティ ====================
// 各ページで重複していた小さな関数・定数をここに集約する

/**
 * 今日の日付を YYYY-MM-DD 形式で返す
 * 例: "2026-04-28"
 */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 現在時刻を HH:MM 形式で返す
 * 例: "09:30"
 */
export function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * 過去N月の選択肢を新しい順に返す
 * 例: [{ year: 2026, month: 4, label: "2026年4月" }, ...]
 */
export function genMonths(count = 12): { year: number; month: number; label: string }[] {
  const months: { year: number; month: number; label: string }[] = [];
  const d = new Date();
  for (let i = 0; i < count; i++) {
    months.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: `${d.getFullYear()}年${d.getMonth() + 1}月`,
    });
    d.setMonth(d.getMonth() - 1);
  }
  return months;
}

/**
 * 日本語曜日配列（日曜始まり）
 * new Date().getDay() のインデックスに対応
 * 例: DOW[0] → "日", DOW[1] → "月"
 */
export const DOW = ["日", "月", "火", "水", "木", "金", "土"] as const;
