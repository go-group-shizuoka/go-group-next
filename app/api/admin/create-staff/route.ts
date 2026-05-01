// ==================== 職員Auth登録API ====================
// Service Role Keyを使ってSupabase Authにユーザーを作成し
// ng_staffテーブルにも登録する

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase環境変数が設定されていません");
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getAdmin();
    const { login_id, password, name, role, facility_id, org_id,
            phone, qualifications, hire_date, employment_type, emergency_contact } = await req.json();

    if (!login_id || !password || !name || !role || !facility_id) {
      return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
    }

    const email = `${login_id}@go-group-sys.app`;

    // ① 同じemailが既にng_staffにあるか確認（重複チェック）
    const { data: existingStaff } = await supabaseAdmin
      .from("ng_staff")
      .select("id")
      .eq("email", email)
      .limit(1);

    if (existingStaff && existingStaff.length > 0) {
      return NextResponse.json({ error: `ログインID「${login_id}」は既に使用されています` }, { status: 400 });
    }

    // ② Supabase Authにユーザーを作成
    const { error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      // 既に登録済みの場合はng_staffへの登録だけ続行
      if (!authError.message.includes("already been registered") && !authError.message.includes("already exists")) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }
    }

    // ③ ng_staffテーブルに登録（既存の列のみ使用）
    const { error: staffError } = await supabaseAdmin
      .from("ng_staff")
      .insert({
        id: crypto.randomUUID(),
        org_id: org_id ?? "org_1",
        facility_id,
        name,
        role,
        email,                              // login_idはemailとして保存
        phone: phone ?? null,
        qualifications: qualifications && qualifications.length > 0 ? qualifications : null,
        hire_date: hire_date || null,
        employment_type: employment_type || null,
        emergency_contact: emergency_contact || null,
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
