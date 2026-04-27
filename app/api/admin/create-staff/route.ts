// ==================== 職員Auth登録API ====================
// Service Role Keyを使ってSupabase Authにユーザーを作成し
// ng_staffテーブルにも登録する

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service Role Key（サーバーサイドのみ。クライアントには絶対公開しない）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { login_id, password, name, role, facility_id, org_id } = await req.json();

    if (!login_id || !password || !name || !role || !facility_id) {
      return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
    }

    const email = `${login_id}@go-group-sys.app`;

    // ① Supabase Authにユーザーを作成
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // メール確認不要で即利用可能
    });

    if (authError) {
      // すでに存在する場合は既存UUIDを取得
      if (authError.message.includes("already been registered") || authError.message.includes("already exists")) {
        const { data: existing } = await supabaseAdmin
          .from("auth.users")
          .select("id")
          .eq("email", email)
          .limit(1);
        // ユーザーは既存として続行
      } else {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }
    }

    const authUserId = authData?.user?.id ?? crypto.randomUUID();

    // ② ng_staffテーブルに登録
    const { error: staffError } = await supabaseAdmin
      .from("ng_staff")
      .upsert({
        id: crypto.randomUUID(),
        org_id: org_id ?? "org_1",
        facility_id,
        name,
        role,
        login_id,
        auth_user_id: authUserId,
        created_at: new Date().toISOString(),
      }, { onConflict: "login_id" });

    if (staffError) {
      return NextResponse.json({ error: staffError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, login_id, email });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
