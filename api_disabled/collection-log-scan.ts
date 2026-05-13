import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server Configuration Error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { method, body } = req;

  try {
    // ==========================================
    // POST /api/collection/log-scan
    // When collector scans an RVM QR code
    // ==========================================
    if (method === 'POST' && req.url?.includes('/log-scan')) {
      const { collector_id, device_no, collector_name, collector_phone } = body;

      if (!collector_id || !device_no) {
        return res.status(400).json({ error: 'Missing collector_id or device_no' });
      }

      // Fetch machine with compartments data
      const { data: machine, error: machineError } = await supabase
        .from('machines')
        .select('id, device_no, name, api_config, config_bin_1, config_bin_2')
        .eq('device_no', device_no)
        .single();

      if (machineError || !machine) {
        console.error('[Collection Log-Scan] Machine not found:', device_no, machineError);
        return res.status(404).json({ error: 'Machine not found' });
      }

      // Parse compartments to get current weights
      let initialWeight = 0;
      try {
        const configs = typeof machine.api_config === 'string' 
          ? JSON.parse(machine.api_config) 
          : (machine.api_config || []);
        const bin1 = configs.find((c: any) => c.positionNo === 1);
        const bin2 = configs.find((c: any) => c.positionNo === 2);
        if (bin1) initialWeight += Number(bin1.weight) || 0;
        if (bin2) initialWeight += Number(bin2.weight) || 0;
      } catch (e) {
        console.warn('[Collection Log-Scan] Could not parse API config:', e);
      }

      const startTime = new Date().toISOString();

      // Create collection report record with collector name and phone
      const { data: report, error: insertError } = await supabase
        .from('collection_reports')
        .insert({
          collector_id,
          collector_name: collector_name || null,
          collector_phone: collector_phone || null,
          machine_id: machine.id,
          device_no: machine.device_no,
          machine_name: machine.name,
          start_time: startTime,
          initial_weight: initialWeight,
          status: 'In Progress'
        })
        .select()
        .single();

      if (insertError) {
        console.error('[Collection Log-Scan] Insert error:', insertError);
        return res.status(500).json({ error: 'Failed to create collection report' });
      }

      return res.status(200).json({
        success: true,
        message: 'Collection scan logged successfully',
        data: {
          report_id: report.id,
          collector_id,
          collector_name: collector_name || null,
          collector_phone: collector_phone || null,
          device_no: machine.device_no,
          machine_name: machine.name,
          start_time: startTime,
          initial_weight: initialWeight,
          status: 'In Progress'
        }
      });
    }

    // ==========================================
    // POST /api/collection/complete
    // When collector completes collection
    // ==========================================
    if (method === 'POST' && req.url?.includes('/complete')) {
      const { collector_id, report_id, final_weight, collector_name, collector_phone } = body;

      if (!collector_id || !report_id) {
        return res.status(400).json({ error: 'Missing collector_id or report_id' });
      }

      // Fetch the existing report
      const { data: report, error: fetchError } = await supabase
        .from('collection_reports')
        .select('*')
        .eq('id', report_id)
        .eq('collector_id', collector_id)
        .single();

      if (fetchError || !report) {
        console.error('[Collection Complete] Report not found:', report_id);
        return res.status(404).json({ error: 'Collection report not found' });
      }

      const endTime = new Date().toISOString();
      const collectedWeight = final_weight || report.initial_weight || 0;

      // Update the collection report
      const { error: updateError } = await supabase
        .from('collection_reports')
        .update({
          end_time: endTime,
          final_weight: collectedWeight,
          status: 'Verified'
        })
        .eq('id', report_id);

      if (updateError) {
        console.error('[Collection Complete] Update error:', updateError);
        return res.status(500).json({ error: 'Failed to update collection report' });
      }

      // Reset the RVM's bin weights to 0
      const { data: machine, error: machineFetchError } = await supabase
        .from('machines')
        .select('id, api_config')
        .eq('id', report.machine_id)
        .single();

      if (!machineFetchError && machine?.api_config) {
        try {
          let configs = typeof machine.api_config === 'string' 
            ? JSON.parse(machine.api_config) 
            : (machine.api_config || []);
          
          configs = configs.map((c: any) => ({
            ...c,
            weight: 0,
            rate: 0,
            isFull: false
          }));

          const { error: updateError } = await supabase
            .from('machines')
            .update({ api_config: JSON.stringify(configs) })
            .eq('id', report.machine_id);

          if (updateError) {
            console.warn('[Collection Complete] Warning: Failed to reset bin weights:', updateError);
          }
        } catch (e) {
          console.warn('[Collection Complete] Warning: Could not reset bins:', e);
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Collection completed successfully',
        data: {
          report_id,
          collector_id,
          collector_name: collector_name || report.collector_name,
          collector_phone: collector_phone || report.collector_phone,
          device_no: report.device_no,
          machine_name: report.machine_name,
          start_time: report.start_time,
          end_time: endTime,
          initial_weight: report.initial_weight,
          final_weight: collectedWeight,
          status: 'Verified'
        }
      });
    }

    // ==========================================
    // GET /api/collection/reports
    // Admin: Fetch collection reports with SUM aggregations
    // ==========================================
    if (method === 'GET' && req.url?.includes('/reports')) {
      const startDate = req.query.start_date as string || '';
      const endDate = req.query.end_date as string || '';
      const groupBy = req.query.group_by as string || 'collector';

      let queryBuilder = supabase
        .from('collection_reports')
        .select('*')
        .order('start_time', { ascending: false });

      if (startDate) {
        queryBuilder = queryBuilder.gte('start_time', startDate);
      }
      if (endDate) {
        queryBuilder = queryBuilder.lte('start_time', endDate + 'T23:59:59');
      }

      const { data: reports, error } = await queryBuilder;

      if (error) {
        console.error('[Collection Reports] Query error:', error);
        throw error;
      }

      // Group by collector_id or device_no
      const byCollector: Record<string, any> = {};
      const byMachine: Record<string, any> = {};

      for (const r of reports || []) {
        // By Collector
        const collectorId = r.collector_id || 'unknown';
        if (!byCollector[collectorId]) {
          byCollector[collectorId] = {
            collector_id: collectorId,
            collector_name: r.collector_name || 'Unknown',
            collector_phone: r.collector_phone || '',
            total_weight: 0,
            total_collections: 0,
            reports: []
          };
        }
        byCollector[collectorId].total_weight += Number(r.final_weight) || 0;
        byCollector[collectorId].total_collections += 1;
        byCollector[collectorId].reports.push(r.id);

        // By Machine
        const machineKey = r.device_no || 'unknown';
        if (!byMachine[machineKey]) {
          byMachine[machineKey] = {
            device_no: machineKey,
            machine_name: r.machine_name,
            total_weight: 0,
            total_collections: 0,
            reports: []
          };
        }
        byMachine[machineKey].total_weight += Number(r.final_weight) || 0;
        byMachine[machineKey].total_collections += 1;
        byMachine[machineKey].reports.push(r.id);
      }

      return res.status(200).json({
        success: true,
        data: {
          by_collector: Object.values(byCollector),
          by_machine: Object.values(byMachine)
        },
        metadata: {
          total_reports: reports?.length || 0,
          start_date: startDate,
          end_date: endDate,
          group_by: groupBy
        }
      });
    }

    return res.status(404).json({ error: 'Endpoint not found' });

  } catch (error: any) {
    console.error('[Collection API] Uncaught error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}