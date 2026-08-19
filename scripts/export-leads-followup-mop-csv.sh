#!/usr/bin/env bash
# Regenerate leads_export.csv from legacy MySQL CRM (run on the MySQL/CRM server).
#
# Exports only lead id + follow-up date + mode of payment (no patient name/phone).
# Output columns match scripts/import-leads-followup-mop-csv.ts:
#   id, Follow-up_Date, Mode_Of_Payment
#
# Usage (on CRM server):
#   chmod +x scripts/export-leads-followup-mop-csv.sh
#   ./scripts/export-leads-followup-mop-csv.sh /root/leads_export.csv
#
# Then copy to workspace server (patient data stays off your laptop):
#   scp /root/leads_export.csv root@WORKSPACE_IP:/root/mediend.workspace/data/leads_export.csv

set -euo pipefail

OUTPUT="${1:-/root/leads_export.csv}"
DB="${MYSQL_DATABASE:-kundkun_mediendcrm}"
MYSQL_USER="${MYSQL_USER:-root}"

mkdir -p "$(dirname "$OUTPUT")"

{
  echo "id,Follow-up_Date,Mode_Of_Payment"
  mysql -N -B -u "$MYSQL_USER" "$DB" -e "
    SELECT
      l.id,
      IFNULL(DATE_FORMAT(l.\`Follow-up_Date\`, '%Y-%m-%d %H:%i:%s'), 'NULL'),
      IFNULL(
        CASE TRIM(CAST(l.MOP AS CHAR))
          WHEN '1' THEN 'Cash'
          WHEN '2' THEN 'Cashless'
          WHEN '3' THEN 'EMI'
          WHEN '4' THEN 'Reimbursement'
          WHEN '' THEN NULL
          ELSE TRIM(CAST(l.MOP AS CHAR))
        END,
        'NULL'
      )
    FROM \`lead\` l
  " | sed 's/\t/,/g'
} > "$OUTPUT"

echo "Wrote $(wc -l < "$OUTPUT") lines to $OUTPUT"
ls -lh "$OUTPUT"
