// ==========================================
// 1. MERCHANT & SAAS TYPES (New)
// ==========================================

export interface Merchant {
  id: string;
  name: string;
  currency_symbol: string;
  rate_plastic: number;
  is_active: boolean;
  contact_email?: string;
  created_at: string;
}

export interface MerchantWallet {
  id: string;
  user_id: string;
  merchant_id: string;
  current_balance: number;
  total_earnings: number;
  last_updated_at: string;
}

// ==========================================
// 2. EXISTING ENUMS & TYPES (Updated)
// ==========================================

export const WithdrawalStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PAID: 'PAID',
  EXTERNAL_SYNC: 'EXTERNAL_SYNC'
} as const;

export type WithdrawalStatus = typeof WithdrawalStatus[keyof typeof WithdrawalStatus];

export type SubmissionStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

// ==========================================
// 3. DATABASE INTERFACES
// ==========================================

export type UserStatus = 'ACTIVE' | 'WARNED' | 'BLOCKED';

export interface User {
  id: string;
  vendor_user_no?: string | null;
  phone: string;
  email?: string | null;
  
  lifetime_integral: number;
  total_weight?: number;
  
  created_at: string;
  updated_at?: string;
  last_active_at?: string;
  
  status?: UserStatus;
  
  nickname?: string | null;
  avatar_url?: string | null;
  card_no?: string | null;
  vendor_internal_id?: string | null;
  last_synced_at?: string | null;
}

export interface UserProfile {
  nickname?: string;
  phone?: string;
  email?: string;
  avatar_url?: string;
}

export interface Withdrawal {
  id: string;
  user_id: string;
  merchant_id?: string; // ✅ SaaS: Linked to specific merchant wallet
  amount: number;
  status: WithdrawalStatus;
  created_at: string;
  updated_at: string;
  
  // Payment Details
  bank_name?: string;
  account_number?: string;
  account_holder_name?: string;
  
  // Admin Fields
  admin_note?: string;
  reviewed_by?: string;

  // Joined Data
  users?: UserProfile; 
  merchants?: { name: string }; // ✅ To show which shop paid
}

export interface Machine {
  id: number; // Changed to number to match BigInt in DB, or keep string if using string ID
  device_no: string; // Standardized to snake_case matches DB (check your DB column name)
  deviceNo?: string; // Legacy support for API mapping
  
  merchant_id?: string; // SaaS: Who owns this machine?
  
  name: string;      // Replaces deviceName
  address?: string;
  location_name?: string;
  
  // Status
  is_active: boolean;
  zone?: string;
  is_manual_offline: boolean;

  // NEW: Rates are now here (Source of Truth)
  config_bin_1: string;
  config_bin_2: string;
  rate_plastic: number;
  rate_paper: number;
  rate_uco: number;
  
  // Joined Data
  merchant?: Merchant; 
}

export interface ViewerMachineAssignment {
  id: string;
  admin_id: string;
  machine_id: number;
  assigned_at: string;
  assigned_by: string | null;
  
  // Joined Data
  machines?: {
    device_no: string;
    name: string;
    address: string;
    zone: string;
  };
}

export interface SubmissionReview {
  id: string;
  vendor_record_id: string;
  
  // Ownership
  user_id: string;
  merchant_id?: string; // SaaS: Which merchant pays for this?
  
  phone: string;
  device_no: string;
  waste_type: string;
  photo_url: string;
  
  // Weights
  api_weight: number;
  theoretical_weight: number;
  warehouse_weight?: number;
  confirmed_weight?: number;
  bin_weight_snapshot?: number;
  
  // Financials
  rate_per_kg: number;
  calculated_value?: number; // ✅ SaaS: Money Value (RM)
  calculated_points?: number; // Legacy: Points
  machine_given_points?: number;
  
  status: SubmissionStatus;
  submitted_at: string;
  
  // Joined Data
  users?: {
    nickname: string;
    avatar_url: string;
    phone: string | null;
  };
  merchants?: {
    name: string;
    currency_symbol: string;
  };
}

// ==========================================
// 4. API RESPONSE INTERFACES (Keep as is)
// ==========================================

export interface ApiUserSyncResponse {
  code: number;
  msg: string;
  data: {
    userNo: string;
    integral: number;
    phone: string;
    nikeName?: string;  
    name?: string;        
    imgUrl?: string;
    createTime?: string;
    isNewUser?: number;
  };
}

export interface ApiDisposalRecord {
  id: string;
  deviceNo: string;
  deviceName?: string;
  weight: number;
  integral: number;
  rubbishName?: string; 
  createTime: string;
  imgUrl?: string;
  cardNo?: string;      
  username?: string;
  userId?: string;    
}

export interface ApiPutResponse {
  code: number;
  data: {
    list: ApiDisposalRecord[];
    total: number;
    pageNum: number;
    pageSize: number;
  };
}

// ==========================================
// 5. CUSTOMER SERVICE & LEADS TYPES (New)
// ==========================================

export interface CustomerServiceTicket {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  
  // Customer/User Information
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  user_id?: string;
  company_name?: string;
  
  // Ticket Classification
  category: string;
  subcategory?: string;
  channel?: 'website' | 'whatsapp' | 'email' | 'phone' | 'social' | 'in-person';
  
  // Priority & Status
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Open' | 'In Progress' | 'On Hold' | 'Resolved' | 'Closed';
  lead_score?: 'hot' | 'warm' | 'cold';
  
  // Assignment & Ownership
  assigned_to?: string;
  assigned_at?: string;
  created_by?: string;
  
  // Source & Context
  source?: 'Web' | 'Email' | 'Phone' | 'WhatsApp' | 'In-person' | 'Social Media';
  related_machine_id?: number;
  related_merchant_id?: string;
  
  // AI & Analysis Fields
  ai_summary?: string;
  ai_sentiment?: 'positive' | 'negative' | 'neutral';
  ai_tags?: string[];
  ai_priority_score?: number;
  ai_suggested_reply?: string;
  ai_recommended_action?: string;
  ai_escalation_reason?: string;
  
  // Timestamps
  first_response_at?: string;
  resolved_at?: string;
  closed_at?: string;
  sla_deadline?: string;
  created_at: string;
  updated_at: string;
  
  // Metadata
  attachments?: string[];
  custom_fields?: Record<string, any>;
  next_action?: string;
  last_message_at?: string;
  
  // Joined Data
  assigned_admin?: { email: string; full_name?: string };
  created_admin?: { email: string; full_name?: string };
  machine?: { device_no: string; name: string };
  merchant?: { name: string; currency_symbol: string };
  user?: { nickname: string; phone: string };
}

export interface CustomerServiceMessage {
  id: string;
  ticket_id: string;
  
  // Message Content
  message_type: 'message' | 'internal_note' | 'system' | 'ai_suggestion';
  content: string;
  
  // Sender Information
  sender_type: 'customer' | 'agent' | 'system' | 'ai';
  sender_id?: string;
  sender_name?: string;
  sender_email?: string;
  
  // Metadata
  attachments?: string[];
  is_internal: boolean;
  read_by_agent: boolean;
  read_by_customer: boolean;
  is_ai_suggestion?: boolean;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Joined Data
  sender_admin?: { email: string; full_name?: string };
  sender_user?: { nickname: string; phone: string };
}

export interface Lead {
  id: string;
  lead_number: string;
  
  // Lead Information
  company_name?: string;
  contact_person: string;
  email: string;
  phone?: string;
  
  // Lead Details
  inquiry_type: string;
  description?: string;
  estimated_value?: number;
  currency: string;
  
  // Status & Scoring
  status: 'New' | 'Contacted' | 'Qualified' | 'Proposal Sent' | 'Negotiation' | 'Won' | 'Lost';
  lead_score: 'hot' | 'warm' | 'cold';
  confidence_score: number;
  
  // Source & Campaign
  source: string;
  campaign?: string;
  referral_source?: string;
  
  // Assignment
  assigned_to?: string;
  assigned_at?: string;
  
  // Follow-up
  next_follow_up?: string;
  last_contacted?: string;
  
  // AI & Analysis
  ai_summary?: string;
  ai_tags?: string[];
  ai_qualification_score?: number;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Metadata
  custom_fields?: Record<string, any>;
  notes?: string;
  
  // Joined Data
  assigned_admin?: { email: string; full_name?: string };
}

export interface CustomerServiceCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color: string;
  is_active: boolean;
  created_at: string;
}

// Filter interfaces
export interface TicketFilters {
  status?: string;
  priority?: string;
  category?: string;
  assigned_to?: string;
  lead_score?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface LeadFilters {
  status?: string;
  lead_score?: string;
  assigned_to?: string;
  source?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}