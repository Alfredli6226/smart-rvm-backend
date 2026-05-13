import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get query params
    const url = new URL(req.url);
    const merchantId = url.searchParams.get('merchant_id');
    const priority = url.searchParams.get('priority'); // 1, 2, 3, or all

    // Calculate days until full for a machine
    async function calculateDaysUntilFull(deviceNo: number | string, currentWeight: number, totalCapacity: number = 50) {
      const binCapacity = totalCapacity || 50;
      const remainingCapacity = binCapacity - currentWeight;
      if (remainingCapacity <= 0) return 0;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: submissions } = await supabase
        .from('submission_reviews')
        .select('api_weight')
        .eq('device_no', deviceNo)
        .gte('submitted_at', sevenDaysAgo.toISOString())
        .eq('status', 'VERIFIED');

      if (!submissions || submissions.length === 0) return Math.round(remainingCapacity / 5);

      const totalWeight = submissions.reduce((sum, s) => sum + (s.api_weight || 0), 0);
      const avgRate = totalWeight / 7;
      if (avgRate <= 0) return Math.round(remainingCapacity / 5);

      return Math.round(remainingCapacity / avgRate);
    }

    // Fetch all machines
    let query = supabase.from('machines').select('*').order('device_no');
    if (merchantId) {
      query = query.eq('merchant_id', merchantId);
    }

    const { data: machines, error } = await query;
    if (error) throw error;

    // Get submission data for fill levels
    const deviceNos = (machines || []).map(m => m.device_no);
    const { data: submissions } = await supabase
      .from('submission_reviews')
      .select('device_no, api_weight, submitted_at')
      .in('device_no', deviceNos)
      .gte('submitted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .eq('status', 'VERIFIED');

    // Calculate fill levels per machine
    const fillLevels: Record<string, number> = {};
    for (const sub of submissions || []) {
      fillLevels[sub.device_no] = (fillLevels[sub.device_no] || 0) + (sub.api_weight || 0);
    }

    // Rank machines by priority
    const prioritizedMachines = await Promise.all(
      (machines || []).map(async (machine) => {
        const weight = fillLevels[machine.device_no] || machine.current_bag_weight || 0;
        const fillPercent = Math.min(100, (weight / 50) * 100);
        const daysUntilFull = await calculateDaysUntilFull(machine.id, weight);
        
        // Determine priority
        let priorityLevel = 3; // Normal
        let priorityLabel = 'Normal';
        
        const isOffline = !machine.is_active && !machine.is_online;
        
        if (fillPercent >= 90 || isOffline) {
          priorityLevel = 1;
          priorityLabel = 'Critical';
        } else if (fillPercent >= 70 || daysUntilFull <= 1) {
          priorityLevel = 2;
          priorityLabel = 'Warning';
        }

        return {
          id: machine.id,
          device_no: machine.device_no,
          name: machine.name,
          address: machine.address,
          latitude: machine.latitude,
          longitude: machine.longitude,
          current_weight: weight,
          fill_percent: Math.round(fillPercent),
          days_until_full: daysUntilFull,
          is_online: machine.is_active || machine.is_online,
          is_offline: isOffline,
          priority: priorityLevel,
          priority_label: priorityLabel
        };
      })
    );

    // Sort: Critical first, then Warning, then Normal
    prioritizedMachines.sort((a, b) => a.priority - b.priority);

    // Filter if requested
    let result = prioritizedMachines;
    if (priority && priority !== 'all') {
      result = prioritizedMachines.filter(m => m.priority === parseInt(priority));
    }

    // Summary counts
    const summary = {
      critical: prioritizedMachines.filter(m => m.priority === 1).length,
      warning: prioritizedMachines.filter(m => m.priority === 2).length,
      normal: prioritizedMachines.filter(m => m.priority === 3).length,
      total: prioritizedMachines.length
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
        summary,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Collection Priority API Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});