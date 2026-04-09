import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
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
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get request body
    const { device_nos } = await req.json();

    if (!device_nos || !Array.isArray(device_nos) || device_nos.length === 0) {
      return new Response(
        JSON.stringify({ error: 'device_nos array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update submissions as delivered
    const { data, error } = await supabase
      .from('submission_reviews')
      .update({
        is_delivered: true,
        delivered_at: new Date().toISOString(),
        delivered_by: user.email
      })
      .in('device_no', device_nos)
      .eq('status', 'VERIFIED')  // Only mark verified submissions as delivered
      .eq('is_delivered', false); // Only undelivered ones

    if (error) {
      console.error('Error offloading truck:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get count of updated records
    const { count } = await supabase
      .from('submission_reviews')
      .select('*', { count: 'exact', head: true })
      .in('device_no', device_nos)
      .eq('status', 'VERIFIED')
      .eq('is_delivered', true)
      .gte('delivered_at', new Date().toISOString().split('T')[0]);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Truck offloaded successfully! ${count || 0} submissions marked as delivered.`,
        delivered_count: count || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
