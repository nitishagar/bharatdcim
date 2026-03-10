package poller

import (
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/gosnmp/gosnmp"
	"github.com/nitishagar/bharatdcim/agents/snmp/internal/buffer"
	"github.com/nitishagar/bharatdcim/agents/snmp/internal/config"
	"github.com/nitishagar/bharatdcim/agents/snmp/internal/counter"
	"github.com/nitishagar/bharatdcim/agents/snmp/internal/normalize"
)

// OIDs for power, energy, and power factor readings per vendor.
var vendorOIDs = map[string]struct{ Power, Energy, PowerFactor string }{
	"apc": {
		Power:       ".1.3.6.1.4.1.318.1.1.26.4.3.1.5.1",
		Energy:      ".1.3.6.1.4.1.318.1.1.26.4.3.1.7.1",
		PowerFactor: ".1.3.6.1.4.1.318.1.1.26.6.3.1.9", // hundredths: 95 = 0.95
	},
	"raritan": {
		Power:       ".1.3.6.1.4.1.13742.6.5.2.3.1.4.1.1.5",
		Energy:      ".1.3.6.1.4.1.13742.6.5.2.3.1.4.1.1.8",
		PowerFactor: ".1.3.6.1.4.1.13742.6.5.2.3.1.4.1.1.7", // 0.001 units: 950 = 0.95
	},
	"servertech": {
		Power:       ".1.3.6.1.4.1.1718.3.2.2.1.12",
		Energy:      ".1.3.6.1.4.1.1718.3.2.2.1.16",
		PowerFactor: ".1.3.6.1.4.1.1718.3.2.2.1.14", // hundredths: 95 = 0.95
	},
}

// prevCounters stores the last energy counter reading per device for delta calc.
type prevCounters struct {
	mu     sync.Mutex
	values map[string]uint64 // key: meterID
}

// Poller orchestrates SNMP polling across configured devices.
type Poller struct {
	devices  []config.DeviceConfig
	buf      *buffer.Buffer
	counters *prevCounters
}

// New creates a new Poller.
func New(devices []config.DeviceConfig, buf *buffer.Buffer) *Poller {
	return &Poller{
		devices:  devices,
		buf:      buf,
		counters: &prevCounters{values: make(map[string]uint64)},
	}
}

// PollAll polls all devices concurrently and buffers the results.
func (p *Poller) PollAll() {
	var wg sync.WaitGroup
	for _, dev := range p.devices {
		wg.Add(1)
		go func(d config.DeviceConfig) {
			defer wg.Done()
			if err := p.pollDevice(d); err != nil {
				log.Printf("[WARN] poll %s (%s): %v", d.Name, d.Host, err)
			}
		}(dev)
	}
	wg.Wait()
}

func (p *Poller) pollDevice(dev config.DeviceConfig) error {
	oids, ok := vendorOIDs[dev.Vendor]
	if !ok {
		return fmt.Errorf("unsupported vendor: %s", dev.Vendor)
	}

	norm, err := normalize.GetNormalizer(dev.Vendor)
	if err != nil {
		return err
	}

	snmpClient := &gosnmp.GoSNMP{
		Target:    dev.Host,
		Port:      uint16(dev.Port),
		Community: dev.Community,
		Version:   gosnmp.Version2c,
		Timeout:   time.Duration(dev.TimeoutSec) * time.Second,
		Retries:   dev.RetryCount,
	}

	if err := snmpClient.Connect(); err != nil {
		return fmt.Errorf("connect: %w", err)
	}
	defer snmpClient.Conn.Close()

	result, err := snmpClient.Get([]string{oids.Power, oids.Energy, oids.PowerFactor})
	if err != nil {
		return fmt.Errorf("snmp get: %w", err)
	}

	if len(result.Variables) < 3 {
		return fmt.Errorf("expected 3 variables, got %d", len(result.Variables))
	}

	rawPower := toInt64(result.Variables[0])
	rawEnergy := toInt64(result.Variables[1])

	kw := norm.NormalizePower(rawPower)

	// Calculate energy delta
	currEnergy := uint64(rawEnergy)
	var kwhDelta float64

	p.counters.mu.Lock()
	prev, hasPrev := p.counters.values[dev.MeterID]
	p.counters.values[dev.MeterID] = currEnergy
	p.counters.mu.Unlock()

	if hasPrev {
		cr := counter.CalculateDelta(prev, currEnergy, dev.CounterSize)
		kwhDelta = norm.NormalizeEnergy(int64(cr.Delta))
	}

	rawPF := toInt64(result.Variables[2])
	pf := norm.NormalizePowerFactor(rawPF)

	return p.buf.Insert(buffer.Reading{
		MeterID:   dev.MeterID,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		KWh:       kwhDelta,
		KW:        kw,
		PF:        pf,
	})
}

func toInt64(pdu gosnmp.SnmpPDU) int64 {
	switch v := pdu.Value.(type) {
	case int:
		return int64(v)
	case int64:
		return v
	case uint:
		return int64(v)
	case uint64:
		return int64(v)
	case uint32:
		return int64(v)
	default:
		return 0
	}
}
