package buffer

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// Reading represents a single power reading buffered locally.
type Reading struct {
	ID        int64
	MeterID   string
	Timestamp string
	KWh       float64
	KW        float64
	PF        float64
	Synced    bool
	CreatedAt string
}

// Buffer provides a SQLite-backed store-and-forward buffer for power readings.
type Buffer struct {
	db *sql.DB
}

// New creates a new Buffer backed by a SQLite database at the given path.
// Use ":memory:" for testing.
func New(dbPath string) (*Buffer, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open buffer db: %w", err)
	}

	if err := createSchema(db); err != nil {
		db.Close()
		return nil, err
	}

	return &Buffer{db: db}, nil
}

func createSchema(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS readings (
			id         INTEGER PRIMARY KEY AUTOINCREMENT,
			meter_id   TEXT    NOT NULL,
			timestamp  TEXT    NOT NULL,
			kwh        REAL    NOT NULL DEFAULT 0,
			kw         REAL    NOT NULL DEFAULT 0,
			pf         REAL    NOT NULL DEFAULT 0,
			synced     INTEGER NOT NULL DEFAULT 0,
			created_at TEXT    NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_readings_synced ON readings(synced);
	`)
	if err != nil {
		return fmt.Errorf("create schema: %w", err)
	}
	return nil
}

// Insert adds a reading to the buffer.
func (b *Buffer) Insert(r Reading) error {
	_, err := b.db.Exec(
		`INSERT INTO readings (meter_id, timestamp, kwh, kw, pf, synced, created_at)
		 VALUES (?, ?, ?, ?, ?, 0, ?)`,
		r.MeterID, r.Timestamp, r.KWh, r.KW, r.PF, time.Now().UTC().Format(time.RFC3339),
	)
	return err
}

// GetUnsynced returns up to `limit` unsynced readings, oldest first.
func (b *Buffer) GetUnsynced(limit int) ([]Reading, error) {
	rows, err := b.db.Query(
		`SELECT id, meter_id, timestamp, kwh, kw, pf, synced, created_at
		 FROM readings WHERE synced = 0 ORDER BY id ASC LIMIT ?`, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var readings []Reading
	for rows.Next() {
		var r Reading
		if err := rows.Scan(&r.ID, &r.MeterID, &r.Timestamp, &r.KWh, &r.KW, &r.PF, &r.Synced, &r.CreatedAt); err != nil {
			return nil, err
		}
		readings = append(readings, r)
	}
	return readings, rows.Err()
}

// MarkSynced marks a list of reading IDs as synced.
func (b *Buffer) MarkSynced(ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	tx, err := b.db.Begin()
	if err != nil {
		return err
	}
	stmt, err := tx.Prepare("UPDATE readings SET synced = 1 WHERE id = ?")
	if err != nil {
		tx.Rollback()
		return err
	}
	defer stmt.Close()

	for _, id := range ids {
		if _, err := stmt.Exec(id); err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}

// PurgeOlderThan removes synced readings older than the given duration.
func (b *Buffer) PurgeOlderThan(d time.Duration) (int64, error) {
	cutoff := time.Now().UTC().Add(-d).Format(time.RFC3339)
	result, err := b.db.Exec(
		"DELETE FROM readings WHERE synced = 1 AND created_at < ?", cutoff,
	)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// Count returns the total number of readings in the buffer.
func (b *Buffer) Count() (int64, error) {
	var count int64
	err := b.db.QueryRow("SELECT COUNT(*) FROM readings").Scan(&count)
	return count, err
}

// UnsyncedCount returns the number of unsynced readings.
func (b *Buffer) UnsyncedCount() (int64, error) {
	var count int64
	err := b.db.QueryRow("SELECT COUNT(*) FROM readings WHERE synced = 0").Scan(&count)
	return count, err
}

// Close closes the underlying database connection.
func (b *Buffer) Close() error {
	return b.db.Close()
}
