// ==================== 開発用ダミーデータ ====================
// ※本番では使用しない。個人情報は含まない架空データ。

import type { Organization, Facility, Staff, Child } from "@/types";

// 法人（GO GROUP = org_id: "org_1"）
export const DUMMY_ORG: Organization = {
  id: "org_1",
  name: "GO GROUP",
  plan: "standard",
  created_at: "2024-04-01T00:00:00Z",
};

// 施設
export const DUMMY_FACILITIES: Facility[] = [
  { id: "f1", org_id: "org_1", name: "GO HOME",     service_type: "放課後等デイサービス", capacity: 10 },
  { id: "f2", org_id: "org_1", name: "GO ROOM",     service_type: "放課後等デイサービス", capacity: 10 },
  { id: "f3", org_id: "org_1", name: "GO TOWN 1ST", service_type: "放課後等デイサービス", capacity: 10 },
  { id: "f4", org_id: "org_1", name: "GO TOWN 2ND", service_type: "放課後等デイサービス", capacity: 10 },
];

// 職員（ダミー）
export const DUMMY_STAFF: Staff[] = [
  { id: "s1", org_id: "org_1", facility_id: "f1", name: "田中 美穂",  role: "manager" },
  { id: "s2", org_id: "org_1", facility_id: "f1", name: "佐藤 健一",  role: "staff" },
  { id: "s3", org_id: "org_1", facility_id: "f2", name: "山田 花子",  role: "manager" },
  { id: "s4", org_id: "org_1", facility_id: "f2", name: "鈴木 太郎",  role: "staff" },
  { id: "s5", org_id: "org_1", facility_id: "f3", name: "伊藤 恵",    role: "manager" },
  { id: "s6", org_id: "org_1", facility_id: "f4", name: "渡辺 拓也",  role: "manager" },
];

// ログインアカウント（ダミー）
export const DUMMY_ACCOUNTS = [
  { username: "admin",      password: "pass", staff_id: null, facility_id: null,  role: "admin"   as const, name: "本部管理者" },
  { username: "home_mgr",   password: "pass", staff_id: "s1", facility_id: "f1",  role: "manager" as const, name: "田中 美穂 (GO HOME)" },
  { username: "home_staff", password: "pass", staff_id: "s2", facility_id: "f1",  role: "staff"   as const, name: "佐藤 健一 (GO HOME)" },
  { username: "room_mgr",   password: "pass", staff_id: "s3", facility_id: "f2",  role: "manager" as const, name: "山田 花子 (GO ROOM)" },
  { username: "town1_mgr",  password: "pass", staff_id: "s5", facility_id: "f3",  role: "manager" as const, name: "伊藤 恵 (GO TOWN 1ST)" },
  { username: "town2_mgr",  password: "pass", staff_id: "s6", facility_id: "f4",  role: "manager" as const, name: "渡辺 拓也 (GO TOWN 2ND)" },
];

// 児童（ダミー）
export const DUMMY_CHILDREN: Child[] = [
  {
    id: "c1", org_id: "org_1", facility_id: "f1",
    name: "山本 こうた", name_kana: "やまもと こうた",
    dob: "2015-06-12", grade: "小3", gender: "男",
    diagnosis: "自閉スペクトラム症", use_days: ["月","水","金"],
    has_transport: true, active: true,
    parent_name: "山本 一郎", parent_phone: "000-0000-0001",
    notes: "大きな音が苦手です。活動切り替え時に声かけを。",
    support_content: "コミュニケーション支援・運動療育",
    created_at: "2024-04-01T00:00:00Z",
  },
  {
    id: "c2", org_id: "org_1", facility_id: "f1",
    name: "鈴木 はるか", name_kana: "すずき はるか",
    dob: "2016-03-05", grade: "小2", gender: "女",
    diagnosis: "注意欠如多動症", use_days: ["火","木"],
    has_transport: false, active: true,
    parent_name: "鈴木 幸子", parent_phone: "000-0000-0002",
    notes: "集中が続きにくいため、短時間の活動切り替えが効果的。",
    support_content: "学習支援・感覚統合",
    created_at: "2024-04-01T00:00:00Z",
  },
  {
    id: "c3", org_id: "org_1", facility_id: "f1",
    name: "伊藤 りく", name_kana: "いとう りく",
    dob: "2014-11-20", grade: "小4", gender: "男",
    diagnosis: "知的障害", use_days: ["月","火","水","木","金"],
    has_transport: true, active: true,
    parent_name: "伊藤 明子", parent_phone: "000-0000-0003",
    notes: "こだわりが強い。変更時は事前に予告する。",
    support_content: "日常生活動作・集団活動",
    created_at: "2024-04-01T00:00:00Z",
  },
  {
    id: "c4", org_id: "org_1", facility_id: "f2",
    name: "中村 さくら", name_kana: "なかむら さくら",
    dob: "2017-07-18", grade: "小1", gender: "女",
    diagnosis: "発達遅滞", use_days: ["月","水"],
    has_transport: true, active: true,
    parent_name: "中村 浩二", parent_phone: "000-0000-0004",
    notes: "人見知りがあるため、最初のアプローチに配慮。",
    support_content: "言語療育・感覚遊び",
    created_at: "2024-04-01T00:00:00Z",
  },
  {
    id: "c5", org_id: "org_1", facility_id: "f3",
    name: "小林 たいき", name_kana: "こばやし たいき",
    dob: "2013-09-30", grade: "小5", gender: "男",
    diagnosis: "自閉スペクトラム症", use_days: ["火","木","金"],
    has_transport: false, active: true,
    parent_name: "小林 真由美", parent_phone: "000-0000-0005",
    notes: "視覚支援が有効。スケジュールを絵カードで提示。",
    support_content: "ソーシャルスキル・学習支援",
    created_at: "2024-04-01T00:00:00Z",
  },
];
