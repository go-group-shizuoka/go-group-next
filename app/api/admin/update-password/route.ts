// ==================== パスワード変更API ====================
// Service Role Keyを使ってSupabase AuthユーザーのパスワードをサーバーサイドでReset

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase環境変数が設定されていません");
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  const supabaseAdmin = getAdmin();
  try {
    const { login_id, password } = await req.json();
    if (!login_id || !password || password.length < 8) {
      return NextResponse.json({ error: "login_idとパスワード（8文字以上）は必須です" }, { status: 400 });
    }

    const email = `${login_id}@go-group-sys.app`;

    // Supabase Authのユーザー一覧からメールアドレスで検索
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });

    const user = users.find((u) => u.email === email);
    if (!user) return NextResponse.json({ error: `ユーザー「${login_id}」が見つかりません` }, { status: 404 });

    // パスワード更新
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password });
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
