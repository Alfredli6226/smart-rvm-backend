import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface FraudDetectionResult {
  allowed: boolean;
  reason?: string;
  shouldFlagUser?: boolean;
  fraudType?: string;
}

/**
 * Middleware to detect High Frequency (Velocity) Fraud
 * Checks submissions in the last 5 minutes - if > 15, block and flag user
 */
export async function detectVelocityFraud(
  userId: string | null,
  submissionId?: string
): Promise<FraudDetectionResult> {
  if (!userId) {
    return { allowed: true }; // No user ID, allow through
  }

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  // Count submissions in the last 5 minutes
  const { count, error } = await supabase
    .from('submission_reviews')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('submitted_at', fiveMinutesAgo);

  if (error) {
    console.error('Velocity fraud check error:', error.message);
    return { allowed: true }; // Allow if check fails
  }

  const SUBMISSION_THRESHOLD = 15;

  if (count && count > SUBMISSION_THRESHOLD) {
    // Block this submission
    // Update user status to UNDER_REVIEW
    await supabase
      .from('users')
      .update({ status: 'UNDER_REVIEW' })
      .eq('id', userId);

    // Flag the latest submission as Velocity Fraud
    if (submissionId) {
      await supabase
        .from('submission_reviews')
        .update({
          is_suspicious: true,
          fraud_reason: 'Velocity Fraud',
          status: 'Flagged'
        })
        .eq('id', submissionId);
    }

    return {
      allowed: false,
      reason: 'High frequency submissions detected. Your account is under review.',
      shouldFlagUser: true,
      fraudType: 'Velocity Fraud'
    };
  }

  return { allowed: true };
}

/**
 * Express-style middleware wrapper for Vercel API
 */
export default async function velocityFraudMiddleware(
  req: VercelRequest,
  res: VercelResponse,
  next: () => Promise<void>
) {
  // Only check on POST requests to submission endpoints
  if (req.method !== 'POST') {
    return next();
  }

  const userId = req.body?.userId || req.body?.user_id || req.query?.userId;
  
  if (!userId) {
    return next();
  }

  const result = await detectVelocityFraud(userId);

  if (!result.allowed) {
    return res.status(403).json({
      error: 'Submission blocked',
      message: result.reason,
      fraudType: result.fraudType
    });
  }

  return next();
}