-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 日历表
CREATE TABLE IF NOT EXISTS calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,  -- 改为TEXT以存储加密后的长字符串
    description TEXT,    -- 加密存储
    color VARCHAR(20) DEFAULT '#4f46e5',  -- 日历颜色
    api_key_hash VARCHAR(255) UNIQUE,
    subscribe_token VARCHAR(255),
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 事件表（支持全数据加密）
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
    title TEXT NOT NULL,        -- 加密存储（全数据加密模式下）
    description TEXT,           -- 加密存储
    location TEXT,              -- 加密存储
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    is_all_day BOOLEAN DEFAULT true,
    alarm_enabled BOOLEAN DEFAULT true,
    alarm_minutes INTEGER DEFAULT 15,
    recurrence_rule TEXT,
    external_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- API访问日志
CREATE TABLE IF NOT EXISTS api_logs (
    id BIGSERIAL PRIMARY KEY,
    calendar_id UUID REFERENCES calendars(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 用户会话表（用于JWT黑名单）
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_jti VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 邮件验证表
CREATE TABLE IF NOT EXISTS email_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'verify' 或 'reset' 或 'register'
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id);

-- 索引
CREATE INDEX IF NOT EXISTS idx_calendars_user ON calendars(user_id);
CREATE INDEX IF NOT EXISTS idx_events_calendar ON events(calendar_id);
CREATE INDEX IF NOT EXISTS idx_events_dates ON events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_logs_calendar ON api_logs(calendar_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_user ON api_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_key ON api_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token_jti);
