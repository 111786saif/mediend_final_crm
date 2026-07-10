/**
 * One-shot production database bootstrap:
 *   1. prisma migrate deploy   (schema from squashed init migration)
 *   2. baseline reference data (leave types, departments, PnL config)
 *   3. RBAC resources
 *   4. employees/users from JSON
 *   5. role-level permissions
 *   6. CRM master dropdowns (hospitals, doctors, TPA, anesthesia)
 *   7. insurance + TPA companies
 *   8. leads from MySQL (optional)
 *
 * Local:
 *   bun run db:init -- --employees-json ./csvjson(5).json --leads-from 2020-01-01
 *
 * Docker (server):
 *   docker compose --profile tools run --rm \
 *     -v "/path/to/csvjson(5).json:/app/csvjson(5).json" \
 *     init-db -- --employees-json /app/csvjson(5).json --leads-from 2020-01-01
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

type Step =
  | 'migrate'
  | 'baseline'
  | 'rbac'
  | 'employees'
  | 'permissions'
  | 'masters'
  | 'insurance-tpa'
  | 'leads'

const ALL_STEPS: Step[] = [
  'migrate',
  'baseline',
  'rbac',
  'employees',
  'permissions',
  'masters',
  'insurance-tpa',
  'leads',
]

function parseArgs(argv: string[]) {
  const skip = new Set<Step>()
  let employeesJson = process.env.EMPLOYEES_JSON || ''
  let leadsFrom = process.env.LEADS_FROM || ''
  let only: Step[] | null = null

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--skip-migrate') skip.add('migrate')
    else if (arg === '--skip-baseline') skip.add('baseline')
    else if (arg === '--skip-rbac') skip.add('rbac')
    else if (arg === '--skip-employees') skip.add('employees')
    else if (arg === '--skip-permissions') skip.add('permissions')
    else if (arg === '--skip-masters') skip.add('masters')
    else if (arg === '--skip-insurance-tpa') skip.add('insurance-tpa')
    else if (arg === '--skip-leads') skip.add('leads')
    else if (arg === '--employees-json') {
      employeesJson = argv[++i] || ''
    } else if (arg === '--leads-from') {
      leadsFrom = argv[++i] || ''
    } else if (arg === '--only') {
      const raw = argv[++i] || ''
      only = raw.split(',').map((s) => s.trim()) as Step[]
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }
  }

  const steps = (only ?? ALL_STEPS).filter((s) => !skip.has(s))
  return { steps, employeesJson, leadsFrom }
}

function printHelp() {
  console.log(`
Usage: bun run db:init -- [options]

Options:
  --employees-json <path>   Employee/user JSON (required unless --skip-employees)
  --leads-from <YYYY-MM-DD>  MySQL leads sync start date (skips leads if omitted)
  --only <step,step,...>    Run only these steps: ${ALL_STEPS.join(', ')}
  --skip-migrate            Skip prisma migrate deploy
  --skip-baseline           Skip leave types / departments / PnL config
  --skip-rbac               Skip RBAC resource seed
  --skip-employees          Skip employee/user seed from JSON
  --skip-permissions        Skip role permission assignments
  --skip-masters            Skip hospital/doctor/TPA master seed
  --skip-insurance-tpa      Skip insurance company seed
  --skip-leads              Skip MySQL lead sync

Environment:
  EMPLOYEES_JSON, LEADS_FROM — same as CLI flags
  DATABASE_URL — required (from .env)
`)
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n>>> ${command} ${args.join(' ')}`)
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env,
      cwd: process.cwd(),
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with code ${code}`))
    })
  })
}

async function runBunScript(scriptPath: string, extraArgs: string[] = []) {
  const bun = process.platform === 'win32' ? 'bun.exe' : 'bun'
  await run(bun, ['run', scriptPath, ...extraArgs])
}

async function main() {
  const { steps, employeesJson, leadsFrom } = parseArgs(process.argv.slice(2))

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Check your .env file.')
    process.exit(1)
  }

  console.log('=== Mediend DB init ===')
  console.log('Steps:', steps.join(' → '))

  for (const step of steps) {
    switch (step) {
      case 'migrate':
        await run('bunx', ['prisma', 'migrate', 'deploy'])
        break

      case 'baseline':
        await runBunScript('prisma/seed-baseline.ts')
        break

      case 'rbac':
        await runBunScript('scripts/seed-rbac.ts')
        break

      case 'employees': {
        const jsonPath = employeesJson || path.join(process.cwd(), 'csvjson(5).json')
        if (!existsSync(jsonPath)) {
          console.error(
            `Employee JSON not found: ${jsonPath}\n` +
              'Pass --employees-json <path> or mount the file in Docker.'
          )
          process.exit(1)
        }
        await runBunScript('scripts/seed-employees-from-json.ts', [jsonPath])
        break
      }

      case 'permissions':
        await runBunScript('scripts/seed-role-permissions.ts')
        break

      case 'masters':
        await runBunScript('prisma/seed-masters.ts')
        break

      case 'insurance-tpa':
        await runBunScript('scripts/seed-insurance-tpa.ts')
        break

      case 'leads':
        if (!leadsFrom) {
          console.log('Skipping leads sync (--leads-from not set).')
          break
        }
        await runBunScript('scripts/sync-mysql-leads.ts', ['--from', leadsFrom])
        break
    }
  }

  console.log('\n=== DB init complete ===')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
