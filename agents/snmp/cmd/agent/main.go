package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/nitishagar/bharatdcim/agents/snmp/internal/buffer"
	"github.com/nitishagar/bharatdcim/agents/snmp/internal/config"
	"github.com/nitishagar/bharatdcim/agents/snmp/internal/poller"
	syncclient "github.com/nitishagar/bharatdcim/agents/snmp/internal/sync"
)

const version = "0.1.0"

func main() {
	configPath := flag.String("config", "./config.yaml", "Path to YAML config file")
	once := flag.Bool("once", false, "Poll all devices once and exit")
	showVersion := flag.Bool("version", false, "Print version and exit")
	flag.Parse()

	if *showVersion {
		fmt.Printf("BharatDCIM SNMP Agent v%s\n", version)
		os.Exit(0)
	}

	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	buf, err := buffer.New(cfg.Agent.BufferDBPath)
	if err != nil {
		log.Fatalf("buffer: %v", err)
	}
	defer buf.Close()

	p := poller.New(cfg.Devices, buf)
	cloud := syncclient.NewClient(cfg.Cloud.APIBaseURL, cfg.Cloud.AuthToken, cfg.Cloud.RetryMaxAttempts)

	log.Printf("BharatDCIM SNMP Agent v%s started — %d devices, poll every %ds",
		version, len(cfg.Devices), cfg.Agent.PollIntervalSec)

	if *once {
		p.PollAll()
		syncReadings(buf, cloud, cfg.Cloud.SyncBatchSize)
		return
	}

	// Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	pollTicker := time.NewTicker(time.Duration(cfg.Agent.PollIntervalSec) * time.Second)
	defer pollTicker.Stop()

	heartbeatTicker := time.NewTicker(time.Duration(cfg.Cloud.HeartbeatSec) * time.Second)
	defer heartbeatTicker.Stop()

	// Purge synced readings older than 7 days, once per hour
	purgeTicker := time.NewTicker(1 * time.Hour)
	defer purgeTicker.Stop()

	// Initial poll
	p.PollAll()
	syncReadings(buf, cloud, cfg.Cloud.SyncBatchSize)

	for {
		select {
		case <-pollTicker.C:
			p.PollAll()
			syncReadings(buf, cloud, cfg.Cloud.SyncBatchSize)

		case <-heartbeatTicker.C:
			unsynced, _ := buf.UnsyncedCount()
			err := cloud.SendHeartbeat(syncclient.HeartbeatPayload{
				AgentID:       cfg.Cloud.AgentID,
				AgentVersion:  version,
				DeviceCount:   len(cfg.Devices),
				UnsyncedCount: unsynced,
				TenantID:      cfg.Cloud.TenantID,
				Timestamp:     time.Now().UTC().Format(time.RFC3339),
			})
			if err != nil {
				log.Printf("[WARN] heartbeat: %v", err)
			}

		case <-purgeTicker.C:
			purged, err := buf.PurgeOlderThan(7 * 24 * time.Hour)
			if err != nil {
				log.Printf("[WARN] purge: %v", err)
			} else if purged > 0 {
				log.Printf("purged %d old synced readings", purged)
			}

		case sig := <-sigCh:
			log.Printf("received %v, shutting down...", sig)
			return
		}
	}
}

func syncReadings(buf *buffer.Buffer, cloud *syncclient.Client, batchSize int) {
	readings, err := buf.GetUnsynced(batchSize)
	if err != nil {
		log.Printf("[WARN] fetch unsynced: %v", err)
		return
	}
	if len(readings) == 0 {
		return
	}

	payloads := make([]syncclient.ReadingPayload, len(readings))
	ids := make([]int64, len(readings))
	for i, r := range readings {
		payloads[i] = syncclient.ReadingPayload{
			MeterID:   r.MeterID,
			Timestamp: r.Timestamp,
			KWh:       r.KWh,
			KW:        r.KW,
			PF:        r.PF,
		}
		ids[i] = r.ID
	}

	count, err := cloud.UploadReadings(payloads)
	if err != nil {
		log.Printf("[WARN] upload: %v", err)
		return
	}

	if err := buf.MarkSynced(ids); err != nil {
		log.Printf("[WARN] mark synced: %v", err)
		return
	}

	log.Printf("synced %d readings", count)
}
