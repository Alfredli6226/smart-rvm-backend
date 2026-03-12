<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  BookOpen, ShieldCheck, Settings, Server, Users,
  AlertTriangle, CornerDownRight, RefreshCw, HelpCircle, Wrench,
  CheckCircle2
} from 'lucide-vue-next';

const activeSection = ref('concept');

const scrollTo = (id: string) => {
  activeSection.value = id;
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

onMounted(() => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        activeSection.value = entry.target.id;
      }
    });
  }, { 
    // Trigger as soon as the section touches the top area of screen
    rootMargin: '-20% 0px -60% 0px', 
    threshold: 0 
  });

  ['concept', 'withdrawals', 'machines', 'maintenance', 'clients'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex">
    
    <div class="flex-1 max-w-5xl mx-auto p-8 pl-12">
      
      <div class="mb-12">
        <h1 class="text-4xl font-extrabold text-gray-900 flex items-center gap-3">
          <BookOpen class="w-10 h-10 text-blue-600"/> Admin Operations Manual
        </h1>
        <p class="mt-4 text-xl text-gray-600 leading-relaxed">
          The official guide for managing the <strong>Dual-Backend System</strong>. 
          Because we rely on AutoGCM hardware, many actions require **Manual Synchronization** across both platforms.
        </p>
      </div>

      <section id="concept" class="mb-16 scroll-mt-24">
        <div class="bg-blue-600 text-white rounded-2xl p-8 shadow-lg">
          <h2 class="text-2xl font-bold mb-4 flex items-center gap-2">
            <Server class="w-6 h-6"/> The "Two-Way Sync" Strategy
          </h2>
          <p class="mb-6 opacity-90 text-lg leading-relaxed">
            Since 98% of users still operate on the legacy AutoGCM system, we must treat the <strong>AutoGCM Backend</strong> as the <strong>Reference Truth</strong>.
          </p>
          <div class="grid grid-cols-2 gap-6">
            <div class="bg-white/10 p-4 rounded-xl border border-white/20">
              <span class="text-blue-200 text-sm font-bold uppercase tracking-wider">Syncs Up (Input)</span>
              <p class="mt-2 text-lg font-medium">
                The machine sends data to us. We update our app balance automatically.
              </p>
            </div>
            <div class="bg-white/10 p-4 rounded-xl border border-white/20">
              <span class="text-blue-200 text-sm font-bold uppercase tracking-wider">Syncs Down (Output)</span>
              <p class="mt-2 text-lg font-medium">
                When a user withdraws here, you MUST manually update AutoGCM to match.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="withdrawals" class="mb-16 scroll-mt-24">
        <h2 class="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-3 border-b pb-4">
          <ShieldCheck class="w-8 h-8 text-green-600"/> Withdrawal SOP
        </h2>

        <div class="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-10 flex items-start gap-4 shadow-sm">
          <div class="bg-amber-100 p-3 rounded-full shrink-0">
            <AlertTriangle class="w-8 h-8 text-amber-700"/>
          </div>
          <div>
            <h3 class="font-bold text-amber-900 text-xl">Golden Rule: The Manual Deduction</h3>
            <p class="text-amber-900 mt-2 text-lg leading-relaxed">
              Any time money leaves the <strong>New App</strong>, you <strong>MUST</strong> manually remove the corresponding points from the <strong>Old Backend</strong>. If you fail to do this, the user can withdraw the same points twice.
            </p>
          </div>
        </div>

        <div class="bg-slate-50 border border-slate-200 rounded-xl p-8 mb-12">
          <h3 class="font-bold text-slate-900 text-xl flex items-center gap-2 mb-4">
            <RefreshCw class="w-6 h-6 text-slate-600"/> Routine Maintenance: Daily Global Audit
          </h3>
          <p class="text-slate-700 mb-4 text-base font-medium">
            <strong>Frequency:</strong> Run this DAILY (Recommended: Every Morning at 9:00 AM).
          </p>
          
          <div class="grid md:grid-cols-2 gap-8 items-start">
            <ol class="list-decimal pl-6 space-y-3 text-slate-800 text-base leading-relaxed">
              <li>Navigate to the <strong>Withdrawals</strong> page.</li>
              <li>
                Click the <strong>"Global Audit"</strong> button (Top Right).
                <p class="text-sm text-slate-500 mt-1">This triggers the sync process.</p>
              </li>
              <li>
                <strong>Purpose:</strong>
                <ul class="list-disc pl-6 mt-2 text-slate-600 space-y-1 text-sm">
                  <li><em>Syncs Up:</em> Pulls new points from yesterday.</li>
                  <li><em>Syncs Down:</em> Detects external spending.</li>
                </ul>
              </li>
            </ol>

            <div class="rounded-lg overflow-hidden border border-slate-200 shadow-sm bg-white">
              <img 
                src="/docs/global-audit.png" 
                alt="Location of Global Audit Button" 
                class="w-full h-auto object-cover"
              />
              <div class="bg-slate-100 p-2 text-xs text-slate-600 text-center font-medium border-t border-slate-200">
                Look for this button in the top-right corner
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-12 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
          
          <div class="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div class="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-200 group-[.is-active]:bg-blue-600 group-[.is-active]:text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow font-bold z-10 text-lg">
              1
            </div>
            <div class="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 class="font-bold text-gray-900 text-xl">Open Request</h3>
              <p class="text-base text-gray-700 mt-2 leading-relaxed">Navigate to <strong>Withdrawals > Pending</strong> and open the request details.</p>
            </div>
          </div>

          <div class="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div class="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-200 group-[.is-active]:bg-blue-600 group-[.is-active]:text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow font-bold z-10 text-lg">
              2
            </div>
            <div class="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 class="font-bold text-gray-900 text-xl">Run Live Safety Check</h3>
              <p class="text-base text-gray-700 mt-2">Click <strong>"Check Live Balance"</strong>.</p>
              <ul class="mt-3 space-y-3 text-base">
                <li class="flex items-start gap-2 text-green-700 bg-green-50 p-2 rounded-lg">
                  <CheckCircle2 class="w-5 h-5 shrink-0 mt-0.5"/>
                  <span><span class="font-bold">MATCHED:</span> User verified. Proceed to Step 3.</span>
                </li>
                <li class="flex items-start gap-2 text-red-700 bg-red-50 p-2 rounded-lg">
                  <AlertTriangle class="w-5 h-5 shrink-0 mt-0.5"/>
                  <span><span class="font-bold">RISK DETECTED:</span> User balance lower on Old App. System auto-adjusted. Check if funds sufficient.</span>
                </li>
              </ul>
              <div class="mt-4 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                <img 
                  src="/docs/modal-check.png" 
                  alt="Screenshot of Safety Check Modal" 
                  class="w-full h-auto object-cover"
                />
              </div>
            </div>
          </div>

          <div class="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div class="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-200 group-[.is-active]:bg-purple-600 group-[.is-active]:text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow font-bold z-10 text-lg">
              3
            </div>
            <div class="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded-xl border border-purple-200 shadow-md ring-1 ring-purple-100">
              <h3 class="font-bold text-purple-900 text-xl flex items-center gap-2">
                The "Duplicate Check" <span class="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full uppercase tracking-wide">Crucial</span>
              </h3>
              <p class="text-base text-purple-900 mt-2 font-medium">
                Ensure the user didn't already request this on the Old App.
              </p>
              <ol class="list-decimal pl-5 mt-4 space-y-3 text-base text-gray-800 leading-relaxed">
                <li>Log in to <strong>Legacy AutoGCM Backend</strong>.</li>
                <li>Check <strong>Withdrawal History</strong> tab.</li>
                <li>
                  <strong>Scenario A:</strong> Pending request exists for same amount? <br>
                  <span class="text-red-600 font-bold bg-red-50 px-2 rounded">ACTION: REJECT IMMEDIATELY.</span>
                </li>
                <li>
                  <strong>Scenario B:</strong> No recent request? <br>
                  <span class="text-green-600 font-bold bg-green-50 px-2 rounded">ACTION: Proceed to Step 4.</span>
                </li>
              </ol>
              <div class="mt-4 rounded-lg overflow-hidden border border-purple-200 shadow-sm">
                <img 
                  src="/docs/autogcm-history.png" 
                  alt="Screenshot of AutoGCM History Tab" 
                  class="w-full h-auto object-cover opacity-90 hover:opacity-100 transition"
                />
              </div>
            </div>
          </div>

          <div class="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div class="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-200 group-[.is-active]:bg-blue-600 group-[.is-active]:text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow font-bold z-10 text-lg">
              4
            </div>
            <div class="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 class="font-bold text-gray-900 text-xl">The Manual Deduction</h3>
              <p class="text-base text-gray-700 mt-2">If legitimate (Scenario B):</p>
              <ul class="list-disc pl-5 mt-3 space-y-2 text-base text-gray-800 leading-relaxed">
                <li>On <strong>Legacy Backend</strong>, manually deduct the exact amount.</li>
                <li><em>Example:</em> Withdraw RM10 (10pts) here -> Deduct 10pts there.</li>
                <li>Go back to New Admin Modal.</li>
                <li>Tick: <em>"I confirm points are deducted."</em></li>
                <li>Click <strong>Approve & Pay</strong>.</li>
              </ul>
            </div>
          </div>

        </div>

        <div class="mt-12 bg-gray-100 rounded-xl p-6 border border-gray-200">
          <h3 class="font-bold text-gray-800 text-lg mb-3 flex items-center gap-2">
            <HelpCircle class="w-6 h-6"/> Troubleshooting Sync Issues
          </h3>
          <p class="text-base text-gray-700 mb-2">
            <strong>Scenario:</strong> User claims "I withdrew on the New App, but Old App still shows full balance!"
          </p>
          <div class="mt-3 pl-4 border-l-4 border-red-400 space-y-2">
            <p class="text-base text-gray-800"><strong>Cause:</strong> Admin skipped Step 4.</p>
            <p class="text-base text-gray-800"><strong>Fix:</strong> Log in to AutoGCM immediately and deduct points to correct the record.</p>
          </div>
        </div>

      </section>

      <section id="machines" class="mb-16 scroll-mt-24">
        <h2 class="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-3 border-b pb-4">
          <Settings class="w-8 h-8 text-purple-600"/> Machine Management
        </h2>

        <div class="space-y-6">
          
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 class="text-xl font-bold text-gray-900 mb-2">Changing Machine Names</h3>
            <div class="bg-slate-50 p-4 rounded-lg border border-slate-200 text-base leading-relaxed">
              <strong class="text-slate-800">⚠️ IMPORTANT:</strong> Renaming it here <strong>DOES NOT</strong> change the name on the physical machine screen. It only changes it on our App map.
            </div>
          </div>

          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 class="text-xl font-bold text-gray-900 mb-4">Price & Point Configuration</h3>
            
            <div class="flex flex-col gap-4">
              <div class="flex items-center gap-4 p-4 bg-green-50 rounded-lg border border-green-100">
                <div class="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center text-green-700 font-bold shrink-0">1</div>
                <div>
                  <span class="font-bold text-green-900 text-lg">Update Our Dashboard</span>
                  <p class="text-base text-green-800 mt-1">Ensures the User App calculates and displays the correct value.</p>
                </div>
              </div>
              
              <div class="flex justify-center"><CornerDownRight class="text-gray-300"/></div>

              <div class="flex items-center gap-4 p-4 bg-red-50 rounded-lg border border-red-100">
                <div class="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center text-red-700 font-bold shrink-0">2</div>
                <div>
                  <span class="font-bold text-red-900 text-lg">Update AutoGCM Firmware</span>
                  <p class="text-base text-red-800 mt-1">You MUST log in to AutoGCM and update the device setting.</p>
                </div>
              </div>
            </div>

            <div class="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h4 class="font-bold text-amber-900 flex items-center gap-2 text-lg">
                <AlertTriangle class="w-5 h-5"/> Point Display Warning
              </h4>
              <p class="text-base text-amber-900 mt-2 leading-relaxed">
                <strong>Software vs. Hardware:</strong> Setting the "Points per Bottle" here <em>only</em> updates the processing logic for our <strong>User Web App</strong>.
              </p>
              <p class="text-base text-amber-900 mt-2 leading-relaxed">
                It <strong>DOES NOT</strong> change the points displayed on the physical machine screen during a session. To ensure the machine screen matches the app, you must manually update the machine settings in the AutoGCM backend as well.
              </p>
            </div>
            
            <div class="mt-8 space-y-8">
              
              <div class="space-y-3">
                <div class="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <div class="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs">A</div>
                  Click "Settings"
                </div>
                
                <div class="rounded-lg overflow-hidden border border-gray-200 shadow-sm group max-w-xs">
                  <img 
                    src="/docs/price-menu.png" 
                    alt="Screenshot of Settings Menu" 
                    class="w-full h-auto object-cover border-b border-gray-100"
                  />
                </div>
                <p class="text-xs text-gray-500">Navigate to the Merchant/Client Settings page.</p>
              </div>

              <div class="space-y-3">
                <div class="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <div class="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs">B</div>
                  Update Values
                </div>
                <div class="rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                  <img 
                    src="/docs/price-page.png" 
                    alt="Screenshot of Price Configuration Form" 
                    class="w-full h-auto object-cover"
                  />
                </div>
                <p class="text-xs text-gray-500">Change the Price/Points and click Save.</p>
              </div>

            </div>
          </div>
        </div>
      </section>

      <section id="maintenance" class="mb-16 scroll-mt-24">
        <h2 class="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-3 border-b pb-4">
          <Wrench class="w-8 h-8 text-orange-600"/> Maintenance & Logs
        </h2>

        <div class="space-y-6">
          
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 class="text-xl font-bold text-gray-900 mb-2">Handling "Bin Full" & Cleaning</h3>
            <div class="grid md:grid-cols-2 gap-6 mt-4">
              
              <div class="p-4 bg-orange-50 border border-orange-100 rounded-lg">
                <span class="font-bold text-orange-900 block mb-2 text-lg">Step 1: Check Waste Logs</span>
                <p class="text-base text-orange-800 leading-relaxed">
                  Go to the <strong>Waste Logs</strong> page. If a machine reports "Bin Full", users cannot recycle.
                </p>
              </div>

              <div class="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <span class="font-bold text-blue-900 block mb-2 text-lg">Step 2: Physical Reset Required</span>
                <p class="text-base text-blue-800 leading-relaxed">
                  After emptying the bin, you <strong>MUST</strong> reset the weight sensor on the physical machine (or via AutoGCM backend).
                </p>
                <div class="mt-3 text-sm font-bold text-blue-700 bg-blue-100 p-1 px-2 rounded inline-block">
                  ⚠️ Dashboard cannot reset sensors
                </div>
              </div>

            </div>
          </div>

          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 class="text-xl font-bold text-gray-900 mb-2">Missing Submissions? (Force Sync)</h3>
            <p class="text-gray-600 mb-4 text-base">
              If AutoGCM shows a submission but our table is empty, the Webhook may have failed.
            </p>

            <div class="flex flex-col md:flex-row gap-6 items-start">
              <div class="flex-1 space-y-4">
                <div class="p-4 bg-red-50 border border-red-100 rounded-lg text-base text-red-800 leading-relaxed">
                  <strong>Symptom:</strong> User claims points are missing, but the machine screen showed success.
                </div>
                <ol class="list-decimal pl-5 space-y-3 text-base text-gray-700 leading-relaxed">
                  <li>Go to <strong>Submissions</strong> page.</li>
                  <li>Click <strong>"Force Sync"</strong> (or "Sync Missing").</li>
                  <li>Wait 1-2 minutes for the process to complete.</li>
                  <li>If data is still missing: <span class="font-bold text-red-600">Escalate to Software Team immediately.</span></li>
                </ol>
              </div>
              
              <div class="w-full md:w-96 shrink-0 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-50">
                 <img 
                    src="/docs/force-fetch.png" 
                    alt="Location of Force Fetch Button" 
                    class="w-full h-auto object-cover"
                 />
              </div>
            </div>
          </div>

        </div>
      </section>  

      <section id="clients" class="mb-24 scroll-mt-24">
        <h2 class="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-3 border-b pb-4">
          <Users class="w-8 h-8 text-indigo-600"/> Client & Merchant Settings
        </h2>
        <div class="prose text-gray-600 text-lg leading-relaxed">
          <ul class="list-disc pl-5 space-y-3 mt-4">
            <li><strong>Access:</strong> Clients only see <em>Our Dashboard</em>.</li>
            <li><strong>AutoGCM Access:</strong> Must be invited separately on the AutoGCM portal for hardware errors.</li>
          </ul>
        </div>
      </section>

    </div>

    <div class="w-80 p-8 hidden xl:block relative">
      <div class="fixed w-72 space-y-6">
        <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">On this page</h3>
        
        <nav class="space-y-1 border-l-2 border-gray-100">
          
          <button @click="scrollTo('concept')" 
            :class="['block w-full text-left pl-4 py-2 text-sm transition-all -ml-[2px]', activeSection === 'concept' ? 'text-blue-600 border-l-2 border-blue-600 font-bold bg-blue-50/50' : 'text-gray-600 hover:text-blue-600 hover:border-l-2 hover:border-blue-600']">
            The "Split Brain" Concept
          </button>

          <button @click="scrollTo('withdrawals')" 
            :class="['block w-full text-left pl-4 py-2 text-sm transition-all -ml-[2px]', activeSection === 'withdrawals' ? 'text-green-600 border-l-2 border-green-600 font-bold bg-green-50/50' : 'text-gray-600 hover:text-green-600 hover:border-l-2 hover:border-green-600']">
            Withdrawal SOP
          </button>

          <button @click="scrollTo('machines')" 
            :class="['block w-full text-left pl-4 py-2 text-sm transition-all -ml-[2px]', activeSection === 'machines' ? 'text-purple-600 border-l-2 border-purple-600 font-bold bg-purple-50/50' : 'text-gray-600 hover:text-purple-600 hover:border-l-2 hover:border-purple-600']">
            Machine Settings
          </button>

          <button @click="scrollTo('maintenance')" 
            :class="['block w-full text-left pl-4 py-2 text-sm transition-all -ml-[2px]', activeSection === 'maintenance' ? 'text-orange-600 border-l-2 border-orange-600 font-bold bg-orange-50/50' : 'text-gray-600 hover:text-orange-600 hover:border-l-2 hover:border-orange-600']">
            Maintenance & Logs
          </button>

          <button @click="scrollTo('clients')" 
            :class="['block w-full text-left pl-4 py-2 text-sm transition-all -ml-[2px]', activeSection === 'clients' ? 'text-indigo-600 border-l-2 border-indigo-600 font-bold bg-indigo-50/50' : 'text-gray-600 hover:text-indigo-600 hover:border-l-2 hover:border-indigo-600']">
            Client Management
          </button>

        </nav>

        <div class="bg-blue-50 p-4 rounded-xl">
          <h4 class="font-bold text-blue-900 text-sm mb-2">Need External Access?</h4>
          <a href="https://ai.autogcm.com" target="_blank" class="text-xs text-blue-600 hover:underline flex items-center gap-1">
            Open Legacy AutoGCM Login <CornerDownRight class="w-3 h-3"/>
          </a>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
html {
  scroll-behavior: smooth;
}
</style>