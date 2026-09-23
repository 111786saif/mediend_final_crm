const fs = require('fs')
const baseline = fs.readFileSync('.lead-pagination-baseline.log','utf8').split(/\r?\n/)
const normalize = s => s.replace(/\(\d+,\d+\)/, '')
const known = new Set(baseline.filter(l => /^[^(]+\(\d+,\d+\): error/.test(l)).map(normalize))
const log = process.argv[2] || '.task-checks/types-round3.log'
const rows = []
for (const line of fs.readFileSync(log,'utf8').split(/\r?\n/)) {
  const m = line.match(/^(.+)\((\d+),(\d+)\): error (TS\d+): (.*)/)
  if (!m || known.has(normalize(line)) || !fs.existsSync(m[1])) continue
  const code = fs.readFileSync(m[1],'utf8').split(/\r?\n/)
  rows.push(`${m[1]}:${m[2]} ${m[4]} ${m[5].substring(0,130)}\n  ${code[Number(m[2])-1]?.trim()}`)
}
fs.writeFileSync('.task-checks/new-errors.txt', rows.join('\n'))
console.log(`${rows.length} changed/new diagnostics`)
