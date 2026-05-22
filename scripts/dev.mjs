import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

console.log('Starting dev services (Next.js + FastAPI)...')

// On Windows, commands often need shell: true to resolve correctly in PATH
const isWindows = process.platform === 'win32'
const pythonCmd = 'python'

console.log(`[dev] Spawning FastAPI via: ${pythonCmd} -m uvicorn api.process:app --port 8000 --reload`)
const uvicorn = spawn(pythonCmd, ['-m', 'uvicorn', 'api.process:app', '--port', '8000', '--reload'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PYTHONUNBUFFERED: '1' }
})

console.log(`[dev] Spawning Next.js dev server...`)
const next = spawn('npx', ['next', 'dev'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: true
})

// Handle spawn errors
uvicorn.on('error', (err) => {
  console.error('[dev] Failed to start FastAPI process:', err)
})

next.on('error', (err) => {
  console.error('[dev] Failed to start Next.js process:', err)
})

// Handle graceful shutdown of both processes
const cleanup = () => {
  console.log('\n[dev] Shutting down dev services...')
  try { uvicorn.kill() } catch {}
  try { next.kill() } catch {}
  process.exit()
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

uvicorn.on('close', (code) => {
  console.log(`[dev] FastAPI process exited with code ${code}`)
  try { next.kill() } catch {}
})

next.on('close', (code) => {
  console.log(`[dev] Next.js process exited with code ${code}`)
  try { uvicorn.kill() } catch {}
})
