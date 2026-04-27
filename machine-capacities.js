/**
 * Machine Capacity Configuration
 * 
 * Set individual capacity (in kg) for each UCO machine
 * Capacity should be based on:
 * 1. Machine location (urban/suburban/rural)
 * 2. Historical collection patterns
 * 3. Expected growth
 * 4. Maintenance schedule
 * 
 * Alert thresholds (percentage based):
 * - Warning: 70% full
 * - Critical: 85% full
 * - Emergency: 95% full
 */

module.exports = {
  // Machine capacities in kilograms (kg)
  capacities: {
    // Format: 'machineNo': capacityInKg
    
    // High traffic urban locations (shopping malls, apartments)
    '071582000001': 800,   // Meranti Apartment, Subang Jaya
    '071582000007': 1000,  // Meranti Apartment (high traffic) - CURRENT: 138.92kg (13.9% full)
    '071582000008': 900,   // Bandar Sunway, Petaling Jaya
    
    // Medium traffic locations
    '071582000004': 700,   // Puchong Prima
    '071582000005': 800,   // Subang Jaya SS15
    '071582000009': 700,   // Klang
    '071582000010': 800,   // Shah Alam
    
    // Lower traffic locations
    '071582000002': 600,   // Taman Wawasan Recreational Park, Puchong
    '071582000006': 600,   // Putra Heights, Subang Jaya
    
    // Rural/special locations
    '071582000003': 500,   // Dataran Banting
  },
  
  // Default capacity for new/unconfigured machines
  defaultCapacity: 600,
  
  // Alert thresholds (percentage)
  alertThresholds: {
    warning: 70,    // Yellow - Schedule collection soon
    critical: 85,   // Orange - Urgent collection needed
    emergency: 95   // Red - Immediate collection required
  },
  
  // Helper functions
  getCapacity: function(machineNo) {
    return this.capacities[machineNo] || this.defaultCapacity;
  },
  
  getAlertLevel: function(machineNo, currentWeight) {
    const capacity = this.getCapacity(machineNo);
    const percentage = (currentWeight / capacity) * 100;
    
    if (percentage >= this.alertThresholds.emergency) return 'EMERGENCY';
    if (percentage >= this.alertThresholds.critical) return 'CRITICAL';
    if (percentage >= this.alertThresholds.warning) return 'WARNING';
    return 'NORMAL';
  },
  
  getPercentageFull: function(machineNo, currentWeight) {
    const capacity = this.getCapacity(machineNo);
    return Math.round((currentWeight / capacity) * 100);
  },
  
  getRemainingCapacity: function(machineNo, currentWeight) {
    const capacity = this.getCapacity(machineNo);
    return capacity - currentWeight;
  },
  
  // Estimate days until full based on daily average collection
  estimateDaysUntilFull: function(machineNo, currentWeight, dailyAvgCollection) {
    if (!dailyAvgCollection || dailyAvgCollection <= 0) return null;
    
    const remaining = this.getRemainingCapacity(machineNo, currentWeight);
    return Math.floor(remaining / dailyAvgCollection);
  },
  
  // Update capacity for a machine
  updateCapacity: function(machineNo, newCapacity) {
    if (newCapacity < 100) {
      throw new Error('Capacity must be at least 100kg');
    }
    this.capacities[machineNo] = newCapacity;
    return true;
  },
  
  // Add new machine
  addMachine: function(machineNo, capacity = null) {
    if (this.capacities[machineNo]) {
      throw new Error(`Machine ${machineNo} already exists`);
    }
    this.capacities[machineNo] = capacity || this.defaultCapacity;
    return true;
  },
  
  // Get all machines with capacities
  getAllMachines: function() {
    return Object.keys(this.capacities).map(machineNo => ({
      machineNo,
      capacity: this.capacities[machineNo],
      location: this.getLocationDescription(machineNo)
    }));
  },
  
  // Location descriptions (for reference)
  getLocationDescription: function(machineNo) {
    const locations = {
      '071582000001': 'Meranti Apartment, Subang Jaya',
      '071582000002': 'Taman Wawasan Recreational Park, Puchong',
      '071582000003': 'Dataran Banting, Banting',
      '071582000004': 'Puchong Prima, Puchong',
      '071582000005': 'Subang Jaya SS15',
      '071582000006': 'Putra Heights, Subang Jaya',
      '071582000007': 'Meranti Apartment, Subang Jaya',
      '071582000008': 'Bandar Sunway, Petaling Jaya',
      '071582000009': 'Klang',
      '071582000010': 'Shah Alam'
    };
    return locations[machineNo] || 'Location not specified';
  },
  
  // Generate capacity report
  generateReport: function(currentWeights = {}) {
    const report = {
      timestamp: new Date().toISOString(),
      totalMachines: Object.keys(this.capacities).length,
      totalCapacity: Object.values(this.capacities).reduce((a, b) => a + b, 0),
      machines: []
    };
    
    Object.keys(this.capacities).forEach(machineNo => {
      const currentWeight = currentWeights[machineNo] || 0;
      const capacity = this.capacities[machineNo];
      const percentage = this.getPercentageFull(machineNo, currentWeight);
      const alertLevel = this.getAlertLevel(machineNo, currentWeight);
      const remaining = this.getRemainingCapacity(machineNo, currentWeight);
      
      report.machines.push({
        machineNo,
        capacity,
        currentWeight,
        percentage,
        alertLevel,
        remaining,
        location: this.getLocationDescription(machineNo),
        needsAttention: alertLevel !== 'NORMAL'
      });
    });
    
    // Sort by alert level (emergency first)
    report.machines.sort((a, b) => {
      const alertOrder = { EMERGENCY: 0, CRITICAL: 1, WARNING: 2, NORMAL: 3 };
      return alertOrder[a.alertLevel] - alertOrder[b.alertLevel];
    });
    
    return report;
  }
};