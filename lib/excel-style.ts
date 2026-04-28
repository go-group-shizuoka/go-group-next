// ==================== Excel スタイル共通定義 ====================
// xlsx-js-style 用の共通スタイル定数・ヘルパー
// shift / attendance / billing の Excel出力で使用

/** セル枠線の1辺（薄いグレー） */
export const xlsThin = { style: "thin", color: { rgb: "CCCCCC" } };

/** セルの四辺全てに薄枠線を付けるスタイル */
export const xlsBorder = {
  top:    xlsThin,
  left:   xlsThin,
  bottom: xlsThin,
  right:  xlsThin,
};

/**
 * 列番号（1始まり）を列名（A, B, ..., Z, AA, ...）に変換する
 * 例: colName(1) → "A",  colName(26) → "Z",  colName(27) → "AA"
 */
export function colName(n: number): string {
  let s = "";
  let nn = n;
  while (nn > 0) {
    nn--;
    s = String.fromCharCode(65 + (nn % 26)) + s;
    nn = Math.floor(nn / 26);
  }
  return s;
}
