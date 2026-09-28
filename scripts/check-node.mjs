// Runs before `npm run dev`, `npm run build` and `npm test`. Turns the two
// most common setup problems into a plain message instead of a stack trace.
const NEED = [22, 12];
const [major, minor] = process.versions.node.split('.').map(Number);

function stop(lines) {
  console.error(`\n${lines.join('\n')}\n`);
  process.exit(1);
}

// 1. Node.js too old (Vite 8 and Vitest 5 need 22.12 or newer).
if (major < NEED[0] || (major === NEED[0] && minor < NEED[1])) {
  stop([
    `This project needs Node.js ${NEED.join('.')} or newer, but this terminal is using Node.js ${process.versions.node}.`,
    'Install Node.js 22 or 24 (LTS), then run "npm ci" again. See "Run locally" in README.md.',
  ]);
}

// 2. Packages installed under an older Node.js: npm silently skips the build
//    tool's native part for this computer, and Vite then fails to start.
try {
  await import('rolldown');
} catch (e) {
  if (/native binding/i.test(String(e?.message))) {
    stop([
      'The installed packages are incomplete: they were probably installed with an older Node.js.',
      `Run "npm ci" again (now with Node.js ${process.versions.node}).`,
    ]);
  }
  // Anything else (e.g. a future Vite without rolldown) is left to the tools themselves.
}
