package normalize

// APC PowerNet MIB normalization.
//
// OID reference (Enterprise: .1.3.6.1.4.1.318):
//   Total Power  → .1.3.6.1.4.1.318.1.1.26.4.3.1.5.1  (tenths of kW)
//   Total Energy → .1.3.6.1.4.1.318.1.1.26.4.3.1.7.1  (kWh, direct)
//   Phase Current → .1.3.6.1.4.1.318.1.1.26.6.3.1.6    (tenths of A)
//   Power Factor → .1.3.6.1.4.1.318.1.1.26.6.3.1.9     (hundredths)

// APCNormalizer handles APC PDU raw SNMP values.
type APCNormalizer struct{}

// NormalizePower converts APC raw power (tenths of kW) to kW.
func (a *APCNormalizer) NormalizePower(rawValue int64) float64 {
	return float64(rawValue) / 10.0
}

// NormalizeEnergy returns APC energy directly (already in kWh).
func (a *APCNormalizer) NormalizeEnergy(rawValue int64) float64 {
	return float64(rawValue)
}

// NormalizeCurrent converts APC raw current (tenths of A) to Amps.
func (a *APCNormalizer) NormalizeCurrent(rawValue int64) float64 {
	return float64(rawValue) / 10.0
}

// NormalizeVoltage returns APC voltage directly (already in Volts).
func (a *APCNormalizer) NormalizeVoltage(rawValue int64) float64 {
	return float64(rawValue)
}

// NormalizePowerFactor converts APC raw power factor (hundredths) to 0.0–1.0.
func (a *APCNormalizer) NormalizePowerFactor(rawValue int64) float64 {
	return float64(rawValue) / 100.0
}
