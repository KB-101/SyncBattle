// deploy.js - Run before deploying
const fs = require('fs');
const version = process.argv[2] || '1.0.1';

function updateVersion(file, pattern, replacement) {
    const content = fs.readFileSync(file, 'utf8');
    const updated = content.replace(pattern, replacement);
    fs.writeFileSync(file, updated);
    console.log(`Updated ${file}`);
}

// Update HTML
updateVersion(
    'index.html',
    /(href|src)=["']([^"']*\.(css|js|json))["']/g,
    function(match, attr, filename) {
        if (!filename.includes('?v=') && !filename.startsWith('http')) {
            return `${attr}="${filename}?v=${version}"`;
        }
        return match;
    }
);

// Update manifest.json
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
manifest.description += ` - v${version}`;
manifest.start_url = `./?v=${version}`;
fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2));

// Update script.js
updateVersion(
    'script.js',
    /const APP_VERSION = ['"][^'"]*['"]/,
    `const APP_VERSION = '${version}'`
);

console.log(`✅ Updated to version ${version}`);
