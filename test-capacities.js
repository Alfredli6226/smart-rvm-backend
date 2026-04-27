const capacities = require('./machine-capacities.js');

console.log('🤖 SMART RVM MACHINE CAPACITY SYSTEM');
console.log('=' .repeat(50));

// Test current machine status
const currentWeights = {
  '071582000001': 45.2,
  '071582000002': 32.8,
  '071582000003': 28.5,
  '071582000004': 67.3,
  '071582000005': 89.1,
  '071582000006': 42.7,
  '071582000007': 138.92,  // The machine we were worried about
  '071582000008': 156.4,
  '071582000009': 58.9,
  '071582000010': 72.6
};

// Generate report
const report = capacities.generateReport(currentWeights);

console.log(`📊 CAPACITY REPORT`);
console.log(`Total Machines: ${report.totalMachines}`);
console.log(`Total Capacity: ${report.totalCapacity}kg`);
console.log(`Report Time: ${new Date(report.timestamp).toLocaleString()}`);
console.log('');

console.log('🚨 ALERT STATUS');
console.log('-' .repeat(80));

report.machines.forEach(machine => {
  const alertIcon = machine.alertLevel === 'EMERGENCY' ? '🔴' :
                    machine.alertLevel === 'CRITICAL' ? '🟠' :
                    machine.alertLevel === 'WARNING' ? '🟡' : '✅';
  
  console.log(`${alertIcon} ${machine.machineNo} - ${machine.location}`);
  console.log(`   Capacity: ${machine.capacity}kg | Current: ${machine.currentWeight}kg | ${machine.percentage}% full`);
  console.log(`   Remaining: ${machine.remaining}kg | Status: ${machine.alertLevel}`);
  
  if (machine.needsAttention) {
    console.log(`   ⚠️  Attention needed: ${machine.alertLevel} alert`);
  }
  console.log('');
});

// Special check for machine 071582000007
console.log('🎯 MACHINE 071582000007 DETAILED ANALYSIS');
console.log('-' .repeat(50));
const machine007 = report.machines.find(m => m.machineNo === '071582000007');
if (machine007) {
  console.log(`Location: ${machine007.location}`);
  console.log(`Capacity: ${machine007.capacity}kg (configured)`);
  console.log(`Current UCO: ${machine007.currentWeight}kg`);
  console.log(`Percentage: ${machine007.percentage}% full`);
  console.log(`Remaining: ${machine007.remaining}kg available`);
  console.log(`Alert Level: ${machine007.alertLevel}`);
  
  if (machine007.alertLevel === 'NORMAL') {
    console.log('✅ STATUS: SAFE - Well within capacity limits');
    console.log(`📈 This machine can collect ${Math.round(machine007.remaining / 10)} more days at 10kg/day`);
  }
}

console.log('');
console.log('⚙️  SYSTEM FUNCTIONS TEST');
console.log('-' .repeat(50));

// Test helper functions
console.log('1. Get capacity for machine 071582000007:');
console.log(`   ${capacities.getCapacity('071582000007')}kg`);

console.log('\n2. Get alert level for machine 071582000007:');
console.log(`   ${capacities.getAlertLevel('071582000007', 138.92)}`);

console.log('\n3. Get percentage full:');
console.log(`   ${capacities.getPercentageFull('071582000007', 138.92)}%`);

console.log('\n4. Get remaining capacity:');
console.log(`   ${capacities.getRemainingCapacity('071582000007', 138.92)}kg remaining`);

console.log('\n5. Estimate days until full (assuming 10kg/day collection):');
const days = capacities.estimateDaysUntilFull('071582000007', 138.92, 10);
console.log(`   ${days} days until full`);

console.log('\n6. All machines list:');
capacities.getAllMachines().forEach((machine, index) => {
  console.log(`   ${index + 1}. ${machine.machineNo}: ${machine.capacity}kg - ${machine.location}`);
});

console.log('');
console.log('💡 RECOMMENDATIONS:');
console.log('-' .repeat(50));

// Generate recommendations
report.machines.filter(m => m.needsAttention).forEach(machine => {
  console.log(`For ${machine.machineNo} (${machine.location}):`);
  console.log(`   • Currently ${machine.percentage}% full (${machine.alertLevel} alert)`);
  console.log(`   • Schedule collection within ${Math.max(1, Math.floor(machine.remaining / 20))} days`);
});

const safeMachines = report.machines.filter(m => !m.needsAttention);
if (safeMachines.length > 0) {
  console.log(`\n✅ ${safeMachines.length} machines are operating normally:`);
  safeMachines.forEach(machine => {
    console.log(`   • ${machine.machineNo}: ${machine.percentage}% full`);
  });
}

console.log('');
console.log('🎯 NEXT STEPS:');
console.log('1. Integrate this capacity system into the RVM platform');
console.log('2. Update notifications to use machine-specific capacities');
console.log('3. Create capacity management dashboard');
console.log('4. Set up automated capacity adjustment based on usage patterns');