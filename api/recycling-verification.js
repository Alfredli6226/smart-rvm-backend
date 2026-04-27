/**
 * Recycling Verification System
 * 
 * Complete workflow for:
 * 1. Image analysis (AI verification)
 * 2. Weight validation
 * 3. Points calculation
 * 4. Fraud detection
 */

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Points calculation: weight (kg) × 0.2 = points
const POINTS_PER_KG = 0.2;

// Material-specific validation ranges (kg)
const MATERIAL_WEIGHT_RANGES = {
  'plastic_bottle': { min: 0.01, max: 0.5, avg: 0.05 },
  'aluminium_can': { min: 0.01, max: 0.1, avg: 0.02 },
  'glass_bottle': { min: 0.1, max: 2.0, avg: 0.5 },
  'paper': { min: 0.01, max: 5.0, avg: 1.0 },
  'uco': { min: 0.5, max: 20.0, avg: 5.0 } // Used Cooking Oil
};

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { action } = req.query;

    switch (action) {
      case 'verify-recycling':
        return await verifyRecyclingActivity(supabase, req, res);
      case 'calculate-points':
        return await calculatePoints(supabase, req, res);
      case 'check-weight-consistency':
        return await checkWeightConsistency(supabase, req, res);
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Recycling verification error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

/**
 * Complete recycling activity verification
 */
async function verifyRecyclingActivity(supabase, req, res) {
  const { 
    userId, 
    machineId, 
    imageUrl, 
    weightKg, 
    materialType,
    timestamp 
  } = req.body;

  // Validate required fields
  if (!userId || !machineId || !imageUrl || !weightKg) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Step 1: AI Image Analysis
    const aiAnalysis = await analyzeRecyclingImage(imageUrl, materialType);
    
    // Step 2: Weight Validation
    const weightValidation = await validateWeight(weightKg, materialType, aiAnalysis);
    
    // Step 3: Fraud Detection
    const fraudCheck = await checkForFraud(userId, machineId, imageUrl, supabase);
    
    // Step 4: Calculate Points
    const points = calculatePointsFromWeight(weightKg);
    
    // Step 5: Overall Verification Result
    const verificationResult = {
      success: weightValidation.valid && fraudCheck.overallPassed,
      userId,
      machineId,
      timestamp: timestamp || new Date().toISOString(),
      aiAnalysis,
      weightValidation,
      fraudCheck,
      pointsAwarded: points,
      verificationScore: calculateVerificationScore(weightValidation, fraudCheck),
      recommendations: generateRecommendations(weightValidation, fraudCheck)
    };

    // Step 6: Save to database
    await saveVerificationResult(supabase, verificationResult);

    return res.status(200).json(verificationResult);

  } catch (error) {
    console.error('Verification failed:', error);
    return res.status(500).json({ 
      error: 'Verification failed',
      details: error.message 
    });
  }
}

/**
 * AI analysis of recycling image
 */
async function analyzeRecyclingImage(imageUrl, expectedMaterial) {
  // In production: Call Google Vision API, Clarifai, etc.
  // For now: Mock analysis with realistic data
  
  const materials = ['plastic_bottle', 'aluminium_can', 'glass_bottle', 'paper', 'uco'];
  const detectedMaterial = expectedMaterial || materials[Math.floor(Math.random() * materials.length)];
  
  return {
    service: 'ai_analysis',
    detectedMaterials: [
      { 
        name: detectedMaterial, 
        confidence: 0.85 + Math.random() * 0.1,
        count: Math.floor(Math.random() * 5) + 1
      }
    ],
    objectsDetected: [
      { name: 'recyclable_container', confidence: 0.88 },
      { name: 'person_hand', confidence: 0.75 },
      { name: 'recycling_machine', confidence: 0.92 }
    ],
    imageQuality: {
      brightness: 0.8,
      focus: 0.9,
      authenticity: 0.85  // Likelihood of being real photo vs stock image
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Validate weight against material type and AI analysis
 */
async function validateWeight(weightKg, materialType, aiAnalysis) {
  const range = MATERIAL_WEIGHT_RANGES[materialType] || MATERIAL_WEIGHT_RANGES.plastic_bottle;
  
  const isValid = weightKg >= range.min && weightKg <= range.max;
  const deviation = Math.abs(weightKg - range.avg) / range.avg;
  
  return {
    valid: isValid,
    weightKg,
    materialType,
    expectedRange: `${range.min}-${range.max} kg`,
    averageExpected: range.avg,
    deviationPercent: (deviation * 100).toFixed(1),
    confidence: isValid ? 0.9 : 0.3,
    issues: !isValid ? [
      `Weight ${weightKg}kg outside expected range ${range.min}-${range.max}kg`,
      deviation > 0.5 ? `Significant deviation from average (${range.avg}kg)` : null
    ].filter(Boolean) : []
  };
}

/**
 * Check for fraud patterns
 */
async function checkForFraud(userId, machineId, imageUrl, supabase) {
  const checks = [];
  
  // Check 1: Duplicate image detection
  const duplicateCheck = await checkDuplicateImage(imageUrl, supabase);
  checks.push(duplicateCheck);
  
  // Check 2: User submission frequency
  const frequencyCheck = await checkSubmissionFrequency(userId, supabase);
  checks.push(frequencyCheck);
  
  // Check 3: Machine consistency
  const machineCheck = await checkMachineConsistency(userId, machineId, supabase);
  checks.push(machineCheck);
  
  // Check 4: Time pattern analysis
  const timeCheck = await checkTimePatterns(userId, supabase);
  checks.push(timeCheck);
  
  const passedChecks = checks.filter(c => c.passed).length;
  const overallPassed = passedChecks >= 3; // Pass if 3/4 checks pass
  
  return {
    overallPassed,
    checks,
    passedChecks,
    totalChecks: checks.length,
    confidence: passedChecks / checks.length,
    riskLevel: overallPassed ? 'LOW' : 'HIGH'
  };
}

/**
 * Calculate points from weight
 */
function calculatePointsFromWeight(weightKg) {
  const points = weightKg * POINTS_PER_KG;
  return Math.round(points * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate overall verification score
 */
function calculateVerificationScore(weightValidation, fraudCheck) {
  const weightScore = weightValidation.confidence * 40; // 40% weight
  const fraudScore = fraudCheck.confidence * 60; // 60% fraud check
  
  return Math.round((weightScore + fraudScore) * 10) / 10; // 0-100 scale
}

/**
 * Generate recommendations based on verification
 */
function generateRecommendations(weightValidation, fraudCheck) {
  const recommendations = [];
  
  if (!weightValidation.valid) {
    recommendations.push({
      type: 'WEIGHT_ISSUE',
      priority: 'HIGH',
      message: `Weight validation failed. Expected ${weightValidation.expectedRange}kg, got ${weightValidation.weightKg}kg.`,
      action: 'Review weighing scale calibration'
    });
  }
  
  if (!fraudCheck.overallPassed) {
    recommendations.push({
      type: 'FRAUD_RISK',
      priority: 'HIGH',
      message: `Fraud detection failed (${fraudCheck.passedChecks}/${fraudCheck.totalChecks} checks passed).`,
      action: 'Manual review required'
    });
  }
  
  if (weightValidation.deviationPercent > 30) {
    recommendations.push({
      type: 'UNUSUAL_WEIGHT',
      priority: 'MEDIUM',
      message: `Weight deviation ${weightValidation.deviationPercent}% from average.`,
      action: 'Verify material type and count'
    });
  }
  
  return recommendations;
}

/**
 * Save verification result to database
 */
async function saveVerificationResult(supabase, result) {
  const { error } = await supabase
    .from('recycling_verifications')
    .insert({
      user_id: result.userId,
      machine_id: result.machineId,
      image_url: result.aiAnalysis?.imageUrl,
      weight_kg: result.weightValidation.weightKg,
      material_type: result.weightValidation.materialType,
      points_awarded: result.pointsAwarded,
      verification_score: result.verificationScore,
      ai_analysis: result.aiAnalysis,
      weight_validation: result.weightValidation,
      fraud_check: result.fraudCheck,
      verification_result: result.success,
      recommendations: result.recommendations,
      created_at: result.timestamp
    });
  
  if (error) {
    console.error('Failed to save verification result:', error);
    throw error;
  }
  
  return { success: true };
}

// Helper functions for fraud detection
async function checkDuplicateImage(imageUrl, supabase) {
  // In production: Use image hash comparison
  // For now: Mock check
  return {
    type: 'DUPLICATE_IMAGE',
    passed: true,
    confidence: 0.95,
    details: 'No duplicate images found'
  };
}

async function checkSubmissionFrequency(userId, supabase) {
  // Check user's last 24h submissions
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { count } = await supabase
    .from('recycling_verifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', twentyFourHoursAgo);
  
  const isExcessive = count > 10;
  
  return {
    type: 'SUBMISSION_FREQUENCY',
    passed: !isExcessive,
    confidence: 0.85,
    details: `${count} submissions in last 24h`,
    threshold: '10 submissions/24h'
  };
}

async function checkMachineConsistency(userId, machineId, supabase) {
  // Check if user typically uses this machine
  const { data: userHistory } = await supabase
    .from('recycling_verifications')
    .select('machine_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (!userHistory || userHistory.length === 0) {
    return {
      type: 'MACHINE_CONSISTENCY',
      passed: true, // First submission
      confidence: 0.7,
      details: 'First submission - no history'
    };
  }
  
  const usualMachines = [...new Set(userHistory.map(h => h.machine_id))];
  const isConsistent = usualMachines.includes(machineId) || usualMachines.length === 1;
  
  return {
    type: 'MACHINE_CONSISTENCY',
    passed: isConsistent,
    confidence: isConsistent ? 0.9 : 0.6,
    details: isConsistent 
      ? `Consistent with usual machine(s): ${usualMachines.join(', ')}`
      : `Unusual machine. History: ${usualMachines.join(', ')}`
  };
}

async function checkTimePatterns(userId, supabase) {
  // Check for unusual submission times
  const now = new Date();
  const hour = now.getHours();
  
  // Normal hours: 8 AM - 8 PM
  const isNormalHour = hour >= 8 && hour <= 20;
  
  return {
    type: 'TIME_PATTERN',
    passed: isNormalHour,
    confidence: 0.8,
    details: `Submission at ${hour}:00 ${isNormalHour ? '(normal hours)' : '(outside normal hours)'}`,
    normalRange: '8:00-20:00'
  };
}