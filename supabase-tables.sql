-- ==================== GO GROUP Next マルチテナント DB ====================
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください

-- 1. 法人（テナント）
CREATE TABLE IF NOT EXISTS public.organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plan TEXT DEFAULT 'standard',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON public.organizations FOR ALL USING (true) WITH CHECK (true);

-- 2. 施設
CREATE TABLE IF NOT EXISTS public.ng_facilities (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  service_type TEXT DEFAULT '放課後等デイサービス',
  capacity INT DEFAULT 10,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.ng_facilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON public.ng_facilities FOR ALL USING (true) WITH CHECK (true);

-- 3. 職員
CREATE TABLE IF NOT EXISTS public.ng_staff (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  facility_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'staff',
  email TEXT,
  phone TEXT,
  hire_date DATE,
  qualifications JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.ng_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON public.ng_staff FOR ALL USING (true) WITH CHECK (true);

-- 4. 児童
CREATE TABLE IF NOT EXISTS public.ng_children (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  facility_id TEXT NOT NULL,
  name TEXT NOT NULL,
  name_kana TEXT,
  dob DATE,
  grade TEXT,
  gender TEXT,
  diagnosis TEXT,
  disability_level TEXT,
  use_days JSONB DEFAULT '[]',
  has_transport BOOLEAN DEFAULT false,
  photo_url TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  emergency_contact TEXT,
  notes TEXT,
  support_content TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.ng_children ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON public.ng_children FOR ALL USING (true) WITH CHECK (true);

-- 5. 入退室記録
CREATE TABLE IF NOT EXISTS public.ng_attendance (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  facility_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  child_name TEXT,
  date DATE NOT NULL,
  arrive_time TEXT,
  depart_time TEXT,
  temperature TEXT,
  transport_to BOOLEAN DEFAULT false,
  transport_from BOOLEAN DEFAULT false,
  status TEXT DEFAULT '来所',
  memo TEXT,
  recorded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.ng_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON public.ng_attendance FOR ALL USING (true) WITH CHECK (true);

-- 6. 活動記録
CREATE TABLE IF NOT EXISTS public.ng_activities (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  facility_id TEXT NOT NULL,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  activity_type TEXT,
  photo_url TEXT,
  child_ids JSONB DEFAULT '[]',
  visible_to_parent BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.ng_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON public.ng_activities FOR ALL USING (true) WITH CHECK (true);

-- 7. 保護者メッセージ
CREATE TABLE IF NOT EXISTS public.ng_messages (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  facility_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  child_name TEXT,
  from_name TEXT,
  body TEXT,
  photo_url TEXT,
  is_read BOOLEAN DEFAULT false,
  replies JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.ng_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON public.ng_messages FOR ALL USING (true) WITH CHECK (true);

-- 8. 業務日報
CREATE TABLE IF NOT EXISTS public.ng_daily_reports (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  facility_id TEXT NOT NULL,
  date DATE NOT NULL,
  weather TEXT,
  child_count INT DEFAULT 0,
  staff_count INT DEFAULT 0,
  activities TEXT,           -- JSON文字列 [{time, title, detail, staff}]
  incident TEXT,
  parent_note TEXT,
  tomorrow_note TEXT,
  manager_note TEXT,
  author TEXT,
  status TEXT DEFAULT '下書き',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
ALTER TABLE public.ng_daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON public.ng_daily_reports FOR ALL USING (true) WITH CHECK (true);

-- 9. 送迎記録
CREATE TABLE IF NOT EXISTS public.ng_transport (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  facility_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  child_name TEXT,
  date DATE NOT NULL,
  route TEXT NOT NULL,          -- '来所' or '帰所'
  status TEXT DEFAULT '待機中', -- '待機中' | '出発' | '到着済' | '欠席'
  time TEXT,                    -- HH:MM
  pickup_order INT DEFAULT 0,   -- 送迎順番
  recorded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.ng_transport ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON public.ng_transport FOR ALL USING (true) WITH CHECK (true);

-- 10. 個別支援計画
CREATE TABLE IF NOT EXISTS public.ng_support_plans (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  facility_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  child_name TEXT,
  plan_start DATE,
  plan_end DATE,
  long_term_goal TEXT,
  short_term_goals TEXT,  -- JSON文字列 [{goal, period}]
  support_items TEXT,     -- JSON文字列 [{category, content, frequency}]
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
ALTER TABLE public.ng_support_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON public.ng_support_plans FOR ALL USING (true) WITH CHECK (true);

-- 11. シフト管理
CREATE TABLE IF NOT EXISTS public.ng_shifts (
  id TEXT PRIMARY KEY,          -- '{staff_id}_{year}_{month}_{day}'
  org_id TEXT NOT NULL,
  facility_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  staff_name TEXT,
  year INT NOT NULL,
  month INT NOT NULL,
  day INT NOT NULL,
  shift_type TEXT DEFAULT '',   -- 'A' | 'B' | 'C' | '休' | '有' | ''
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.ng_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON public.ng_shifts FOR ALL USING (true) WITH CHECK (true);

-- 初期データ: GO GROUP法人
INSERT INTO public.organizations (id, name, plan)
VALUES ('org_1', 'GO GROUP', 'standard')
ON CONFLICT (id) DO NOTHING;

-- 初期データ: 4施設
INSERT INTO public.ng_facilities (id, org_id, name, service_type, capacity) VALUES
('f1', 'org_1', 'GO HOME',     '放課後等デイサービス', 10),
('f2', 'org_1', 'GO ROOM',     '放課後等デイサービス', 10),
('f3', 'org_1', 'GO TOWN 1ST', '放課後等デイサービス', 10),
('f4', 'org_1', 'GO TOWN 2ND', '放課後等デイサービス', 10)
ON CONFLICT (id) DO NOTHING;
