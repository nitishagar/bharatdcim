import { describe, it, expect } from 'vitest';
import { detectDCIMFormat } from '../../src/csv/detect-format.js';

describe('Format Detection', () => {
  // CSV-020: BharatDCIM native format
  it('CSV-020: timestamp,meter_id,kwh → bharatdcim', () => {
    expect(detectDCIMFormat(['timestamp', 'meter_id', 'kwh'])).toBe('bharatdcim');
  });

  // CSV-021: Nlyte format
  it('CSV-021: Device Name,Reading Date,Energy (kWh) → nlyte', () => {
    expect(detectDCIMFormat(['Device Name', 'Reading Date', 'Energy (kWh)'])).toBe('nlyte');
  });

  // CSV-022: Sunbird format
  it('CSV-022: AssetName,Timestamp,RealEnergy → sunbird', () => {
    expect(detectDCIMFormat(['AssetName', 'Timestamp', 'RealEnergy'])).toBe('sunbird');
  });

  // CSV-023: EcoStruxure format
  it('CSV-023: Equipment_ID,Date_Time,Active_Energy_Wh → ecostruxure', () => {
    expect(detectDCIMFormat(['Equipment_ID', 'Date_Time', 'Active_Energy_Wh'])).toBe('ecostruxure');
  });

  // CSV-024: Unknown format
  it('CSV-024: unrecognized headers → unknown', () => {
    expect(detectDCIMFormat(['col_a', 'col_b', 'col_c'])).toBe('unknown');
  });
});
