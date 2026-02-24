package counter

const (
	// Counter32Max is 2^32, the wrap point for SNMP Counter32 values.
	Counter32Max = uint64(1 << 32)
	// Counter64Max is 2^64-1, the wrap point for SNMP Counter64 values.
	Counter64Max = ^uint64(0) // math.MaxUint64
)

// Result holds the outcome of a counter delta calculation.
type Result struct {
	Delta         uint64
	WrapDetected  bool
	ResetDetected bool
}

// CalculateDelta computes the difference between two consecutive SNMP counter
// readings, handling wrap-around (Counter32 or Counter64) and counter resets.
//
// counterSize must be 32 or 64.
//
// Wrap detection: if curr < prev and prev is within 10% of the counter's max
// value, we assume a wrap and compute (max - prev + curr).
//
// Reset detection: if curr < prev and prev is NOT near max, we assume the
// device reset and use curr as the delta (first reading after reset).
func CalculateDelta(prev, curr uint64, counterSize int) Result {
	if curr >= prev {
		return Result{Delta: curr - prev}
	}

	// curr < prev — potential wrap or reset
	var maxVal uint64
	if counterSize == 32 {
		maxVal = Counter32Max
	} else {
		maxVal = Counter64Max
	}

	// Wrap: prev is near max (within 10% of max)
	threshold := maxVal / 10
	if prev > maxVal-threshold {
		// For Counter32: (2^32 - prev) + curr (fits in uint64).
		// For Counter64: 2^64 overflows uint64, so we use unsigned underflow:
		//   curr - prev in uint64 gives (2^64 - prev + curr) mod 2^64.
		var delta uint64
		if counterSize == 32 {
			delta = (Counter32Max - prev) + curr
		} else {
			// unsigned underflow: equivalent to 2^64 - prev + curr
			delta = curr - prev
		}
		return Result{Delta: delta, WrapDetected: true}
	}

	// Reset: prev is not near max, counter went backwards
	return Result{Delta: curr, ResetDetected: true}
}
