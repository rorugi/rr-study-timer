const fs = require('fs');
const path = require('path');
const bestzip = require('bestzip');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.json'), 'utf8'));
if (manifest.id !== 'rr-study-timer') throw new Error('Unexpected plugin ID');
// Always create a fresh archive: updating an existing ZIP retains deleted widgets.
const temporaryZip = path.join(root, `PluginZip-${Date.now()}.zip`);
bestzip({ source: fs.readdirSync(dist), destination: temporaryZip, cwd: dist })
  .then(() => {
    fs.copyFileSync(temporaryZip, path.join(root, 'PluginZip.zip'));
    fs.unlinkSync(temporaryZip);
  })
  .catch(error => { console.error(error); process.exitCode = 1; });
