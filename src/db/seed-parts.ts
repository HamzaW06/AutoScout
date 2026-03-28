import { getDb } from './database.js';

interface PartsPricingEntry {
  make: string;
  model: string;
  year_min: number;
  year_max: number;
  brake_pads_front: number;
  brake_pads_rear: number;
  brake_rotors_front_pair: number;
  brake_rotors_rear_pair: number;
  spark_plugs_set: number;
  oil_filter: number;
  air_filter: number;
  cabin_filter: number;
  alternator: number;
  starter_motor: number;
  water_pump: number;
  timing_belt_kit: number | null;
  ac_compressor: number;
  ac_condenser: number;
  radiator: number;
  battery: number;
  struts_front_pair: number;
  struts_rear_pair: number;
  wheel_bearing: number;
  catalytic_converter: number;
  oxygen_sensor: number;
  serpentine_belt: number;
  cv_axle: number;
  thermostat: number;
  parts_affordability_score: number;
}

const INSERT_SQL = `
  INSERT INTO parts_pricing (
    make, model, year_min, year_max,
    brake_pads_front, brake_pads_rear,
    brake_rotors_front_pair, brake_rotors_rear_pair,
    spark_plugs_set, oil_filter, air_filter, cabin_filter,
    alternator, starter_motor, water_pump, timing_belt_kit,
    ac_compressor, ac_condenser, radiator, battery,
    struts_front_pair, struts_rear_pair, wheel_bearing,
    catalytic_converter, oxygen_sensor,
    serpentine_belt, cv_axle, thermostat,
    parts_affordability_score
  ) VALUES (
    ?, ?, ?, ?,
    ?, ?,
    ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?,
    ?, ?,
    ?, ?, ?,
    ?
  )
`;

function toParams(e: PartsPricingEntry): unknown[] {
  return [
    e.make, e.model, e.year_min, e.year_max,
    e.brake_pads_front, e.brake_pads_rear,
    e.brake_rotors_front_pair, e.brake_rotors_rear_pair,
    e.spark_plugs_set, e.oil_filter, e.air_filter, e.cabin_filter,
    e.alternator, e.starter_motor, e.water_pump, e.timing_belt_kit,
    e.ac_compressor, e.ac_condenser, e.radiator, e.battery,
    e.struts_front_pair, e.struts_rear_pair, e.wheel_bearing,
    e.catalytic_converter, e.oxygen_sensor,
    e.serpentine_belt, e.cv_axle, e.thermostat,
    e.parts_affordability_score,
  ];
}

// ---------------------------------------------------------------------------
// Parts pricing data -- realistic aftermarket/RockAuto/eBay prices
// timing_belt_kit is null for chain-driven engines
// ---------------------------------------------------------------------------

const PARTS_DATA: PartsPricingEntry[] = [
  // =========================================================================
  // TOYOTA (6 entries)
  // =========================================================================
  {
    make: 'Toyota', model: 'Camry', year_min: 2007, year_max: 2017,
    brake_pads_front: 22, brake_pads_rear: 20,
    brake_rotors_front_pair: 42, brake_rotors_rear_pair: 40,
    spark_plugs_set: 18, oil_filter: 5, air_filter: 9, cabin_filter: 9,
    alternator: 95, starter_motor: 65, water_pump: 30, timing_belt_kit: null,
    ac_compressor: 135, ac_condenser: 55, radiator: 55, battery: 90,
    struts_front_pair: 70, struts_rear_pair: 65, wheel_bearing: 28,
    catalytic_converter: 95, oxygen_sensor: 28,
    serpentine_belt: 16, cv_axle: 38, thermostat: 12,
    parts_affordability_score: 90,
  },
  {
    make: 'Toyota', model: 'Corolla', year_min: 2009, year_max: 2019,
    brake_pads_front: 20, brake_pads_rear: 20,
    brake_rotors_front_pair: 40, brake_rotors_rear_pair: 38,
    spark_plugs_set: 16, oil_filter: 5, air_filter: 8, cabin_filter: 8,
    alternator: 90, starter_motor: 58, water_pump: 28, timing_belt_kit: null,
    ac_compressor: 125, ac_condenser: 52, radiator: 50, battery: 85,
    struts_front_pair: 65, struts_rear_pair: 60, wheel_bearing: 26,
    catalytic_converter: 90, oxygen_sensor: 26,
    serpentine_belt: 15, cv_axle: 36, thermostat: 11,
    parts_affordability_score: 92,
  },
  {
    make: 'Toyota', model: 'RAV4', year_min: 2006, year_max: 2018,
    brake_pads_front: 25, brake_pads_rear: 24,
    brake_rotors_front_pair: 48, brake_rotors_rear_pair: 45,
    spark_plugs_set: 20, oil_filter: 6, air_filter: 10, cabin_filter: 10,
    alternator: 105, starter_motor: 70, water_pump: 35, timing_belt_kit: null,
    ac_compressor: 145, ac_condenser: 60, radiator: 60, battery: 95,
    struts_front_pair: 78, struts_rear_pair: 72, wheel_bearing: 30,
    catalytic_converter: 105, oxygen_sensor: 30,
    serpentine_belt: 18, cv_axle: 42, thermostat: 14,
    parts_affordability_score: 85,
  },
  {
    make: 'Toyota', model: 'Highlander', year_min: 2008, year_max: 2018,
    brake_pads_front: 28, brake_pads_rear: 26,
    brake_rotors_front_pair: 55, brake_rotors_rear_pair: 50,
    spark_plugs_set: 25, oil_filter: 7, air_filter: 12, cabin_filter: 11,
    alternator: 120, starter_motor: 80, water_pump: 42, timing_belt_kit: null,
    ac_compressor: 165, ac_condenser: 70, radiator: 72, battery: 100,
    struts_front_pair: 90, struts_rear_pair: 82, wheel_bearing: 35,
    catalytic_converter: 140, oxygen_sensor: 35,
    serpentine_belt: 20, cv_axle: 48, thermostat: 16,
    parts_affordability_score: 78,
  },
  {
    make: 'Toyota', model: 'Prius', year_min: 2010, year_max: 2015,
    brake_pads_front: 25, brake_pads_rear: 24,
    brake_rotors_front_pair: 50, brake_rotors_rear_pair: 46,
    spark_plugs_set: 22, oil_filter: 6, air_filter: 10, cabin_filter: 10,
    alternator: 140, starter_motor: 90, water_pump: 45, timing_belt_kit: null,
    ac_compressor: 190, ac_condenser: 75, radiator: 70, battery: 110,
    struts_front_pair: 85, struts_rear_pair: 78, wheel_bearing: 35,
    catalytic_converter: 160, oxygen_sensor: 38,
    serpentine_belt: 18, cv_axle: 45, thermostat: 15,
    parts_affordability_score: 72,
  },
  {
    make: 'Toyota', model: 'Tacoma', year_min: 2005, year_max: 2020,
    brake_pads_front: 28, brake_pads_rear: 26,
    brake_rotors_front_pair: 55, brake_rotors_rear_pair: 50,
    spark_plugs_set: 24, oil_filter: 7, air_filter: 12, cabin_filter: 11,
    alternator: 115, starter_motor: 78, water_pump: 40, timing_belt_kit: null,
    ac_compressor: 160, ac_condenser: 68, radiator: 68, battery: 100,
    struts_front_pair: 95, struts_rear_pair: 85, wheel_bearing: 35,
    catalytic_converter: 135, oxygen_sensor: 34,
    serpentine_belt: 20, cv_axle: 50, thermostat: 16,
    parts_affordability_score: 78,
  },

  // =========================================================================
  // HONDA (5 entries)
  // =========================================================================
  {
    make: 'Honda', model: 'Civic', year_min: 2006, year_max: 2021,
    brake_pads_front: 22, brake_pads_rear: 20,
    brake_rotors_front_pair: 42, brake_rotors_rear_pair: 40,
    spark_plugs_set: 16, oil_filter: 5, air_filter: 9, cabin_filter: 9,
    alternator: 92, starter_motor: 60, water_pump: 28, timing_belt_kit: null,
    ac_compressor: 130, ac_condenser: 52, radiator: 52, battery: 88,
    struts_front_pair: 68, struts_rear_pair: 62, wheel_bearing: 27,
    catalytic_converter: 90, oxygen_sensor: 26,
    serpentine_belt: 16, cv_axle: 36, thermostat: 11,
    parts_affordability_score: 90,
  },
  {
    make: 'Honda', model: 'Accord', year_min: 2003, year_max: 2017,
    brake_pads_front: 24, brake_pads_rear: 22,
    brake_rotors_front_pair: 44, brake_rotors_rear_pair: 42,
    spark_plugs_set: 18, oil_filter: 5, air_filter: 9, cabin_filter: 9,
    alternator: 98, starter_motor: 65, water_pump: 30, timing_belt_kit: null,
    ac_compressor: 138, ac_condenser: 55, radiator: 55, battery: 90,
    struts_front_pair: 72, struts_rear_pair: 66, wheel_bearing: 28,
    catalytic_converter: 95, oxygen_sensor: 28,
    serpentine_belt: 17, cv_axle: 38, thermostat: 12,
    parts_affordability_score: 88,
  },
  {
    make: 'Honda', model: 'CR-V', year_min: 2007, year_max: 2022,
    brake_pads_front: 24, brake_pads_rear: 22,
    brake_rotors_front_pair: 46, brake_rotors_rear_pair: 44,
    spark_plugs_set: 20, oil_filter: 6, air_filter: 10, cabin_filter: 10,
    alternator: 100, starter_motor: 68, water_pump: 32, timing_belt_kit: null,
    ac_compressor: 145, ac_condenser: 58, radiator: 58, battery: 92,
    struts_front_pair: 75, struts_rear_pair: 70, wheel_bearing: 30,
    catalytic_converter: 100, oxygen_sensor: 30,
    serpentine_belt: 18, cv_axle: 40, thermostat: 13,
    parts_affordability_score: 85,
  },
  {
    make: 'Honda', model: 'Fit', year_min: 2009, year_max: 2020,
    brake_pads_front: 20, brake_pads_rear: 20,
    brake_rotors_front_pair: 40, brake_rotors_rear_pair: 38,
    spark_plugs_set: 14, oil_filter: 5, air_filter: 8, cabin_filter: 8,
    alternator: 88, starter_motor: 55, water_pump: 26, timing_belt_kit: null,
    ac_compressor: 125, ac_condenser: 50, radiator: 48, battery: 85,
    struts_front_pair: 62, struts_rear_pair: 58, wheel_bearing: 25,
    catalytic_converter: 85, oxygen_sensor: 25,
    serpentine_belt: 15, cv_axle: 35, thermostat: 10,
    parts_affordability_score: 88,
  },
  {
    make: 'Honda', model: 'Odyssey', year_min: 2005, year_max: 2017,
    brake_pads_front: 28, brake_pads_rear: 26,
    brake_rotors_front_pair: 52, brake_rotors_rear_pair: 48,
    spark_plugs_set: 24, oil_filter: 7, air_filter: 12, cabin_filter: 11,
    alternator: 125, starter_motor: 82, water_pump: 45, timing_belt_kit: 85,
    ac_compressor: 170, ac_condenser: 72, radiator: 70, battery: 100,
    struts_front_pair: 90, struts_rear_pair: 82, wheel_bearing: 36,
    catalytic_converter: 145, oxygen_sensor: 36,
    serpentine_belt: 20, cv_axle: 48, thermostat: 16,
    parts_affordability_score: 72,
  },

  // =========================================================================
  // HYUNDAI (2 entries)
  // =========================================================================
  {
    make: 'Hyundai', model: 'Elantra', year_min: 2011, year_max: 2020,
    brake_pads_front: 22, brake_pads_rear: 22,
    brake_rotors_front_pair: 42, brake_rotors_rear_pair: 40,
    spark_plugs_set: 16, oil_filter: 5, air_filter: 9, cabin_filter: 9,
    alternator: 95, starter_motor: 62, water_pump: 30, timing_belt_kit: null,
    ac_compressor: 135, ac_condenser: 55, radiator: 55, battery: 88,
    struts_front_pair: 70, struts_rear_pair: 65, wheel_bearing: 28,
    catalytic_converter: 100, oxygen_sensor: 28,
    serpentine_belt: 16, cv_axle: 38, thermostat: 12,
    parts_affordability_score: 85,
  },
  {
    make: 'Hyundai', model: 'Sonata', year_min: 2011, year_max: 2019,
    brake_pads_front: 24, brake_pads_rear: 22,
    brake_rotors_front_pair: 45, brake_rotors_rear_pair: 42,
    spark_plugs_set: 18, oil_filter: 6, air_filter: 10, cabin_filter: 10,
    alternator: 105, starter_motor: 68, water_pump: 35, timing_belt_kit: null,
    ac_compressor: 148, ac_condenser: 60, radiator: 60, battery: 92,
    struts_front_pair: 78, struts_rear_pair: 72, wheel_bearing: 30,
    catalytic_converter: 110, oxygen_sensor: 30,
    serpentine_belt: 18, cv_axle: 42, thermostat: 14,
    parts_affordability_score: 82,
  },

  // =========================================================================
  // KIA (2 entries)
  // =========================================================================
  {
    make: 'Kia', model: 'Soul', year_min: 2010, year_max: 2019,
    brake_pads_front: 22, brake_pads_rear: 20,
    brake_rotors_front_pair: 42, brake_rotors_rear_pair: 40,
    spark_plugs_set: 16, oil_filter: 5, air_filter: 9, cabin_filter: 9,
    alternator: 92, starter_motor: 60, water_pump: 28, timing_belt_kit: null,
    ac_compressor: 132, ac_condenser: 54, radiator: 52, battery: 88,
    struts_front_pair: 68, struts_rear_pair: 64, wheel_bearing: 27,
    catalytic_converter: 95, oxygen_sensor: 27,
    serpentine_belt: 16, cv_axle: 37, thermostat: 12,
    parts_affordability_score: 84,
  },
  {
    make: 'Kia', model: 'Optima', year_min: 2011, year_max: 2020,
    brake_pads_front: 24, brake_pads_rear: 22,
    brake_rotors_front_pair: 45, brake_rotors_rear_pair: 42,
    spark_plugs_set: 18, oil_filter: 6, air_filter: 10, cabin_filter: 10,
    alternator: 105, starter_motor: 68, water_pump: 34, timing_belt_kit: null,
    ac_compressor: 148, ac_condenser: 60, radiator: 58, battery: 92,
    struts_front_pair: 76, struts_rear_pair: 70, wheel_bearing: 30,
    catalytic_converter: 110, oxygen_sensor: 30,
    serpentine_belt: 18, cv_axle: 42, thermostat: 14,
    parts_affordability_score: 82,
  },

  // =========================================================================
  // NISSAN (3 entries)
  // =========================================================================
  {
    make: 'Nissan', model: 'Altima', year_min: 2007, year_max: 2018,
    brake_pads_front: 24, brake_pads_rear: 22,
    brake_rotors_front_pair: 46, brake_rotors_rear_pair: 44,
    spark_plugs_set: 20, oil_filter: 6, air_filter: 10, cabin_filter: 10,
    alternator: 105, starter_motor: 70, water_pump: 35, timing_belt_kit: null,
    ac_compressor: 148, ac_condenser: 60, radiator: 58, battery: 92,
    struts_front_pair: 78, struts_rear_pair: 72, wheel_bearing: 30,
    catalytic_converter: 115, oxygen_sensor: 30,
    serpentine_belt: 18, cv_axle: 42, thermostat: 14,
    parts_affordability_score: 82,
  },
  {
    make: 'Nissan', model: 'Sentra', year_min: 2007, year_max: 2019,
    brake_pads_front: 22, brake_pads_rear: 20,
    brake_rotors_front_pair: 42, brake_rotors_rear_pair: 40,
    spark_plugs_set: 16, oil_filter: 5, air_filter: 9, cabin_filter: 9,
    alternator: 95, starter_motor: 62, water_pump: 30, timing_belt_kit: null,
    ac_compressor: 135, ac_condenser: 55, radiator: 52, battery: 88,
    struts_front_pair: 70, struts_rear_pair: 65, wheel_bearing: 27,
    catalytic_converter: 100, oxygen_sensor: 27,
    serpentine_belt: 16, cv_axle: 38, thermostat: 12,
    parts_affordability_score: 84,
  },
  {
    make: 'Nissan', model: 'Rogue', year_min: 2008, year_max: 2020,
    brake_pads_front: 26, brake_pads_rear: 24,
    brake_rotors_front_pair: 50, brake_rotors_rear_pair: 46,
    spark_plugs_set: 22, oil_filter: 6, air_filter: 11, cabin_filter: 10,
    alternator: 115, starter_motor: 75, water_pump: 40, timing_belt_kit: null,
    ac_compressor: 158, ac_condenser: 65, radiator: 65, battery: 95,
    struts_front_pair: 85, struts_rear_pair: 78, wheel_bearing: 32,
    catalytic_converter: 125, oxygen_sensor: 32,
    serpentine_belt: 19, cv_axle: 45, thermostat: 15,
    parts_affordability_score: 78,
  },

  // =========================================================================
  // FORD (4 entries)
  // =========================================================================
  {
    make: 'Ford', model: 'F-150', year_min: 2004, year_max: 2020,
    brake_pads_front: 30, brake_pads_rear: 28,
    brake_rotors_front_pair: 60, brake_rotors_rear_pair: 55,
    spark_plugs_set: 30, oil_filter: 8, air_filter: 14, cabin_filter: 12,
    alternator: 130, starter_motor: 85, water_pump: 50, timing_belt_kit: null,
    ac_compressor: 180, ac_condenser: 80, radiator: 85, battery: 110,
    struts_front_pair: 110, struts_rear_pair: 95, wheel_bearing: 40,
    catalytic_converter: 165, oxygen_sensor: 38,
    serpentine_belt: 22, cv_axle: 55, thermostat: 18,
    parts_affordability_score: 75,
  },
  {
    make: 'Ford', model: 'Escape', year_min: 2008, year_max: 2019,
    brake_pads_front: 26, brake_pads_rear: 24,
    brake_rotors_front_pair: 50, brake_rotors_rear_pair: 46,
    spark_plugs_set: 22, oil_filter: 7, air_filter: 11, cabin_filter: 10,
    alternator: 115, starter_motor: 75, water_pump: 40, timing_belt_kit: null,
    ac_compressor: 160, ac_condenser: 68, radiator: 68, battery: 98,
    struts_front_pair: 88, struts_rear_pair: 80, wheel_bearing: 34,
    catalytic_converter: 130, oxygen_sensor: 34,
    serpentine_belt: 20, cv_axle: 48, thermostat: 15,
    parts_affordability_score: 76,
  },
  {
    make: 'Ford', model: 'Fusion', year_min: 2010, year_max: 2020,
    brake_pads_front: 24, brake_pads_rear: 22,
    brake_rotors_front_pair: 48, brake_rotors_rear_pair: 44,
    spark_plugs_set: 20, oil_filter: 6, air_filter: 10, cabin_filter: 10,
    alternator: 110, starter_motor: 72, water_pump: 38, timing_belt_kit: null,
    ac_compressor: 155, ac_condenser: 65, radiator: 62, battery: 95,
    struts_front_pair: 82, struts_rear_pair: 75, wheel_bearing: 32,
    catalytic_converter: 120, oxygen_sensor: 32,
    serpentine_belt: 18, cv_axle: 44, thermostat: 14,
    parts_affordability_score: 78,
  },
  {
    make: 'Ford', model: 'Focus', year_min: 2012, year_max: 2018,
    brake_pads_front: 22, brake_pads_rear: 22,
    brake_rotors_front_pair: 44, brake_rotors_rear_pair: 42,
    spark_plugs_set: 18, oil_filter: 6, air_filter: 10, cabin_filter: 9,
    alternator: 100, starter_motor: 65, water_pump: 32, timing_belt_kit: null,
    ac_compressor: 140, ac_condenser: 58, radiator: 56, battery: 90,
    struts_front_pair: 75, struts_rear_pair: 68, wheel_bearing: 30,
    catalytic_converter: 110, oxygen_sensor: 30,
    serpentine_belt: 17, cv_axle: 40, thermostat: 13,
    parts_affordability_score: 82,
  },

  // =========================================================================
  // CHEVROLET (4 entries)
  // =========================================================================
  {
    make: 'Chevrolet', model: 'Malibu', year_min: 2008, year_max: 2020,
    brake_pads_front: 25, brake_pads_rear: 24,
    brake_rotors_front_pair: 48, brake_rotors_rear_pair: 44,
    spark_plugs_set: 20, oil_filter: 6, air_filter: 10, cabin_filter: 10,
    alternator: 110, starter_motor: 72, water_pump: 38, timing_belt_kit: null,
    ac_compressor: 155, ac_condenser: 65, radiator: 62, battery: 95,
    struts_front_pair: 82, struts_rear_pair: 75, wheel_bearing: 32,
    catalytic_converter: 120, oxygen_sensor: 32,
    serpentine_belt: 18, cv_axle: 44, thermostat: 14,
    parts_affordability_score: 78,
  },
  {
    make: 'Chevrolet', model: 'Silverado', year_min: 2007, year_max: 2018,
    brake_pads_front: 30, brake_pads_rear: 28,
    brake_rotors_front_pair: 58, brake_rotors_rear_pair: 54,
    spark_plugs_set: 28, oil_filter: 8, air_filter: 14, cabin_filter: 12,
    alternator: 128, starter_motor: 85, water_pump: 48, timing_belt_kit: null,
    ac_compressor: 178, ac_condenser: 78, radiator: 82, battery: 108,
    struts_front_pair: 108, struts_rear_pair: 95, wheel_bearing: 38,
    catalytic_converter: 160, oxygen_sensor: 38,
    serpentine_belt: 22, cv_axle: 55, thermostat: 18,
    parts_affordability_score: 75,
  },
  {
    make: 'Chevrolet', model: 'Equinox', year_min: 2010, year_max: 2022,
    brake_pads_front: 26, brake_pads_rear: 24,
    brake_rotors_front_pair: 50, brake_rotors_rear_pair: 46,
    spark_plugs_set: 22, oil_filter: 7, air_filter: 11, cabin_filter: 10,
    alternator: 118, starter_motor: 78, water_pump: 42, timing_belt_kit: null,
    ac_compressor: 162, ac_condenser: 68, radiator: 68, battery: 98,
    struts_front_pair: 88, struts_rear_pair: 80, wheel_bearing: 34,
    catalytic_converter: 130, oxygen_sensor: 34,
    serpentine_belt: 20, cv_axle: 48, thermostat: 15,
    parts_affordability_score: 76,
  },
  {
    make: 'Chevrolet', model: 'Cruze', year_min: 2011, year_max: 2019,
    brake_pads_front: 26, brake_pads_rear: 24,
    brake_rotors_front_pair: 48, brake_rotors_rear_pair: 44,
    spark_plugs_set: 24, oil_filter: 7, air_filter: 11, cabin_filter: 10,
    alternator: 120, starter_motor: 80, water_pump: 42, timing_belt_kit: null,
    ac_compressor: 165, ac_condenser: 70, radiator: 65, battery: 98,
    struts_front_pair: 85, struts_rear_pair: 78, wheel_bearing: 34,
    catalytic_converter: 135, oxygen_sensor: 35,
    serpentine_belt: 20, cv_axle: 46, thermostat: 15,
    parts_affordability_score: 74,
  },

  // =========================================================================
  // SUBARU (2 entries) -- timing belt models
  // =========================================================================
  {
    make: 'Subaru', model: 'Outback', year_min: 2005, year_max: 2019,
    brake_pads_front: 30, brake_pads_rear: 28,
    brake_rotors_front_pair: 55, brake_rotors_rear_pair: 50,
    spark_plugs_set: 28, oil_filter: 7, air_filter: 12, cabin_filter: 11,
    alternator: 135, starter_motor: 90, water_pump: 50, timing_belt_kit: 95,
    ac_compressor: 180, ac_condenser: 78, radiator: 78, battery: 105,
    struts_front_pair: 100, struts_rear_pair: 90, wheel_bearing: 40,
    catalytic_converter: 170, oxygen_sensor: 40,
    serpentine_belt: 22, cv_axle: 52, thermostat: 18,
    parts_affordability_score: 68,
  },
  {
    make: 'Subaru', model: 'Forester', year_min: 2003, year_max: 2018,
    brake_pads_front: 28, brake_pads_rear: 26,
    brake_rotors_front_pair: 52, brake_rotors_rear_pair: 48,
    spark_plugs_set: 26, oil_filter: 7, air_filter: 12, cabin_filter: 11,
    alternator: 130, starter_motor: 85, water_pump: 48, timing_belt_kit: 90,
    ac_compressor: 175, ac_condenser: 75, radiator: 75, battery: 102,
    struts_front_pair: 95, struts_rear_pair: 88, wheel_bearing: 38,
    catalytic_converter: 162, oxygen_sensor: 38,
    serpentine_belt: 21, cv_axle: 50, thermostat: 17,
    parts_affordability_score: 70,
  },

  // =========================================================================
  // MAZDA (1 entry)
  // =========================================================================
  {
    make: 'Mazda', model: 'Mazda3', year_min: 2004, year_max: 2018,
    brake_pads_front: 24, brake_pads_rear: 22,
    brake_rotors_front_pair: 44, brake_rotors_rear_pair: 42,
    spark_plugs_set: 18, oil_filter: 6, air_filter: 10, cabin_filter: 9,
    alternator: 100, starter_motor: 68, water_pump: 34, timing_belt_kit: null,
    ac_compressor: 145, ac_condenser: 58, radiator: 58, battery: 90,
    struts_front_pair: 78, struts_rear_pair: 70, wheel_bearing: 30,
    catalytic_converter: 110, oxygen_sensor: 30,
    serpentine_belt: 18, cv_axle: 42, thermostat: 13,
    parts_affordability_score: 80,
  },

  // =========================================================================
  // VOLKSWAGEN (1 entry) -- German, higher prices
  // =========================================================================
  {
    make: 'Volkswagen', model: 'Jetta', year_min: 2006, year_max: 2018,
    brake_pads_front: 35, brake_pads_rear: 32,
    brake_rotors_front_pair: 65, brake_rotors_rear_pair: 60,
    spark_plugs_set: 32, oil_filter: 9, air_filter: 15, cabin_filter: 13,
    alternator: 168, starter_motor: 120, water_pump: 65, timing_belt_kit: 100,
    ac_compressor: 230, ac_condenser: 95, radiator: 105, battery: 120,
    struts_front_pair: 135, struts_rear_pair: 120, wheel_bearing: 48,
    catalytic_converter: 225, oxygen_sensor: 50,
    serpentine_belt: 28, cv_axle: 65, thermostat: 24,
    parts_affordability_score: 58,
  },

  // =========================================================================
  // LEXUS (1 entry)
  // =========================================================================
  {
    make: 'Lexus', model: 'ES350', year_min: 2007, year_max: 2018,
    brake_pads_front: 30, brake_pads_rear: 28,
    brake_rotors_front_pair: 58, brake_rotors_rear_pair: 54,
    spark_plugs_set: 28, oil_filter: 8, air_filter: 14, cabin_filter: 12,
    alternator: 145, starter_motor: 95, water_pump: 48, timing_belt_kit: null,
    ac_compressor: 185, ac_condenser: 80, radiator: 82, battery: 110,
    struts_front_pair: 105, struts_rear_pair: 95, wheel_bearing: 40,
    catalytic_converter: 175, oxygen_sensor: 42,
    serpentine_belt: 22, cv_axle: 52, thermostat: 18,
    parts_affordability_score: 70,
  },

  // =========================================================================
  // DODGE (1 entry) -- timing belt model
  // =========================================================================
  {
    make: 'Dodge', model: 'Grand Caravan', year_min: 2008, year_max: 2020,
    brake_pads_front: 24, brake_pads_rear: 22,
    brake_rotors_front_pair: 46, brake_rotors_rear_pair: 44,
    spark_plugs_set: 20, oil_filter: 6, air_filter: 10, cabin_filter: 10,
    alternator: 108, starter_motor: 70, water_pump: 38, timing_belt_kit: 78,
    ac_compressor: 155, ac_condenser: 65, radiator: 62, battery: 95,
    struts_front_pair: 82, struts_rear_pair: 75, wheel_bearing: 32,
    catalytic_converter: 115, oxygen_sensor: 30,
    serpentine_belt: 18, cv_axle: 44, thermostat: 14,
    parts_affordability_score: 78,
  },
];

/**
 * Seed the parts_pricing table with aftermarket price data for 30+ common
 * used car models. Skips seeding if the table already contains data.
 */
export function seedPartsPricing(): void {
  const db = getDb();

  const row = db.get<{ count: number }>('SELECT COUNT(*) as count FROM parts_pricing');
  if (row && row.count > 0) {
    console.log(`[seed-parts] parts_pricing already has ${row.count} rows, skipping.`);
    return;
  }

  db.transaction(() => {
    for (const entry of PARTS_DATA) {
      db.run(INSERT_SQL, toParams(entry));
    }
  });

  console.log(`[seed-parts] Seeded ${PARTS_DATA.length} parts_pricing entries.`);
}
