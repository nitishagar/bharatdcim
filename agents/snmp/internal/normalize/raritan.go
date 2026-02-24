package normalize

// Raritan PDU-MIB normalization.
//
// OID reference (Enterprise: .1.3.6.1.4.1.13742):
//   Inlet Power   → .1.3.6.1.4.1.13742.6.5.2.3.1.4  (Watts)
//   Inlet Energy  → .1.3.6.1.4.1.13742.6.5.2.3.1.4  (Wh)
//   Inlet Current → .1.3.6.1.4.1.13742.6.5.2.3.1.4  (mA)

// RaritanNormalizer handles Raritan PDU raw SNMP values.
type RaritanNormalizer struct{}

// NormalizePower converts Raritan raw power (Watts) to kW.
func (r *RaritanNormalizer) NormalizePower(rawValue int64) float64 {
	return float64(rawValue) / 1000.0
}

// NormalizeEnergy converts Raritan raw energy (Wh) to kWh.
func (r *RaritanNormalizer) NormalizeEnergy(rawValue int64) float64 {
	return float64(rawValue) / 1000.0
}

// NormalizeCurrent converts Raritan raw current (mA) to Amps.
func (r *RaritanNormalizer) NormalizeCurrent(rawValue int64) float64 {
	return float64(rawValue) / 1000.0
}

// NormalizeVoltage returns Raritan voltage directly (already in Volts).
func (r *RaritanNormalizer) NormalizeVoltage(rawValue int64) float64 {
	return float64(rawValue)
}
