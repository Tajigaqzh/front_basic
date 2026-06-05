import fs from 'node:fs'
import path from 'node:path'
import { cpus } from 'node:os'
import { spawn } from 'node:child_process'
import { parseArgs } from 'node:util'
import pico from 'picocolors'

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const packagesDir = path.join(rootDir, 'packages')

const { values } = parseArgs({
  options: {
    formats: {
      type: 'string',
      short: 'f',
    },
    pkg: {
      type: 'string',
      short: 'p',
    },
    all: {
      type: 'boolean',
      short: 'a',
      default: false,
    },
  },
})

const requestedFormats = values.formats
const requestedPkg = values.pkg

const allPackages = fs
  .readdirSync(packagesDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)

const buildablePackages = allPackages.filter(name =>
  fs.existsSync(path.join(packagesDir, name, 'src', 'index.ts')),
)

const targets = requestedPkg
  ? buildablePackages.filter(name => name.includes(requestedPkg))
  : buildablePackages

if (requestedPkg && targets.length === 0) {
  console.error(pico.red(`未找到可构建的包：${requestedPkg}`))
  process.exit(1)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})

async function run() {
  if (targets.length === 0) {
    console.log(pico.yellow('当前没有发现可构建的包。'))
    return
  }

  console.log(
    pico.cyan(
      `开始构建：${targets.join(', ')}${requestedFormats ? `，格式：${requestedFormats}` : ''}`,
    ),
  )

  await runParallel(Math.max(1, Math.min(cpus().length, targets.length)), targets, build)

  console.log(pico.green('构建完成。'))
}

async function runParallel(maxConcurrency, source, iteratorFn) {
  const ret = []
  const executing = []

  for (const item of source) {
    const p = Promise.resolve().then(() => iteratorFn(item))
    ret.push(p)

    if (maxConcurrency <= source.length) {
      const e = p.finally(() => {
        const index = executing.indexOf(e)
        if (index >= 0) executing.splice(index, 1)
      })
      executing.push(e)
      if (executing.length >= maxConcurrency) {
        await Promise.race(executing)
      }
    }
  }

  await Promise.all(ret)
}

async function build(target) {
  await exec('rollup', [
    '-c',
    '--environment',
    [`TARGET:${target}`, requestedFormats ? `FORMATS:${requestedFormats}` : '']
      .filter(Boolean)
      .join(','),
  ])
}

function exec(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })

    child.on('close', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} ${args.join(' ')} 执行失败，退出码：${code}`))
      }
    })
  })
}
