package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// Config is the top-level agent configuration.
type Config struct {
	Agent   AgentConfig   `yaml:"agent"`
	Cloud   CloudConfig   `yaml:"cloud"`
	Devices []DeviceConfig `yaml:"devices"`
}

// AgentConfig holds agent-level settings.
type AgentConfig struct {
	PollIntervalSec int    `yaml:"poll_interval_sec"`
	BufferDBPath    string `yaml:"buffer_db_path"`
}

// CloudConfig holds the remote API connection settings.
type CloudConfig struct {
	APIBaseURL       string `yaml:"api_base_url"`
	AuthToken        string `yaml:"auth_token"`
	HeartbeatSec     int    `yaml:"heartbeat_sec"`
	SyncBatchSize    int    `yaml:"sync_batch_size"`
	RetryMaxAttempts int    `yaml:"retry_max_attempts"`
}

// DeviceConfig describes a single SNMP target device.
type DeviceConfig struct {
	Name         string `yaml:"name"`
	Host         string `yaml:"host"`
	Port         int    `yaml:"port"`
	Community    string `yaml:"community"`
	Version      string `yaml:"version"` // "2c" or "3"
	Vendor       string `yaml:"vendor"`  // "apc", "raritan", "servertech"
	MeterID      string `yaml:"meter_id"`
	CounterSize  int    `yaml:"counter_size"` // 32 or 64
	TimeoutSec   int    `yaml:"timeout_sec"`
	RetryCount   int    `yaml:"retry_count"`
}

// Load reads a YAML config file and returns the parsed Config.
func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}

	cfg.applyDefaults()
	return &cfg, nil
}

func (c *Config) validate() error {
	if len(c.Devices) == 0 {
		return fmt.Errorf("config: at least one device required")
	}
	for i, d := range c.Devices {
		if d.Host == "" {
			return fmt.Errorf("config: device[%d] missing host", i)
		}
		if d.Vendor == "" {
			return fmt.Errorf("config: device[%d] missing vendor", i)
		}
		if d.MeterID == "" {
			return fmt.Errorf("config: device[%d] missing meter_id", i)
		}
	}
	return nil
}

func (c *Config) applyDefaults() {
	if c.Agent.PollIntervalSec <= 0 {
		c.Agent.PollIntervalSec = 60
	}
	if c.Agent.BufferDBPath == "" {
		c.Agent.BufferDBPath = "./buffer.db"
	}
	if c.Cloud.HeartbeatSec <= 0 {
		c.Cloud.HeartbeatSec = 60
	}
	if c.Cloud.SyncBatchSize <= 0 {
		c.Cloud.SyncBatchSize = 1000
	}
	if c.Cloud.RetryMaxAttempts <= 0 {
		c.Cloud.RetryMaxAttempts = 3
	}
	for i := range c.Devices {
		if c.Devices[i].Port == 0 {
			c.Devices[i].Port = 161
		}
		if c.Devices[i].Community == "" {
			c.Devices[i].Community = "public"
		}
		if c.Devices[i].Version == "" {
			c.Devices[i].Version = "2c"
		}
		if c.Devices[i].CounterSize == 0 {
			c.Devices[i].CounterSize = 32
		}
		if c.Devices[i].TimeoutSec <= 0 {
			c.Devices[i].TimeoutSec = 5
		}
		if c.Devices[i].RetryCount <= 0 {
			c.Devices[i].RetryCount = 3
		}
	}
}
