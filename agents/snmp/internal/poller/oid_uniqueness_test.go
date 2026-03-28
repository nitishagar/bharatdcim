package poller

// BUG-SNMP-01/02 validation: Confirms all vendor OIDs are distinct (no duplicates)
// and that PF is actively polled for all vendors.

import (
	"fmt"
	"testing"

	"github.com/nitishagar/bharatdcim/agents/snmp/internal/normalize"
)

// SNMP-OID-01: Each vendor defines exactly 3 distinct OIDs (Power, Energy, PowerFactor).
func TestSNMPOID01_AllVendorOIDsAreDistinct(t *testing.T) {
	for vendor, oids := range vendorOIDs {
		if oids.Power == oids.Energy {
			t.Errorf("vendor %s: Power OID == Energy OID (%s)", vendor, oids.Power)
		}
		if oids.Power == oids.PowerFactor {
			t.Errorf("vendor %s: Power OID == PowerFactor OID (%s)", vendor, oids.Power)
		}
		if oids.Energy == oids.PowerFactor {
			t.Errorf("vendor %s: Energy OID == PowerFactor OID (%s)", vendor, oids.Energy)
		}
	}
}

// SNMP-OID-02: All OIDs are non-empty strings.
func TestSNMPOID02_AllOIDsNonEmpty(t *testing.T) {
	for vendor, oids := range vendorOIDs {
		if oids.Power == "" {
			t.Errorf("vendor %s: Power OID is empty", vendor)
		}
		if oids.Energy == "" {
			t.Errorf("vendor %s: Energy OID is empty", vendor)
		}
		if oids.PowerFactor == "" {
			t.Errorf("vendor %s: PowerFactor OID is empty", vendor)
		}
	}
}

// SNMP-OID-03: Raritan Power and Energy OIDs are different (distinct MIB subtrees).
func TestSNMPOID03_RaritanPowerAndEnergyOIDsDistinct(t *testing.T) {
	raritan, ok := vendorOIDs["raritan"]
	if !ok {
		t.Fatal("raritan not in vendorOIDs")
	}
	if raritan.Power == raritan.Energy {
		t.Errorf("raritan Power OID == Energy OID: %s", raritan.Power)
	}
}

// SNMP-OID-04: ServerTech Power and Energy OIDs are different (distinct MIB subtrees).
func TestSNMPOID04_ServerTechPowerAndEnergyOIDsDistinct(t *testing.T) {
	st, ok := vendorOIDs["servertech"]
	if !ok {
		t.Fatal("servertech not in vendorOIDs")
	}
	if st.Power == st.Energy {
		t.Errorf("servertech Power OID == Energy OID: %s", st.Power)
	}
}

// SNMP-OID-05: All 3 vendors are present in vendorOIDs.
func TestSNMPOID05_AllThreeVendorsPresent(t *testing.T) {
	required := []string{"apc", "raritan", "servertech"}
	for _, v := range required {
		if _, ok := vendorOIDs[v]; !ok {
			t.Errorf("vendor %s missing from vendorOIDs", v)
		}
	}
}

// SNMP-OID-06: All vendor OIDs are globally unique across all vendors.
func TestSNMPOID06_CrossVendorOIDsUnique(t *testing.T) {
	seen := make(map[string]string) // oid -> "vendor.field"
	for vendor, oids := range vendorOIDs {
		for field, oid := range map[string]string{
			"Power": oids.Power, "Energy": oids.Energy, "PowerFactor": oids.PowerFactor,
		} {
			key := fmt.Sprintf("%s.%s", vendor, field)
			if prev, exists := seen[oid]; exists {
				t.Errorf("OID collision: %s and %s share OID %s", key, prev, oid)
			}
			seen[oid] = key
		}
	}
}

// SNMP-OID-07: NormalizePowerFactor returns non-zero for non-zero input (PF is actively polled).
func TestSNMPOID07_AllVendorsPFNonZeroForNonZeroInput(t *testing.T) {
	vendors := []string{"apc", "raritan", "servertech"}
	// Representative non-zero raw PF values per vendor encoding
	rawPF := map[string]int64{
		"apc":        95,   // hundredths: 0.95
		"raritan":    950,  // 0.001 units: 0.95
		"servertech": 95,   // hundredths: 0.95
	}
	for _, vendor := range vendors {
		norm, err := normalize.GetNormalizer(vendor)
		if err != nil {
			t.Fatalf("GetNormalizer(%s): %v", vendor, err)
		}
		pf := norm.NormalizePowerFactor(rawPF[vendor])
		if pf == 0 {
			t.Errorf("vendor %s: NormalizePowerFactor(%d) = 0, want non-zero", vendor, rawPF[vendor])
		}
	}
}
