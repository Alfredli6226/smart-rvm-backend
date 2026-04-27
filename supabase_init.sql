-- RVM Merchant Platform Database Schema
-- Version: 1.0.0
-- Created: 2026-04-17

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USERS TABLE (从vendor API同步的用户)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vendor_user_id VARCHAR(50) UNIQUE NOT NULL,  -- 供应商系统中的用户ID
  nick_name VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(255),
  avatar_url TEXT,
  user_type VARCHAR(10) DEFAULT '11',
  status VARCHAR(10) DEFAULT '0',  -- 0=正常, 1=禁用
  device_no VARCHAR(50),  -- 关联的设备编号
  total_weight DECIMAL(10, 2) DEFAULT 0,  -- 总回收重量(kg)
  total_points DECIMAL(10, 2) DEFAULT 0,  -- 总积分
  trust_score INTEGER DEFAULT 100,  -- 信任分数 0-100
  trust_level VARCHAR(20) DEFAULT 'BRONZE',  -- BRONZE, SILVER, GOLD, PLATINUM
  last_activity TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 索引
  INDEX idx_users_vendor_id (vendor_user_id),
  INDEX idx_users_phone (phone),
  INDEX idx_users_trust_score (trust_score DESC),
  INDEX idx_users_created_at (created_at DESC)
);

-- ============================================
-- 2. MACHINES TABLE (从vendor API同步的机器)
-- ============================================
CREATE TABLE IF NOT EXISTS machines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  device_no VARCHAR(50) UNIQUE NOT NULL,  -- 设备编号
  device_name VARCHAR(100),
  location VARCHAR(255),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(10, 8),
  status VARCHAR(20) DEFAULT 'online',  -- online, offline, maintenance
  capacity_kg DECIMAL(10, 2),  -- 容量(kg)
  current_weight DECIMAL(10, 2) DEFAULT 0,  -- 当前重量
  last_maintenance DATE,
  last_online_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 索引
  INDEX idx_machines_device_no (device_no),
  INDEX idx_machines_status (status),
  INDEX idx_machines_location (location)
);

-- ============================================
-- 3. RECYCLING SUBMISSIONS TABLE (回收提交记录)
-- ============================================
CREATE TABLE IF NOT EXISTS recycling_submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  machine_id UUID REFERENCES machines(id) ON DELETE SET NULL,
  vendor_submission_id VARCHAR(50),  -- 供应商系统中的提交ID
  
  -- 回收数据
  material_type VARCHAR(50),  -- plastic_bottle, aluminium_can, glass_bottle, paper, uco
  weight_kg DECIMAL(10, 2) NOT NULL,
  points_awarded DECIMAL(10, 2) NOT NULL,
  
  -- 图片验证
  image_url TEXT,
  ai_analysis JSONB,  -- AI分析结果
  verification_status VARCHAR(20) DEFAULT 'pending',  -- pending, verified, rejected, flagged
  verification_score INTEGER,  -- 验证分数 0-100
  
  -- 欺诈检测
  fraud_check JSONB,
  fraud_risk_level VARCHAR(20) DEFAULT 'low',  -- low, medium, high
  manual_review_required BOOLEAN DEFAULT FALSE,
  
  -- 时间戳
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 索引
  INDEX idx_submissions_user_id (user_id),
  INDEX idx_submissions_machine_id (machine_id),
  INDEX idx_submissions_verification_status (verification_status),
  INDEX idx_submissions_submitted_at (submitted_at DESC),
  INDEX idx_submissions_material_type (material_type)
);

-- ============================================
-- 4. RECYCLING VERIFICATIONS TABLE (验证记录)
-- ============================================
CREATE TABLE IF NOT EXISTS recycling_verifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  submission_id UUID REFERENCES recycling_submissions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- AI分析结果
  ai_analysis JSONB NOT NULL,
  objects_detected JSONB,
  materials_identified JSONB,
  image_quality_score DECIMAL(3, 2),
  
  -- 重量验证
  weight_validation JSONB NOT NULL,
  expected_range_min DECIMAL(10, 2),
  expected_range_max DECIMAL(10, 2),
  weight_deviation_percent DECIMAL(5, 2),
  
  -- 欺诈检测
  fraud_check JSONB NOT NULL,
  fraud_checks_passed INTEGER,
  fraud_checks_total INTEGER,
  overall_fraud_risk VARCHAR(20),
  
  -- 结果
  verification_result BOOLEAN NOT NULL,  -- true=通过, false=失败
  verification_score INTEGER NOT NULL,  -- 0-100
  points_awarded DECIMAL(10, 2),
  recommendations JSONB,
  
  -- 审核信息
  reviewed_by VARCHAR(100),
  review_notes TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 索引
  INDEX idx_verifications_submission_id (submission_id),
  INDEX idx_verifications_user_id (user_id),
  INDEX idx_verifications_verification_result (verification_result),
  INDEX idx_verifications_created_at (created_at DESC)
);

-- ============================================
-- 5. USER TRUST SCORES TABLE (信任分数历史)
-- ============================================
CREATE TABLE IF NOT EXISTS user_trust_scores (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES recycling_submissions(id) ON DELETE SET NULL,
  
  -- 分数变化
  previous_score INTEGER,
  new_score INTEGER NOT NULL,
  score_change INTEGER NOT NULL,
  reason VARCHAR(255),  -- 分数变化原因
  
  -- 影响因素
  verification_passed BOOLEAN,
  fraud_detected BOOLEAN,
  weight_validation_passed BOOLEAN,
  image_quality_passed BOOLEAN,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 索引
  INDEX idx_trust_scores_user_id (user_id),
  INDEX idx_trust_scores_created_at (created_at DESC)
);

-- ============================================
-- 6. NOTIFICATIONS TABLE (通知记录)
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- 通知内容
  type VARCHAR(50) NOT NULL,  -- points_awarded, fraud_alert, maintenance, reminder
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  language VARCHAR(10) DEFAULT 'en',  -- en, zh, ms
  
  -- 发送状态
  channel VARCHAR(20) NOT NULL,  -- whatsapp, email, sms, in_app
  status VARCHAR(20) DEFAULT 'pending',  -- pending, sent, failed, delivered
  sent_at TIMESTAMP WITH TIME ZONE,
  delivery_confirmation JSONB,
  
  -- 关联数据
  related_submission_id UUID REFERENCES recycling_submissions(id) ON DELETE SET NULL,
  related_points DECIMAL(10, 2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 索引
  INDEX idx_notifications_user_id (user_id),
  INDEX idx_notifications_type (type),
  INDEX idx_notifications_status (status),
  INDEX idx_notifications_created_at (created_at DESC)
);

-- ============================================
-- 7. SYNC LOGS TABLE (数据同步记录)
-- ============================================
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  
  -- 同步信息
  sync_type VARCHAR(50) NOT NULL,  -- users, machines, recycling, full
  records_synced INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'running',  -- running, complete, failed, partial
  
  -- 时间信息
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  
  -- 错误信息
  error_details TEXT,
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 索引
  INDEX idx_sync_logs_sync_type (sync_type),
  INDEX idx_sync_logs_status (status),
  INDEX idx_sync_logs_created_at (created_at DESC)
);

-- ============================================
-- 8. FRAUD PATTERNS TABLE (欺诈模式记录)
-- ============================================
CREATE TABLE IF NOT EXISTS fraud_patterns (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  
  -- 模式信息
  pattern_type VARCHAR(50) NOT NULL,  -- duplicate_image, edited_image, wrong_location, etc.
  description TEXT NOT NULL,
  confidence_threshold DECIMAL(3, 2) DEFAULT 0.8,
  severity VARCHAR(20) DEFAULT 'medium',  -- low, medium, high, critical
  
  -- 检测数据
  detection_count INTEGER DEFAULT 0,
  last_detected TIMESTAMP WITH TIME ZONE,
  affected_users_count INTEGER DEFAULT 0,
  
  -- 应对措施
  auto_action VARCHAR(50),  -- block_submission, flag_for_review, reduce_points, etc.
  manual_review_required BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 索引
  INDEX idx_fraud_patterns_pattern_type (pattern_type),
  INDEX idx_fraud_patterns_severity (severity)
);

-- ============================================
-- 9. BUSINESS REPORTS TABLE (业务报告)
-- ============================================
CREATE TABLE IF NOT EXISTS business_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  
  -- 报告信息
  report_type VARCHAR(50) NOT NULL,  -- daily, weekly, monthly, user_engagement, revenue, etc.
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 指标数据
  metrics JSONB NOT NULL,
  insights JSONB,
  recommendations JSONB,
  
  -- 状态
  status VARCHAR(20) DEFAULT 'generated',  -- generated, reviewed, archived
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 索引
  INDEX idx_business_reports_report_type (report_type),
  INDEX idx_business_reports_period_start (period_start DESC),
  INDEX idx_business_reports_period_end (period_end DESC)
);

-- ============================================
-- 10. SYSTEM SETTINGS TABLE (系统设置)
-- ============================================
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  setting_type VARCHAR(50) DEFAULT 'string',  -- string, number, boolean, json
  category VARCHAR(50) DEFAULT 'general',
  description TEXT,
  
  is_public BOOLEAN DEFAULT FALSE,
  requires_restart BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 索引
  INDEX idx_system_settings_key (setting_key),
  INDEX idx_system_settings_category (category)
);

-- ============================================
-- TRIGGERS: Auto-update updated_at timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at column
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_machines_updated_at BEFORE UPDATE ON machines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fraud_patterns_updated_at BEFORE UPDATE ON fraud_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL DATA: Insert default system settings
-- ============================================
INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description) VALUES
-- Points calculation
('points_per_kg', '0.2', 'number', 'points', 'Points awarded per kilogram of recyclables'),
('minimum_weight_kg', '0.01', 'number', 'validation', 'Minimum weight for a valid submission'),
('maximum_weight_kg', '50.0', 'number', 'validation', 'Maximum weight for a single submission'),

-- Trust score settings
('trust_score_initial', '100', 'number', 'trust', 'Initial trust score for new users'),
('trust_score_increase_per_verification', '5', 'number', 'trust', 'Trust score increase for each successful verification'),
('trust_score_decrease_per_fraud', '20', 'number', 'trust', 'Trust score decrease for each fraud detection'),
('trust_level_bronze_threshold', '60', 'number', 'trust', 'Minimum score for BRONZE level'),
('trust_level_silver_threshold', '75', 'number', 'trust', 'Minimum score for SILVER level'),
('trust_level_gold_threshold', '85', 'number', 'trust', 'Minimum score for GOLD level'),
('trust_level_platinum_threshold', '95', 'number', 'trust', 'Minimum score for PLATINUM level'),

-- Fraud detection thresholds
('fraud_confidence_threshold', '0.8', 'number', 'fraud', 'Minimum confidence score to flag as fraud'),
('duplicate_image_threshold', '0.9', 'number', 'fraud', 'Similarity threshold for duplicate image detection'),
('submission_frequency_threshold_hourly', '10', 'number', 'fraud', 'Maximum submissions per hour per user'),
('submission_frequency_threshold_daily', '50', 'number', 'fraud', 'Maximum submissions per day per user'),

-- Vendor API settings
('vendor_api_base_url', 'https://api.autogcm.com', 'string', 'vendor', 'Base URL for vendor API'),
('vendor_api_timeout_ms', '10000', 'number', 'vendor', 'API request timeout in milliseconds'),
('vendor_api_retry_count', '3', 'number', 'vendor', 'Number of retries for failed API calls'),

-- Notification settings
('whatsapp_enabled', 'false', 'boolean', 'notifications', 'Enable WhatsApp notifications'),
('sms_enabled', 'false', 'boolean', 'notifications', 'Enable SMS notifications'),
('email_enabled', 'true', 'boolean', 'notifications', 'Enable email notifications'),
('notification_language_default', 'en', 'string', 'notifications', 'Default language for notifications'),

-- System settings
('maintenance_mode', 'false', 'boolean', 'system', 'Enable maintenance mode'),
('data_sync_interval_hours', '6', 'number', 'system', 'Hours between automatic data syncs'),
('report_generation_cron', '0 9 * * *', 'string', 'system', 'Cron expression for daily report generation'),

-- AI Service settings
('ai_service_provider', 'mock', 'string', 'ai', 'AI service provider (mock, google, clarifai, custom)'),
('ai_confidence_threshold', '0.7', 'number', 'ai', 'Minimum confidence for AI detection'),
('ai_image_quality_threshold', '0.5', 'number', 'ai', 'Minimum image quality score')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- INITIAL DATA: Insert default fraud patterns
-- ============================================
INSERT INTO fraud_patterns (pattern_type, description, confidence_threshold, severity, auto_action, manual_review_required) VALUES
('duplicate_image', 'Same image submitted multiple times', 0.9, 'high', 'flag_for_review', true),
('edited_image', 'Image has been digitally altered or photoshopped', 0.85, 'high', '