// ==================== Supabaseクライアント ====================
// マルチテナント対応: org_id によるRLSフィルタリングを前提

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
