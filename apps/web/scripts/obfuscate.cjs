/* eslint-disable @typescript-eslint/no-require-imports */
// ─────────[❃] PRODUCTION OBFUSCATOR (client chunks only) [❃]──────────
// Runs after `react-router build`. Walks build/client/assets/**/*.js and
// obfuscates every JS file with javascript-obfuscator (browser preset).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.join(__dirname, '..');

let JavaScriptObfuscator;
try {
    JavaScriptObfuscator = require('javascript-obfuscator');
} catch (err) {
    console.error('❌ javascript-obfuscator is not installed.');
    console.error('   Run: npm install --save-dev javascript-obfuscator');
    process.exit(1);
}

const ROOT = path.join(REPO_ROOT, 'build', 'client', 'assets');

if (!fs.existsSync(ROOT)) {
    console.warn(`⚠️  ${ROOT} not found. Run \`react-router build\` first.`);
    process.exit(0);
}

const SKIP_PATTERNS = [
    /\.map$/,                            // source maps
];

const obfuscatorOptions = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.5,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.2,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    renameGlobals: false,
    selfDefending: false,
    identifierNamesGenerator: 'hexadecimal',
    transformObjectKeys: false,
    unicodeEscapeSequence: false,
    target: 'browser',
};

function walk(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...walk(p));
        } else if (entry.isFile() && p.endsWith('.js')) {
            out.push(p);
        }
    }
    return out;
}

const files = walk(ROOT).filter((f) => !SKIP_PATTERNS.some((re) => re.test(f.replace(/\\/g, '/'))));

console.log(`\n🔒 Obfuscating ${files.length} JS files in build/client/assets/…\n`);

let done = 0;
let failed = 0;
let savedBytes = 0;
let addedBytes = 0;

for (const file of files) {
    const code = fs.readFileSync(file, 'utf-8');
    const beforeKB = code.length / 1024;
    try {
        const hash = crypto
            .createHash('sha1')
            .update(path.relative(ROOT, file).replace(/\\/g, '/'))
            .digest('hex')
            .slice(0, 10);
        const result = JavaScriptObfuscator.obfuscate(code, {
            ...obfuscatorOptions,
            identifiersPrefix: `mdx_${hash}_`,
        });
        const out = result.getObfuscatedCode();
        fs.writeFileSync(file, out);
        const afterKB = out.length / 1024;
        if (afterKB > beforeKB) addedBytes += (afterKB - beforeKB);
        else savedBytes += (beforeKB - afterKB);
        done++;
        const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
        process.stdout.write(`  ✓ ${rel} (${beforeKB.toFixed(1)}KB → ${afterKB.toFixed(1)}KB)\n`);
    } catch (err) {
        failed++;
        const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
        console.error(`  ✗ ${rel}: ${err.message}`);
    }
}

console.log(`\n🔒 Done. ${done}/${files.length} obfuscated${failed ? `, ${failed} failed` : ''}.`);
console.log(`   net size delta: +${addedBytes.toFixed(1)}KB / -${savedBytes.toFixed(1)}KB\n`);
