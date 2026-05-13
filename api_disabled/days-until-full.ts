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

    // Get machine ID from query params (optional)
    const url = new URL(req.url);
    const machineId = url.searchParams.get('machine_id');

    // Calculate days until full for a machine
    async function calculateDaysUntilFull(deviceNo: number | string, currentWeight: number, totalCapacity: number = 50) {
      const binCapacity = totalCapacity || 50;
      const remainingCapacity = binCapacity - currentWeight;

      if (remainingCapacity <= 0) return 0;
      if (remainingCapacity >= binCapacity) return null;

      // Get last 7 days of weight data
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: submissions, error } = await supabase
        .from('submission_reviews')
        .select('api_weight, submitted_at')
        .eq('device_no', deviceNo)
        .gte('submitted_at', sevenDaysAgo.toISOString())
        .eq('status', 'VERIFIED');

      if (error || !submissions || submissions.length === 0) {
        // No data - estimate based on typical rate
        return Math.round(remainingCapacity / 5);
      }

      // Group weight by date and calculate average
      const dailyWeights: Record<string, number> = {};
      for (const sub of submissions) {
        const date = new Date(sub.submitted_at).toISOString().split('T')[0];
        dailyWeights[date] = (dailyWeights[date] || 0) + (sub.api_weight || 0);
      }

      const daysWithData = Object.keys(dailyWeights).length;
      const totalWeight = Object.values(dailyWeights).reduce((sum, w) => sum + w, 0);
      const averageDailyRate = totalWeight / daysWithData;

      if (averageDailyRate <= 0) {
        return Math.round(remainingCapacity / 5);
      }

      return Math.round(remainingCapacity / averageDailyRate);
    }

    // Get machines with Days Until Full calculation
    let query = supabase
      .from('machines')
      .select('*')
      .order('device_no');

    if (machineId) {
      query = query.eq('id', parseInt(machineId));
    }

    const { data: machines, error } = await query;

    if (error) throw error;

    // Add Days Until Full calculation to each machine
    const machinesWithDaysUntilFull = await Promise.all(
      (machines || []).map(async (machine) => {
        // Get latest weight from submission_reviews
        const { data: latestSubmission } = await supabase
          .from('submission_reviews')
          .select('current_bag_weight')
          .eq('device_no', machine.id)
          .order('submitted_at', { ascending: false })
          .limit(1)
          .single();

        // Use machine's current_bag_weight or estimate from DB
        const currentWeight = latestSubmission?.current_bag_weight || 
                             machine.current_bag_weight || 
                             (machine.compartments ? 25 : 0); // Default estimate if no data

        const daysUntilFull = await calculateDaysUntilFull(
          machine.id,
          typeof currentWeight === 'number' ? currentWeight : parseFloat(currentWeight) || 0
        );

        return {
          ...machine,
          estimated_full_days: daysUntilFull,
          full_estimate_label: daysUntilFull !== null 
            ? `Est. Full in ${daysUntilFull} Day${daysUntilFull !== 1 ? 's' : ''}`
            : 'Not Enough Data'
        };
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        data: machinesWithDaysUntilFull,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Days Until Full API Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
