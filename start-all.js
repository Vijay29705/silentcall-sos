const { spawn } = require('child_process');
const path = require('path');

console.log('\x1b[36m%s\x1b[0m', '══════════════════════════════════════════════════════════════════════');
console.log('\x1b[1m\x1b[31m%s\x1b[0m', ' 🚨 SilentCall-SOS: Zero-Audio Emergency Triage Engine');
console.log('\x1b[36m%s\x1b[0m', ' Final Year B.Tech IT Project | Launching Server & Client Subsystems...');
console.log('\x1b[36m%s\x1b[0m', '══════════════════════════════════════════════════════════════════════\n');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

// Start Server
const serverProcess = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(__dirname, 'server'),
  stdio: 'inherit',
  shell: true
});

// Start Client
const clientProcess = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(__dirname, 'client'),
  stdio: 'inherit',
  shell: true
});

function cleanup() {
  console.log('\n[Shutting down SilentCall-SOS processes...]');
  if (serverProcess) serverProcess.kill();
  if (clientProcess) clientProcess.kill();
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
