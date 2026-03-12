// src/utils/esgFormulas.ts

export const IMPACT_FACTORS = {
  // kg CO2 saved per kg of material recycled
  CO2_SAVED_PER_KG_PLASTIC: 1.5, 
  CO2_SAVED_PER_KG_ALUMINUM: 9.0, 
  CO2_SAVED_PER_KG_PAPER: 1.0, 
  CO2_SAVED_PER_KG_UCO: 2.5, // Used Cooking Oil -> Biodiesel is high impact
  
  // kWh energy saved per kg
  ENERGY_SAVED_PER_KG_PLASTIC: 5.8,
  ENERGY_SAVED_PER_KG_ALUMINUM: 14.0,
  ENERGY_SAVED_PER_KG_PAPER: 4.0,
  ENERGY_SAVED_PER_KG_UCO: 0.0, // UCO is energy-neutral/positive as fuel, but we track CO2 mainly

  // Trees planted equivalent (approx 20kg CO2 absorbed per year)
  CO2_PER_TREE_YEAR: 20
};

export const calculateImpact = (weight: number) => {
  // ESTIMATION LOGIC:
  // Since we currently receive a total 'weight', we will estimate a mix.
  // If you have real data later, you can pass specific weights.
  // Current assumption: 
  // 60% Plastic, 20% Aluminum, 10% Paper, 10% UCO (Simulated Diversified Mix)
  
  const plasticWeight = weight * 0.60;
  const aluminumWeight = weight * 0.20;
  const paperWeight = weight * 0.10;
  const ucoWeight = weight * 0.10;

  const co2Plastic = plasticWeight * IMPACT_FACTORS.CO2_SAVED_PER_KG_PLASTIC;
  const co2Aluminum = aluminumWeight * IMPACT_FACTORS.CO2_SAVED_PER_KG_ALUMINUM;
  const co2Paper = paperWeight * IMPACT_FACTORS.CO2_SAVED_PER_KG_PAPER;
  const co2Uco = ucoWeight * IMPACT_FACTORS.CO2_SAVED_PER_KG_UCO;

  const totalCo2 = co2Plastic + co2Aluminum + co2Paper + co2Uco;

  const energyPlastic = plasticWeight * IMPACT_FACTORS.ENERGY_SAVED_PER_KG_PLASTIC;
  const energyAluminum = aluminumWeight * IMPACT_FACTORS.ENERGY_SAVED_PER_KG_ALUMINUM;
  const energyPaper = paperWeight * IMPACT_FACTORS.ENERGY_SAVED_PER_KG_PAPER;
  const energyUco = ucoWeight * IMPACT_FACTORS.ENERGY_SAVED_PER_KG_UCO;

  const totalEnergy = energyPlastic + energyAluminum + energyPaper + energyUco;

  const treesEquivalent = totalCo2 / IMPACT_FACTORS.CO2_PER_TREE_YEAR;

  return {
    breakdown: {
      plastic: { weight: plasticWeight, co2: co2Plastic, energy: energyPlastic },
      aluminum: { weight: aluminumWeight, co2: co2Aluminum, energy: energyAluminum },
      paper: { weight: paperWeight, co2: co2Paper, energy: energyPaper },
      uco: { weight: ucoWeight, co2: co2Uco, energy: energyUco }
    },
    totalCo2, 
    totalEnergy, 
    treesEquivalent 
  };
};