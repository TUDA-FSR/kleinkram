#!/usr/bin/env bash
# Warn when the TLS leaf or the enterprise CA root is within $WARN_DAYS of
# expiry. Runs weekly from fsr's crontab; logs to syslog (journalctl -t
# kleinkram-cert) and prints to stdout (which cron mails if configured).
# Exit 1 when anything is near expiry so it can be wired to alerting later.
set -euo pipefail
cd "$(dirname "$0")/.."
WARN_DAYS="${WARN_DAYS:-60}"
rc=0
for f in certs/site/kleinkram.crt certs/fsrnet-root.crt; do
    end=$(openssl x509 -in "$f" -noout -enddate | cut -d= -f2)
    days=$(( ( $(date -d "$end" +%s) - $(date +%s) ) / 86400 ))
    msg="$f expires in ${days}d ($end)"
    if (( days < WARN_DAYS )); then
        logger -t kleinkram-cert -p user.warning "WARNING: $msg - see certs/README.md for renewal"
        echo "WARNING: $msg"; rc=1
    else
        logger -t kleinkram-cert -p user.info "$msg"
        echo "ok: $msg"
    fi
done
exit $rc
