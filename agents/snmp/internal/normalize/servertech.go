package normalize

// ServerTech Sentry MIB normalization.
//
// OID reference (Enterprise: .1.3.6.1.4.1.1718):
//   Input Feed Load → .1.3.6.1.4.1.1718.3.2.2.1.7  (hundredths of Amps)
//   Outlet Power    → .1.3.6.1.4.1.1718.3.2.3.1.41 (Watts)

// ServerTechNormalizer handles ServerTech Sentry PDU raw SNMP values.
type ServerTechNormalizer struct{}

// NormalizePower converts ServerTech raw power (Watts) to kW.
func (s *ServerTechNormalizer) NormalizePower(rawValue int64) float64 {
	return float64(rawValue) / 1000.0
}

// NormalizeEnergy returns ServerTech energy directly (already in kWh).
func (s *ServerTechNormalizer) NormalizeEnergy(rawValue int64) float64 {
	return float64(rawValue)
}

// NormalizeCurrent converts ServerTech raw current (hundredths of A) to Amps.
func (s *ServerTechNormalizer) NormalizeCurrent(rawValue int64) float64 {
	return float64(rawValue) / 100.0
}

// NormalizeVoltage returns ServerTech voltage directly (already in Volts).
func (s *ServerTechNormalizer) NormalizeVoltage(rawValue int64) float64 {
	return float64(rawValue)
}
