// ==================== Supabaseクライアント ====================
// マルチテナント対応: org_id によるRLSフィルタリングを前提

import { createClient } from "@supabase/supabase-js";

// ビルド時に環境変数が未設定でも初期化エラーが出ないようフォールバック値を使用
// 実際のAPIコールはブラウザ側でのみ発生するため、Vercel上では本物の値が使われる
// 空文字列の場合も考慮して || を使用（?? は空文字列をfalsyとして扱わないため）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

// シングルトンパターン（ブラウザ側で1インスタンスのみ）
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 環境変数が未設定（プレースホルダー）の場合は false
export const isSupabaseReady =
  !supabaseUrl.includes("placeholder") && !supabaseAnonKey.includes("placeholder");

// ==================== 汎用CRUD関数 ====================

// タイムアウト付きfetch（Supabaseがハングした場合に5秒でフォールバック）
function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 5000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// データ取得（org_idでフィルタ）
export async function fetchByOrg<T>(table: string, org_id: string): Promise<T[]> {
  if (!isSupabaseReady) return [];
  try {
    const fetchPromise = supabase
      .from(table)
      .select("*")
      .eq("org_id", org_id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) { console.error(`fetchByOrg [${table}] error:`, error); return [] as T[]; }
        return (data as T[]) ?? [];
      });
    return await withTimeout(fetchPromise, []);
  } catch { return []; }
}

// データ取得（org_id + facility_idでフィルタ）
export async function fetchByFacility<T>(
  table: string,
  org_id: string,
  facility_id: string
): Promise<T[]> {
  if (!isSupabaseReady) return [];
  try {
    const fetchPromise = supabase
      .from(table)
      .select("*")
      .eq("org_id", org_id)
      .eq("facility_id", facility_id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) { console.error(`fetchByFacility [${table}] error:`, error); return [] as T[]; }
        return (data as T[]) ?? [];
      });
    return await withTimeout(fetchPromise, []);
  } catch { return []; }
}

// データ取得（org_id + facility_id + 日付でフィルタ）
export async function fetchByDate<T>(
  table: string,
  org_id: string,
  facility_id: string,
  date: string
): Promise<T[]> {
  if (!isSupabaseReady) return [];
  try {
    const fetchPromise = supabase
      .from(table)
      .select("*")
      .eq("org_id", org_id)
      .eq("facility_id", facility_id)
      .eq("date", date)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) { console.error(`fetchByDate [${table}] error:`, error); return [] as T[]; }
        return (data as T[]) ?? [];
      });
    return await withTimeout(fetchPromise, []);
  } catch { return []; }
}

// データ保存（upsert）
export async function saveRecord(table: string, data: Record<string, unknown>) {
  if (!isSupabaseReady) return;
  try {
    const { error } = await supabase
      .from(table)
      .upsert(data, { onConflict: "id" });
    if (error) { console.error(`saveRecord [${table}] error:`, error); throw error; }
  } catch (e) { throw e; }
}

// データ取得（org_id + facility_id + 追加フィルタ）
export async function fetchByFacilityWhere<T>(
  table: string,
  org_id: string,
  facility_id: string,
  extra: Record<string, unknown>
): Promise<T[]> {
  if (!isSupabaseReady) return [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from(table)
      .select("*")
      .eq("org_id", org_id)
      .eq("facility_id", facility_id);
    for (const [k, v] of Object.entries(extra)) {
      q = q.eq(k, v);
    }
    const fetchPromise = q.then(({ data, error }: { data: unknown; error: unknown }) => {
      if (error) { console.error(`fetchByFacilityWhere [${table}] error:`, error); return [] as T[]; }
      return (data as T[]) ?? [];
    });
    return await withTimeout(fetchPromise, []);
  } catch { return []; }
}

// データ削除
export async function deleteRecord(table: string, id: string) {
  if (!isSupabaseReady) return;
  try {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("id", id);
    if (error) { console.error(`deleteRecord [${table}] error:`, error); throw error; }
  } catch (e) { throw e; }
}

// ==================== 写真アップロード ====================

// Supabase Storageに写真をアップロードして公開URLを返す
// バケット名: "photos"（事前にSupabaseダッシュボードで作成が必要）
export async function uploadPhoto(
  file: File,
  path: string   // 例: "activities/org_1/2026-04-22_abc123.jpg"
): Promise<string | null> {
  const { error } = await supabase.storage
    .from("photos")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) {
    console.error("uploadPhoto error:", error);
    return null;
  }

  // 公開URLを取得
  const { data } = supabase.storage.from("photos").getPublicUrl(path);
  return data.publicUrl;
}

// ==================== JSONB正規化ユーティリティ ====================

// SupabaseのJSONBカラムを安全にstring[]に変換（非配列値でのクラッシュを防ぐ）
// {Count: N, value: [...]} 形式のレガシーデータにも対応
export function toStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v): v is string => typeof v === "string");
  // C#/.NET形式 {Count, value:[...]} をサポート
  if (val !== null && typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (Array.isArray(obj.value)) {
      return obj.value.filter((v): v is string => typeof v === "string");
    }
  }
  return [];
}

// ng_childrenのJSONBフィールド（use_days, qualifications）を正規化
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeChild<T extends Record<string, any>>(child: T): T {
  return {
    ...child,
    use_days: toStringArray(child.use_days),
    qualifications: toStringArray(child.qualifications),
  };
}

// ng_children専用fetch（use_days等のJSONBフィールドを正規化）
export async function fetchChildren(org_id: string, facility_id: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await fetchByFacility<any>("ng_children", org_id, facility_id);
  return rows.map(normalizeChild);
}

// ==================== 認証 ====================

// Supabase Auth でサインイン
// メールアドレス形式: {username}@go-group-sys.app
export async function authSignIn(username: string, password: string) {
  const email = `${username}@go-group-sys.app`;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

// サインアウト
export async function authSignOut() {
  await supabase.auth.signOut();
}

// 現在のSupabaseセッション取得
export async function getAuthSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}
