// ==================== 職員Auth登録API ====================
// Service Role Keyを使ってSupabase Authにユーザーを作成し
// ng_staffテーブルにも登録する

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service Role Key（サーバーサイドのみ。クライアントには絶対公開しない）
// ビルド時に環境変数がなくてもクラッシュしないようにリクエスト時に初期化する
function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase環境変数が設定されていません（NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）");
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getAdmin();
    const { login_id, password, name, role, facility_id, org_id,
            phone, employment_type, qualifications, hire_date, emergency_contact } = await req.json();

    if (!login_id || !password || !name || !role || !facility_id) {
      return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
    }

    const email = `${login_id}@go-group-sys.app`;

    // ① Supabase Authにユーザーを作成（既存ならスキップ）
    let authUserId: string | null = null;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes("already been registered") || authError.message.includes("already exists")) {
        // 既存ユーザーのUUIDをlistUsersから取得
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const existing = listData?.users?.find((u) => u.email === email);
        authUserId = existing?.id ?? null;
      } else {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }
    } else {
      authUserId = authData?.user?.id ?? null;
    }

    // ② ng_staffテーブルに登録（login_idで重複チェック後insert）
    // まず同じlogin_idが既にあるか確認
    const { data: existingStaff } = await supabaseAdmin
      .from("ng_staff")
      .select("id")
      .eq("login_id", login_id)
      .limit(1);

    if (existingStaff && existingStaff.length > 0) {
      return NextResponse.json({ error: `ログインID「${login_id}」は既に使用されています` }, { status: 400 });
    }

    const { error: staffError } = await supabaseAdmin
      .from("ng_staff")
      .insert({
        id: crypto.randomUUID(),
        org_id: org_id ?? "org_1",
        facility_id,
        name,
        role,
        login_id,
        auth_user_id: authUserId,
        phone: phone ?? null,
        employment_type: employment_type ?? null,
        qualifications: qualifications && qualifications.length > 0 ? qualifications : null,
        hire_date: hire_date ?? null,
        emergency_contact: emergency_contact ?? null,
        created_at: new Date().toISOString(),
      });

    if (staffError) {
      return NextResponse.json({ error: staffError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, login_id, email });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
