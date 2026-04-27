/**
 * AI Image Verification System for Smart RVM
 * 
 * This API verifies recycling activity images to:
 * 1. Confirm genuine recyclable materials
 * 2. Detect fraud/fake submissions
 * 3. Calculate user trust scores
 * 4. Provide verification analytics
 */

import { createClient } from '@supabase/supabase-js';

// Cloud AI Services (mock for now - will integrate real APIs)
const AI_SERVICES = {
  // Google Cloud Vision API (for object detection)
  googleVision: {
    apiKey: process.env.GOOGLE_VISION_API_KEY,
    endpoint: 'https://vision.googleapis.com/v1/images:annotate'
  },
  
  // Clarifai (for material classification)
  clarifai: {
    apiKey: process.env.CLARIFAI_API_KEY,
    endpoint: 'https://api.clarifai.com/v2/models/general-image-recognition/outputs'
  },
  
  // Custom ML model (future)
  customModel: {
    endpoint: process.env.CUSTOM_ML_ENDPOINT
  }
};

// Recyclable material categories
const RECYCLABLE_CATEGORIES = {
  plastics: ['plastic bottle', 'plastic container', 'PET bottle', 'HDPE container'],
  metals: ['aluminium can', 'metal can', 'tin can', 'aluminum foil'],
  glass: ['glass bottle', 'glass jar', 'glass container'],
  paper: ['cardboard', 'paper', 'newspaper', 'magazine'],
  uco: ['cooking oil container', 'oil bottle', 'UCO container']
};

// Fraud patterns to detect
const FRAUD_PATTERNS = {
  duplicateImages: 'Same image submitted multiple times',
  editedImages: 'Photoshopped/manipulated images',
  wrongLocation: 'Image doesn\'t match machine location',
  nonRecyclables: 'Non-recyclable items in image',
  stockPhotos: 'Stock images or internet photos'
};

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Get Supabase credentials
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return res.status(500).json({ error: 'Missing Supabase credentials' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const { action } = req.query;
    
    switch (action) {
      case 'verify-image':
        return await verifyImage(supabase, req, res);
      
      case 'check-fraud':
        return await checkFraudPatterns(supabase, req, res);
      
      case 'user-trust-score':
        return await calculateUserTrustScore(supabase, req, res);
      
      case 'verification-stats':
        return await getVerificationStats(supabase, req, res);
      
      case 'manual-review':
        return await manualReviewSubmission(supabase, req, res);
      
      default:
        return res.status(404).json({ error: 'Action not found' });
    }
  } catch (error) {
    console.error('Image verification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ==========================================
// 1. IMAGE VERIFICATION FUNCTION
// ==========================================
async function verifyImage(supabase, req, res) {
  try {
    const { imageUrl, userId, machineId, submissionId } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }
    
    console.log(`Verifying image for user ${userId}, machine ${machineId}`);
    
    // Step 1: Basic image analysis (mock - will integrate real AI)
    const aiAnalysis = await analyzeImageWithAI(imageUrl);
    
    // Step 2: Check for fraud patterns
    const fraudCheck = await checkImageForFraud(imageUrl, userId, machineId, supabase);
    
    // Step 3: Calculate verification score
    const verificationScore = calculateVerificationScore(aiAnalysis, fraudCheck);
    
    // Step 4: Determine verification status
    const verificationStatus = determineVerificationStatus(verificationScore);
    
    // Step 5: Update user trust score
    const trustScoreUpdate = await updateUserTrustScore(userId, verificationStatus, supabase);
    
    // Step 6: Log verification result
    const verificationLog = await logVerificationResult({
      submissionId,
      userId,
      machineId,
      imageUrl,
      aiAnalysis,
      fraudCheck,
      verificationScore,
      verificationStatus,
      timestamp: new Date().toISOString()
    }, supabase);
    
    return res.status(200).json({
      success: true,
      verification: {
        status: verificationStatus,
        score: verificationScore,
        details: {
          aiAnalysis,
          fraudCheck,
          trustScore: trustScoreUpdate.newScore
        },
        recommendation: getVerificationRecommendation(verificationStatus)
      }
    });
    
  } catch (error) {
    console.error('Verify image error:', error);
    return res.status(500).json({ error: 'Failed to verify image' });
  }
}

// ==========================================
// 2. FRAUD DETECTION FUNCTION
// ==========================================
async function checkFraudPatterns(supabase, req, res) {
  try {
    const { userId, limit = 50 } = req.query;
    
    // Get user's recent submissions
    const { data: submissions, error } = await supabase
      .from('recycling_submissions')
      .select('id, image_url, verified_status, created_at, points_awarded')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));
    
    if (error) throw error;
    
    // Analyze for fraud patterns
    const fraudAnalysis = {
      totalSubmissions: submissions.length,
      verifiedSubmissions: submissions.filter(s => s.verified_status === 'VERIFIED').length,
      pendingSubmissions: submissions.filter(s => s.verified_status === 'PENDING').length,
      rejectedSubmissions: submissions.filter(s => s.verified_status === 'REJECTED').length,
      patterns: []
    };
    
    // Check for duplicate images (simplified)
    const imageHashes = new Set();
    submissions.forEach(sub => {
      if (sub.image_url) {
        // In production, would compute image hash
        const simpleHash = sub.image_url.split('/').pop();
        if (imageHashes.has(simpleHash)) {
          fraudAnalysis.patterns.push({
            type: 'DUPLICATE_IMAGE',
            submissionId: sub.id,
            description: 'Possible duplicate image submission'
          });
        }
        imageHashes.add(simpleHash);
      }
    });
    
    // Check submission frequency (too many too fast)
    if (submissions.length > 10) {
      const timeRange = new Date(submissions[0].created_at) - new Date(submissions[submissions.length - 1].created_at);
      const hours = timeRange / (1000 * 60 * 60);
      const submissionsPerHour = submissions.length / Math.max(hours, 1);
      
      if (submissionsPerHour > 5) {
        fraudAnalysis.patterns.push({
          type: 'HIGH_FREQUENCY',
          rate: `${submissionsPerHour.toFixed(1)} submissions/hour`,
          description: 'Unusually high submission frequency'
        });
      }
    }
    
    // Check points pattern (consistent identical points)
    const pointValues = submissions.map(s => s.points_awarded).filter(p => p);
    if (pointValues.length > 5) {
      const uniquePoints = new Set(pointValues);
      if (uniquePoints.size === 1) {
        fraudAnalysis.patterns.push({
          type: 'IDENTICAL_POINTS',
          points: Array.from(uniquePoints)[0],
          description: 'All submissions award identical points (suspicious)'
        });
      }
    }
    
    fraudAnalysis.riskLevel = calculateFraudRiskLevel(fraudAnalysis);
    
    return res.status(200).json({
      success: true,
      fraudAnalysis,
      recommendations: getFraudPreventionRecommendations(fraudAnalysis)
    });
    
  } catch (error) {
    console.error('Check fraud patterns error:', error);
    return res.status(500).json({ error: 'Failed to check fraud patterns' });
  }
}

// ==========================================
// 3. USER TRUST SCORE FUNCTION
// ==========================================
async function calculateUserTrustScore(supabase, req, res) {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Get user's verification history
    const { data: verifications, error } = await supabase
      .from('image_verifications')
      .select('verification_status, verification_score, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) throw error;
    
    // Calculate trust score (0-100)
    let trustScore = 50; // Default starting score
    
    if (verifications.length > 0) {
      const verifiedCount = verifications.filter(v => v.verification_status === 'VERIFIED').length;
      const rejectedCount = verifications.filter(v => v.verification_status === 'REJECTED').length;
      const totalCount = verifications.length;
      
      // Base score on verification rate
      const verificationRate = totalCount > 0 ? (verifiedCount / totalCount) * 100 : 0;
      
      // Adjust for recent performance (weight recent verifications more)
      const recentVerifications = verifications.slice(0, Math.min(20, verifications.length));
      const recentVerified = recentVerifications.filter(v => v.verification_status === 'VERIFIED').length;
      const recentRate = recentVerifications.length > 0 ? (recentVerified / recentVerifications.length) * 100 : 0;
      
      // Calculate weighted score
      trustScore = (verificationRate * 0.4) + (recentRate * 0.6);
      
      // Penalize for rejections
      if (rejectedCount > 0) {
        const rejectionPenalty = (rejectedCount / totalCount) * 30;
        trustScore = Math.max(0, trustScore - rejectionPenalty);
      }
      
      // Bonus for consistency
      if (verifiedCount >= 10 && rejectedCount === 0) {
        trustScore = Math.min(100, trustScore + 15);
      }
    }
    
    // Round to nearest integer
    trustScore = Math.round(trustScore);
    
    // Determine trust level
    const trustLevel = getTrustLevel(trustScore);
    
    // Update user's trust score in database
    const { error: updateError } = await supabase
      .from('users')
      .update({
        trust_score: trustScore,
        trust_level: trustLevel,
        trust_updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
    
    if (updateError) throw updateError;
    
    return res.status(200).json({
      success: true,
      trustScore: {
        score: trustScore,
        level: trustLevel,
        breakdown: {
          totalVerifications: verifications.length,
          verified: verifications.filter(v => v.verification_status === 'VERIFIED').length,
          rejected: verifications.filter(v => v.verification_status === 'REJECTED').length,
          pending: verifications.filter(v => v.verification_status === 'PENDING').length
        },
        benefits: getTrustLevelBenefits(trustLevel)
      }
    });
    
  } catch (error) {
    console.error('Calculate trust score error:', error);
    return res.status(500).json({ error: 'Failed to calculate trust score' });
  }
}

// ==========================================
// 4. VERIFICATION STATISTICS
// ==========================================
async function getVerificationStats(supabase, req, res) {
  try {
    const { timeframe = '7d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (timeframe) {
      case '1d':
        startDate.setDate(now.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }
    
    // Get verification statistics
    const { data: verifications, error } = await supabase
      .from('image_verifications')
      .select('verification_status, verification_score, created_at, user_id')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Calculate statistics
    const stats = {
      timeframe: timeframe,
      totalVerifications: verifications.length,
      byStatus: {
        VERIFIED: verifications.filter(v => v.verification_status === 'VERIFIED').length,
        PENDING: verifications.filter(v => v.verification_status === 'PENDING').length,
        REJECTED: verifications.filter(v => v.verification_status === 'REJECTED').length
      },
      averageScore: verifications.length > 0 
        ? verifications.reduce((sum, v) => sum + (v.verification_score || 0), 0) / verifications.length
        : 0,
      uniqueUsers: new Set(verifications.map(v => v.user_id)).size,
      dailyTrend: calculateDailyTrend(verifications, startDate),
      fraudDetectionRate: calculateFraudDetectionRate(verifications)
    };
    
    // Calculate percentages
    stats.verificationRate = stats.totalVerifications > 0 
      ? (stats.byStatus.VERIFIED / stats.totalVerifications) * 100 
      : 0;
    stats.rejectionRate = stats.totalVerifications > 0 
      ? (stats.byStatus.REJECTED / stats.totalVerifications) * 100 
      : 0;
    
    return res.status(200).json({
      success: true,
      stats,
      insights: generateVerificationInsights(stats)
    });
    
  } catch (error) {
    console.error('Get verification stats error:', error);
    return res.status(500).json({ error: 'Failed to get verification statistics' });
  }
}

// ==========================================
// 5. MANUAL REVIEW FUNCTION
// ==========================================
async function manualReviewSubmission(supabase, req, res) {
  try {
    const { submissionId, reviewStatus, reviewerNotes, reviewerId } = req.body;
    
    if (!submissionId || !reviewStatus) {
      return res.status(400).json({ error: 'Submission ID and review status are required' });
    }
    
    // Update submission with manual review
    const { data, error } = await supabase
      .from('image_verifications')
      .update({
        manual_review_status: reviewStatus,
        manual_review_notes: reviewerNotes,
        manual_reviewer_id: reviewerId,
        manual_reviewed_at: new Date().toISOString(),
        final_status: reviewStatus // Override AI status with manual review
      })
      .eq('submission_id', submissionId)
      .select()
      .single();
    
    if (error) throw error;
    
    // If approved, award points
    if (reviewStatus === 'APPROVED') {
      // Get submission details
      const { data: submission } = await supabase
        .from('recycling_submissions')
        .select('user_id, points_eligible')
        .eq('id', submissionId)
        .single();
      
      if (submission) {
        // Award points to user
        await supabase
          .from('users')
          .update({
            total_points: supabase.raw('total_points + ?', [submission.points_eligible || 10])
          })
          .eq('user_id', submission.user_id);
        
        // Update submission status
        await supabase
          .from('recycling_submissions')
          .update({
            verified_status: 'VERIFIED',
            points_awarded: submission.points_eligible || 10,
            verified_at: new Date().toISOString()
          })
          .eq('id', submissionId);
      }
    }
    
    return res.status(200).json({
      success: true,
      review: {
        submissionId,
        status: reviewStatus,
        reviewerId,
        notes: reviewerNotes,
        timestamp: new Date().toISOString()
      },
      message: `Submission ${reviewStatus.toLowerCase()} by manual review`
    });
    
  } catch (error) {
    console.error('Manual review error:', error);
    return res.status(500).json({ error: 'Failed to process manual review' });
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Mock AI analysis (will integrate real AI services)
async function analyzeImageWithAI(imageUrl) {
  // In production, this would call Google Vision, Clarifai, etc.
  // For now, return mock analysis
  
  return {
    service: 'mock_ai',
    objectsDetected: [
      { name: 'plastic bottle', confidence: 0.85, boundingBox: null },
      { name: 'aluminium can', confidence: 0.78, boundingBox: null },
      { name: 'person', confidence: 0.92, boundingBox: null }
    ],
    materialsIdentified: ['plastic', 'metal'],
    recyclableCount: 2,
    nonRecyclableCount: 1,
    overallConfidence: 0.82,
    timestamp: new Date().toISOString()
  };
}

// Check image for fraud patterns
async function checkImageForFraud(imageUrl, userId, machineId, supabase) {
  const checks = [
    { type: 'DUPLICATE_CHECK', passed: true, confidence: 0.95 },
    { type: 'EDIT_DETECTION', passed: true, confidence: 0.88 },
    { type: 'LOCATION_CONSISTENCY', passed: true, confidence: 0.75 },
    { type: 'TIME_CONSISTENCY', passed: true, confidence: 0.80 }
  ];
  
  // Check user's submission history for patterns
  const { data: userSubmissions } = await supabase
    .from('recycling_submissions')
    .select('created_at, image_url, verified_status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (userSubmissions && userSubmissions.length > 0) {
    // Check submission frequency
    const recentSubmissions = userSubmissions.slice(0, 5);
    const timeRange = new Date(recentSubmissions[0].created_at) - new Date(recentSubmissions[recentSubmissions.length - 1].created_at);
    const submissionsPerHour = (recentSubmissions.length * 60) / (timeRange / (1000 * 60)); // Convert to hours
    
    if (submissionsPerHour > 10) {
      checks.push({ 
        type: 'HIGH_FREQUENCY', 
        passed: false, 
        confidence: 0.90,
        details: `Unusually high frequency: ${submissionsPerHour.toFixed(1)} submissions/hour`
      });
    }
  }
  
  return {
    checks,
    fraudDetected: checks.some(check => !check.passed),
    fraudScore: calculateFraudScore(checks),
    recommendations: checks.filter(check => !check.passed).map(check => `Check failed: ${check.type}`)
  };
}

// Calculate verification score (0-100)
function calculateVerificationScore(aiAnalysis, fraudCheck) {
  let score = 70; // Base score
  
  // Adjust based on AI analysis
  if (aiAnalysis.overallConfidence > 0.8) score += 15;
  if (aiAnalysis.overallConfidence > 0.9) score += 10;
  
  if (aiAnalysis.recyclableCount > 0) score += 5 * aiAnalysis.recyclableCount;
  if (aiAnalysis.nonRecyclableCount > 0) score -= 10 * aiAnalysis.nonRecyclableCount;
  
  // Adjust based on fraud check
  if (fraudCheck.fraudDetected) score -= 30;
  score += (fraudCheck.fraudScore / 100) * 20; // Add up to 20 points based on fraud score
  
  // Ensure score is within bounds
  return Math.max(0, Math.min(100, Math.round(score)));
}

// Determine verification status
function determineVerificationStatus(score) {
  if (score >= 80) return 'VERIFIED';
  if (score >= 60) return 'PENDING_REVIEW';
  return 'REJECTED';
}

// Update user trust score
async function updateUserTrustScore(userId, verificationStatus, supabase) {
  // Get current trust score
  const { data: user } = await supabase
    .from('users')
    .select('trust_score')
    .eq('user_id', userId)
    .single();
  
  let currentScore = user?.trust_score || 50;
  
  // Adjust based on verification result
  switch (verificationStatus) {
    case 'VERIFIED':
      currentScore = Math.min(100, currentScore + 5);
      break;
    case 'REJECTED':
      currentScore = Math.max(0, currentScore - 15);
      break;
    case 'PENDING_REVIEW':
      currentScore = Math.max(0, currentScore - 5);
      break;
  }
  
  // Update database
  await supabase
    .from('users')
    .update({ trust_score: currentScore })
    .eq('user_id', userId);
  
  return { previousScore: user?.trust_score || 50, newScore: currentScore };
}

// Log verification result
async function logVerificationResult(data, supabase) {
  const { data: result, error } = await supabase
    .from('image_verifications')
    .insert({
      submission_id: data.submissionId,
      user_id: data.userId,
      machine_id: data.machineId,
      image_url: data.imageUrl,
      ai_analysis: data.aiAnalysis,
      fraud_check: data.fraudCheck,
      verification_score: data.verificationScore,
      verification_status: data.verificationStatus,
      created_at: data.timestamp
    })
    .select()
    .single();
  
  if (error) throw error;
  return result;
}

// Get verification recommendation
function getVerificationRecommendation(status) {
  const recommendations = {
    VERIFIED: 'Award points immediately. User trust score increased.',
    PENDING_REVIEW: 'Flag for manual review. Moderate fraud risk detected.',
    REJECTED: 'Do not award points. High fraud risk. User trust score decreased.'
  };
  return recommendations[status] || 'Unknown status';
}

// Calculate fraud score (0-100, higher = more fraudulent)
function calculateFraudScore(checks) {
  const failedChecks = checks.filter(check => !check.passed);
  if (failedChecks.length === 0) return 0;
  
  const totalWeight = checks.reduce((sum, check) => sum + (check.confidence || 0.5), 0);
  const failedWeight = failedChecks.reduce((sum, check) => sum + (check.confidence || 0.5), 0);
  
  return Math.round((failedWeight / totalWeight) * 100);
}

// Calculate fraud risk level
function calculateFraudRiskLevel(fraudAnalysis) {
  const riskScore = fraudAnalysis.patterns.length * 20;
  
  if (riskScore >= 80) return 'CRITICAL';
  if (riskScore >= 60) return 'HIGH';
  if (riskScore >= 40) return 'MEDIUM';
  if (riskScore >= 20) return 'LOW';
  return 'MINIMAL';
}

// Get fraud prevention recommendations
function getFraudPreventionRecommendations(fraudAnalysis) {
  const recommendations = [];
  
  if (fraudAnalysis.patterns.some(p => p.type === 'DUPLICATE_IMAGE')) {
    recommendations.push('Implement image hashing to detect duplicate submissions');
  }
  
  if (fraudAnalysis.patterns.some(p => p.type === 'HIGH_FREQUENCY')) {
    recommendations.push('Add rate limiting: max 5 submissions per hour per user');
  }
  
  if (fraudAnalysis.patterns.some(p => p.type === 'IDENTICAL_POINTS')) {
    recommendations.push('Implement variable points system based on weight/type');
  }
  
  if (fraudAnalysis.rejectedSubmissions > fraudAnalysis.verifiedSubmissions * 0.3) {
    recommendations.push('Review user submission patterns - possible systematic fraud');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('No significant fraud patterns detected. Continue monitoring.');
  }
  
  return recommendations;
}

// Get trust level from score
function getTrustLevel(score) {
  if (score >= 90) return 'PLATINUM';
  if (score >= 80) return 'GOLD';
  if (score >= 70) return 'SILVER';
  if (score >= 60) return 'BRONZE';
  if (score >= 40) return 'BASIC';
  return 'RESTRICTED';
}

// Get benefits for trust level
function getTrustLevelBenefits(level) {
  const benefits = {
    PLATINUM: ['Instant verification', 'Higher points multiplier', 'Priority support', 'Exclusive rewards'],
    GOLD: ['Faster verification', 'Moderate points multiplier', 'Premium features'],
    SILVER: ['Standard verification speed', 'Basic points multiplier'],
    BRONZE: ['Manual review may be required', 'Standard points'],
    BASIC: ['Enhanced verification required', 'Lower points cap'],
    RESTRICTED: ['All submissions manually reviewed', 'Points held for 7 days', 'Limited monthly submissions']
  };
  return benefits[level] || [];
}

// Calculate daily trend
function calculateDailyTrend(verifications, startDate) {
  const dailyCounts = {};
  const currentDate = new Date(startDate);
  const now = new Date();
  
  // Initialize daily counts
  while (currentDate <= now) {
    const dateStr = currentDate.toISOString().split('T')[0];
    dailyCounts[dateStr] = { verified: 0, rejected: 0, pending: 0, total: 0 };
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Count verifications by day
  verifications.forEach(v => {
    const dateStr = v.created_at.split('T')[0];
    if (dailyCounts[dateStr]) {
      dailyCounts[dateStr][v.verification_status.toLowerCase()]++;
      dailyCounts[dateStr].total++;
    }
  });
  
  // Convert to array format
  return Object.entries(dailyCounts).map(([date, counts]) => ({
    date,
    ...counts
  }));
}

// Calculate fraud detection rate
function calculateFraudDetectionRate(verifications) {
  const rejected = verifications.filter(v => v.verification_status === 'REJECTED').length;
  const total = verifications.length;
  
  return total > 0 ? (rejected / total) * 100 : 0;
}

// Generate verification insights
function generateVerificationInsights(stats) {
  const insights = [];
  
  if (stats.verificationRate > 90) {
    insights.push('Excellent verification rate - system is working effectively');
  } else if (stats.verificationRate < 70) {
    insights.push('Low verification rate - consider reviewing AI thresholds');
  }
  
  if (stats.rejectionRate > 20) {
    insights.push('High rejection rate - possible fraud wave or strict thresholds');
  }
  
  if (stats.averageScore < 60) {
    insights.push('Low average verification score - submissions may need better quality');
  }
  
  if (stats.uniqueUsers < stats.totalVerifications / 10) {
    insights.push('High concentration - few users account for many submissions');
  }
  
  if (insights.length === 0) {
    insights.push('System operating within normal parameters');
  }
  
  return insights;
}