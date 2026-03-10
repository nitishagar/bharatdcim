package normalize

import "fmt"

// VendorNormalizer converts raw SNMP counter values into standard SI units.
type VendorNormalizer interface {
	NormalizePower(rawValue int64) float64       // Returns kW
	NormalizeEnergy(rawValue int64) float64      // Returns kWh
	NormalizeCurrent(rawValue int64) float64     // Returns Amps
	NormalizeVoltage(rawValue int64) float64     // Returns Volts
	NormalizePowerFactor(rawValue int64) float64 // Returns 0.0–1.0
}

// GetNormalizer returns the appropriate normalizer for a vendor string.
func GetNormalizer(vendor string) (VendorNormalizer, error) {
	switch vendor {
	case "apc":
		return &APCNormalizer{}, nil
	case "raritan":
		return &RaritanNormalizer{}, nil
	case "servertech":
		return &ServerTechNormalizer{}, nil
	default:
		return nil, fmt.Errorf("unsupported vendor: %s", vendor)
	}
}
