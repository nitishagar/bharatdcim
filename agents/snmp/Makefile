.PHONY: all build test lint clean

all: build test lint

build:
	go build -o bin/snmp-agent ./cmd/agent

test:
	go test ./... -v -count=1

lint:
	go vet ./...

clean:
	rm -rf bin/

docker:
	docker build -t bharatdcim-snmp-agent .
