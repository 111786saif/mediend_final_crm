#!/bin/bash

# Typesense Leads Sync Wrapper Script for Linux/Mac
# Handles logging, error reporting, and prevents overlapping sync runs using PID lockfiles.
# Perfect for scheduling via crontab (e.g. every 5 minutes).

# Set paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_ROOT/logs"
LOG_FILE="$LOG_DIR/sync-typesense.log"
ERROR_LOG_FILE="$LOG_DIR/sync-typesense-error.log"
LOCK_FILE="$LOG_DIR/sync-typesense.lock"

# Ensure logs directory exists
mkdir -p "$LOG_DIR"

# Function to log with timestamp
log() {
    local level="${2:-INFO}"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $1" >> "$LOG_FILE"
    
    # Also output to console if running interactively
    if [ -t 0 ]; then
        echo "[$timestamp] [$level] $1"
    fi
}

# Function to log errors
log_error() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] ERROR: $1" >> "$ERROR_LOG_FILE"
    log "$1" "ERROR"
}

# Check for lock file (prevent overlapping syncs)
if [ -f "$LOCK_FILE" ]; then
    LOCK_PID=$(cat "$LOCK_FILE" 2>/dev/null)
    
    if [ -n "$LOCK_PID" ]; then
        # Check if process is still running
        if ps -p "$LOCK_PID" > /dev/null 2>&1; then
            log "Typesense sync already running (PID: $LOCK_PID), skipping this run" "WARN"
            exit 0
        else
            # Stale lock file, remove it
            rm -f "$LOCK_FILE"
            log "Removed stale lock file"
        fi
    fi
fi

# Create lock file
echo $$ > "$LOCK_FILE"

# Ensure lock file is removed on exit
trap "rm -f $LOCK_FILE" EXIT INT TERM

# Change to project directory
cd "$PROJECT_ROOT" || {
    log_error "Failed to change to project directory: $PROJECT_ROOT"
    exit 1
}

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    set -a
    source .env
    set +a
    log "Loaded environment variables from .env"
fi

# Start sync
log "Starting scheduled Typesense lead sync (PID: $$)"

# Prefer bun if installed, otherwise fallback to npm run
if command -v bun >/dev/null 2>&1; then
    SYNC_COMMAND="bun run typesense:sync"
elif [ -f "$HOME/.bun/bin/bun" ]; then
    SYNC_COMMAND="$HOME/.bun/bin/bun run typesense:sync"
else
    SYNC_COMMAND="npm run typesense:sync"
fi

log "Executing: $SYNC_COMMAND"

# Run command and redirect output
if [ -t 0 ]; then
    # Interactive mode: show output in real-time and log to file
    $SYNC_COMMAND 2>&1 | tee -a "$LOG_FILE"
    EXIT_CODE=${PIPESTATUS[0]}
else
    # Non-interactive mode (crontab): log to file
    $SYNC_COMMAND >> "$LOG_FILE" 2>> "$ERROR_LOG_FILE"
    EXIT_CODE=$?
fi

if [ $EXIT_CODE -eq 0 ]; then
    log "Typesense lead sync completed successfully"
else
    log_error "Typesense lead sync failed with exit code: $EXIT_CODE"
    log_error "Check the error log for details: $ERROR_LOG_FILE"
    exit $EXIT_CODE
fi

exit 0
