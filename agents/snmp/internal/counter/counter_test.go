package counter

import "testing"

func TestCalculateDelta(t *testing.T) {
	// SNMP-001: Normal delta
	t.Run("SNMP-001: normal delta", func(t *testing.T) {
		r := CalculateDelta(1000, 2000, 32)
		if r.Delta != 1000 {
			t.Errorf("expected delta=1000, got %d", r.Delta)
		}
		if r.WrapDetected || r.ResetDetected {
			t.Error("expected no wrap/reset")
		}
	})

	// SNMP-002: Counter32 wrap
	t.Run("SNMP-002: Counter32 wrap", func(t *testing.T) {
		prev := uint64(4294967290)
		curr := uint64(100)
		// 2^32 - 4294967290 + 100 = 6 + 100 = 106
		expected := uint64(106)
		r := CalculateDelta(prev, curr, 32)
		if r.Delta != expected {
			t.Errorf("expected delta=%d, got %d", expected, r.Delta)
		}
		if !r.WrapDetected {
			t.Error("expected wrap detected")
		}
	})

	// SNMP-003: Counter64 wrap
	t.Run("SNMP-003: Counter64 wrap", func(t *testing.T) {
		prev := Counter64Max - 10 + 1 // 2^64 - 10
		curr := uint64(5)
		// Counter wraps at 2^64: (2^64 - prev) + curr = 10 + 5 = 15
		expected := uint64(15)
		r := CalculateDelta(prev, curr, 64)
		if r.Delta != expected {
			t.Errorf("expected delta=%d, got %d", expected, r.Delta)
		}
		if !r.WrapDetected {
			t.Error("expected wrap detected")
		}
	})

	// SNMP-004: Counter reset (prev=5000, curr=100, not near max)
	t.Run("SNMP-004: counter reset", func(t *testing.T) {
		r := CalculateDelta(5000, 100, 32)
		if r.Delta != 100 {
			t.Errorf("expected delta=100, got %d", r.Delta)
		}
		if !r.ResetDetected {
			t.Error("expected reset detected")
		}
	})

	// SNMP-005: Zero delta
	t.Run("SNMP-005: zero delta", func(t *testing.T) {
		r := CalculateDelta(1000, 1000, 32)
		if r.Delta != 0 {
			t.Errorf("expected delta=0, got %d", r.Delta)
		}
		if r.WrapDetected || r.ResetDetected {
			t.Error("expected no wrap/reset")
		}
	})
}
