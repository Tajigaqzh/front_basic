import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { parseArgs } from 'node:util'
import pico from 'picocolors'

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const packagesDir = path.join(rootDir, 'packages')
const binDir = path.join(rootDir, 'node_modules', '.bin')

const { values } = parseArgs({
  options: {
    pkg: {
      type: 'string',
      short: 'p',
    },
  },
})

const requestedPkg = values.pkg

const buildablePackages = fs
  .readdirSync(packagesDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .filter(name => fs.existsSync(path.join(packagesDir, name, 'tsconfig.build.json')))

const targets = requestedPkg
  ? buildablePackages.filter(name => name.includes(requestedPkg))
  : buildablePackages

if (requestedPkg && targets.length === 0) {
  console.error(pico.red(`未找到可生成类型的包：${requestedPkg}`))
  process.exit(1)
}

// 先构建底层公共包，再构建依赖它的上层包。
targets.sort((a, b) => {
  if (a === 'shared') return -1
  if (b === 'shared') return 1
  return a.localeCompare(b)
})

run().catch(err => {
  console.error(err)
  process.exit(1)
})

async function run() {
  if (targets.length === 0) {
    console.log(pico.yellow('当前没有发现可生成类型的包。'))
    return
  }

  console.log(pico.cyan(`开始生成类型：${targets.join(', ')}`))

  for (const target of targets) {
    await exec('tsc', ['-p', path.join('packages', target, 'tsconfig.build.json')])
  }

  console.log(pico.green('类型生成完成。'))
}

function exec(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env: {
        ...process.env,
        PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
      },
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
