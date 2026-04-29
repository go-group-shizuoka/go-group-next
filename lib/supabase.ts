// ==================== Supabaseクライアント ====================
// マルチテナント対応: org_id によるRLSフィルタリングを前提

import { createClient } from "@supabase/supabase-js";

// ビルド時に環境変数が未設定でも初期化エラーが出ないようフォールバック値を使用
// 実際のAPIコールはブラウザ側でのみ発生するため、Vercel上では本物の値が使われる
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

// シングルトンパターン（ブラウザ側で1インスタンスのみ）
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ==================== 汎用CRUD関数 ====================

// データ取得（org_idでフィルタ）
export async function fetchByOrg<T>(table: string, org_id: string): Promise<T[]> {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("org_id", org_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(`fetchByOrg [${table}] error:`, error);
    return [];
  }
  return (data as T[]) ?? [];
}

// データ取得（org_id + facility_idでフィルタ）
export async function fetchByFacility<T>(
  table: string,
  org_id: string,
  facility_id: string
): Promise<T[]> {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("org_id", org_id)
    .eq("facility_id", facility_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(`fetchByFacility [${table}] error:`, error);
    return [];
  }
  return (data as T[]) ?? [];
}

// データ取得（org_id + facility_id + 日付でフィルタ）
export async function fetchByDate<T>(
  table: string,
  org_id: string,
  facility_id: string,
  date: string
): Promise<T[]> {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("org_id", org_id)
    .eq("facility_id", facility_id)
    .eq("date", date)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(`fetchByDate [${table}] error:`, error);
    return [];
  }
  return (data as T[]) ?? [];
}

// データ保存（upsert）
export async function saveRecord(table: string, data: Record<string, unknown>) {
  const { error } = await supabase
    .from(table)
    .upsert(data, { onConflict: "id" });

  if (error) {
    console.error(`saveRecord [${table}] error:`, error);
    throw error;
  }
}

// データ取得（org_id + facility_id + 追加フィルタ）
export async function fetchByFacilityWhere<T>(
  table: string,
  org_id: string,
  facility_id: string,
  extra: Record<string, unknown>
): Promise<T[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from(table)
    .select("*")
    .eq("org_id", org_id)
    .eq("facility_id", facility_id);
  for (const [k, v] of Object.entries(extra)) {
    q = q.eq(k, v);
  }
  const { data, error } = await q;
  if (error) {
    console.error(`fetchByFacilityWhere [${table}] error:`, error);
    return [];
  }
  return (data as T[]) ?? [];
}

// データ削除
export async function deleteRecord(table: string, id: string) {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", id);

  if (error) {
    console.error(`deleteRecord [${table}] error:`, error);
    throw error;
  }
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
