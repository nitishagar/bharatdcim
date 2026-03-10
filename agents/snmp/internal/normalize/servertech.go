package normalize

// ServerTech Sentry3 MIB normalization.
//
// OID reference (Enterprise: .1.3.6.1.4.1.1718):
//   Infeed Active Power  → .1.3.6.1.4.1.1718.3.2.2.1.12 (Watts, infeedActivePower)
//   Infeed Energy        → .1.3.6.1.4.1.1718.3.2.2.1.16 (tenth kWh, infeedEnergy)
//   Infeed Current       → .1.3.6.1.4.1.1718.3.2.2.1.7  (hundredths of Amps)
//   Power Factor         → .1.3.6.1.4.1.1718.3.2.2.1.14 (hundredths, e.g. 95 = 0.95)

// ServerTechNormalizer handles ServerTech Sentry PDU raw SNMP values.
type ServerTechNormalizer struct{}

// NormalizePower converts ServerTech raw power (Watts) to kW.
func (s *ServerTechNormalizer) NormalizePower(rawValue int64) float64 {
	return float64(rawValue) / 1000.0
}

// NormalizeEnergy converts ServerTech raw energy (tenth kWh) to kWh.
func (s *ServerTechNormalizer) NormalizeEnergy(rawValue int64) float64 {
	return float64(rawValue) / 10.0
}

// NormalizeCurrent converts ServerTech raw current (hundredths of A) to Amps.
func (s *ServerTechNormalizer) NormalizeCurrent(rawValue int64) float64 {
	return float64(rawValue) / 100.0
}

// NormalizeVoltage returns ServerTech voltage directly (already in Volts).
func (s *ServerTechNormalizer) NormalizeVoltage(rawValue int64) float64 {
	return float64(rawValue)
}
