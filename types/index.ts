// ==================== 型定義 ====================
// マルチテナントSaaS設計: 全データに org_id を持たせる

// 法人（テナント）
export type Organization = {
  id: string;
  name: string;          // 法人名（例: GO GROUP）
  plan: "starter" | "standard" | "pro";
  created_at: string;
};

// 施設
export type Facility = {
  id: string;
  org_id: string;        // 所属法人ID
  name: string;          // 施設名（例: GO HOME）
  address?: string;
  phone?: string;
  capacity?: number;     // 定員
  service_type: "放課後等デイサービス" | "児童発達支援";
};

// 職員
export type Staff = {
  id: string;
  org_id: string;
  facility_id: string;
  name: string;
  role: "admin" | "manager" | "staff"; // 管理者/施設長/職員
  email?: string;
  phone?: string;
  hire_date?: string;
  qualifications?: string[]; // 保有資格
};

// 児童（利用者）
export type Child = {
  id: string;
  org_id: string;
  facility_id: string;
  name: string;
  name_kana?: string;
  dob: string;           // 生年月日 YYYY-MM-DD
  grade?: string;        // 学年
  gender?: "男" | "女";
  diagnosis?: string;    // 診断名
  disability_level?: string; // 障害支援区分
  use_days?: string[];   // 利用曜日 ["月","水","金"]
  has_transport?: boolean; // 送迎あり
  photo_url?: string;
  emergency_contact?: string;
  parent_name?: string;
  parent_phone?: string;
  notes?: string;        // 注意事項
  support_content?: string; // 支援内容
  active: boolean;
  created_at: string;
};

// 入退室記録
export type AttendanceRecord = {
  id: string;
  org_id: string;
  facility_id: string;
  child_id: string;
  child_name: string;
  date: string;          // YYYY-MM-DD
  arrive_time?: string;  // HH:MM
  depart_time?: string;
  temperature?: string;  // 体温（例: "36.5"）
  transport_to?: boolean;  // 送迎（来所）
  transport_from?: boolean;// 送迎（帰り）
  status: "来所" | "欠席" | "体調不良" | "キャンセル" | "休所";
  memo?: string;
  recorded_by?: string;  // 記録者
  created_at: string;
};

// 活動記録
export type ActivityRecord = {
  id: string;
  org_id: string;
  facility_id: string;
  date: string;
  title: string;         // 活動タイトル
  content: string;       // 活動内容
  activity_type: string; // 活動種別
  photo_url?: string;
  child_ids?: string[];  // 参加した児童
  visible_to_parent: boolean; // 保護者向け表示
  created_by: string;
  created_at: string;
};

// 保護者連絡
export type MessageRecord = {
  id: string;
  org_id: string;
  facility_id: string;
  child_id: string;
  child_name: string;
  from_name: string;     // 送信者名
  body: string;
  photo_url?: string;
  is_read: boolean;
  replies: string[];
  created_at: string;
};

// 日報
export type DailyReport = {
  id: string;
  org_id: string;
  facility_id: string;
  date: string;
  weather?: string;
  staff_count?: number;
  child_count?: number;
  activities?: string;      // JSON配列 [{time, title, detail, staff}]
  incident?: string;        // 特記事項
  parent_note?: string;     // 保護者連絡事項
  tomorrow_note?: string;   // 翌日申し送り
  manager_note?: string;    // 管理者コメント
  author: string;
  status: "下書き" | "確認中" | "承認済";
  created_at: string;
  updated_at?: string;
};

// 個別支援計画
export type SupportPlan = {
  id: string;
  org_id: string;
  facility_id: string;
  child_id: string;
  child_name: string;
  plan_start: string;         // YYYY-MM-DD
  plan_end: string;
  long_term_goal: string;
  short_term_goals: string;   // JSON配列 [{goal: string, period: string}]
  support_items: string;      // JSON配列 [{category: string, content: string, frequency: string}]
  created_by: string;
  created_at: string;
  updated_at?: string;
};

// シフト記録
export type ShiftRecord = {
  id: string;
  org_id: string;
  facility_id: string;
  staff_id: string;
  staff_name: string;
  year: number;
  month: number;
  day: number;
  shift_type: string;   // "A" | "B" | "C" | "休" | "有" | ""
  created_by: string;
  created_at: string;
};

// ログインセッション（localStorage保存用）
export type UserSession = {
  id: string;
  org_id: string;
  facility_id: string;
  staff_id: string;
  name: string;
  role: "admin" | "manager" | "staff";
  selected_facility_id: string; // 現在表示中の施設
};
