package normalize

import (
	"math"
	"testing"
)

const tolerance = 1e-9

func floatEq(a, b float64) bool {
	return math.Abs(a-b) < tolerance
}

// SNMP-010: APC power — raw 153 (tenths kW) → 15.3 kW
func TestSNMP010_APCPower(t *testing.T) {
	n, err := GetNormalizer("apc")
	if err != nil {
		t.Fatal(err)
	}
	got := n.NormalizePower(153)
	if !floatEq(got, 15.3) {
		t.Errorf("expected 15.3 kW, got %f", got)
	}
}

// SNMP-011: APC energy — raw 5000 (kWh) → 5000.0 kWh
func TestSNMP011_APCEnergy(t *testing.T) {
	n, err := GetNormalizer("apc")
	if err != nil {
		t.Fatal(err)
	}
	got := n.NormalizeEnergy(5000)
	if !floatEq(got, 5000.0) {
		t.Errorf("expected 5000.0 kWh, got %f", got)
	}
}

// SNMP-012: Raritan power — raw 15300 (W) → 15.3 kW
func TestSNMP012_RaritanPower(t *testing.T) {
	n, err := GetNormalizer("raritan")
	if err != nil {
		t.Fatal(err)
	}
	got := n.NormalizePower(15300)
	if !floatEq(got, 15.3) {
		t.Errorf("expected 15.3 kW, got %f", got)
	}
}

// SNMP-013: Raritan energy — raw 5000000 (Wh) → 5000.0 kWh
func TestSNMP013_RaritanEnergy(t *testing.T) {
	n, err := GetNormalizer("raritan")
	if err != nil {
		t.Fatal(err)
	}
	got := n.NormalizeEnergy(5000000)
	if !floatEq(got, 5000.0) {
		t.Errorf("expected 5000.0 kWh, got %f", got)
	}
}

// SNMP-014: ServerTech current — raw 3485 (hundredths A) → 34.85 A
func TestSNMP014_ServerTechCurrent(t *testing.T) {
	n, err := GetNormalizer("servertech")
	if err != nil {
		t.Fatal(err)
	}
	got := n.NormalizeCurrent(3485)
	if !floatEq(got, 34.85) {
		t.Errorf("expected 34.85 A, got %f", got)
	}
}

func TestUnsupportedVendor(t *testing.T) {
	_, err := GetNormalizer("unknown")
	if err == nil {
		t.Error("expected error for unsupported vendor")
	}
}
