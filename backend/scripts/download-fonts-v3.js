/**
 * Script to download Google Fonts for signature rendering
 * Uses alternative CDN with verified static fonts
 * Run with: node backend/scripts/download-fonts-v3.js
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fontsDir = path.join(__dirname, '..', 'fonts');

// Ensure fonts directory exists
if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir, { recursive: true });
}

// Using gwfh.mranftl.com which provides direct static font downloads
// This is a reliable mirror of Google Fonts with static versions
const fonts = [
    {
        id: 'dancing-script',
        name: 'Dancing Script',
        url: 'https://gwfh.mranftl.com/api/fonts/dancing-script?download=zip&subsets=latin&variants=regular',
        filename: 'dancing_script.ttf',
        zipEntry: 'dancing-script-v24-latin-regular.ttf'
    },
    {
        id: 'great-vibes',
        name: 'Great Vibes',
        url: 'https://gwfh.mranftl.com/api/fonts/great-vibes?download=zip&subsets=latin&variants=regular',
        filename: 'great_vibes.ttf',
        zipEntry: 'great-vibes-v19-latin-regular.ttf'
    },
    {
        id: 'allura',
        name: 'Allura',
        url: 'https://gwfh.mranftl.com/api/fonts/allura?download=zip&subsets=latin&variants=regular',
        filename: 'allura.ttf',
        zipEntry: 'allura-v21-latin-regular.ttf'
    },
    {
        id: 'alex-brush',
        name: 'Alex Brush',
        url: 'https://gwfh.mranftl.com/api/fonts/alex-brush?download=zip&subsets=latin&variants=regular',
        filename: 'alex_brush.ttf',
        zipEntry: 'alex-brush-v22-latin-regular.ttf'
    },
    {
        id: 'amatic-sc',
        name: 'Amatic SC',
        url: 'https://gwfh.mranftl.com/api/fonts/amatic-sc?download=zip&subsets=latin&variants=regular',
        filename: 'amatic_sc.ttf',
        zipEntry: 'amatic-sc-v26-latin-regular.ttf'
    },
    {
        id: 'caveat',
        name: 'Caveat',
        url: 'https://gwfh.mranftl.com/api/fonts/caveat?download=zip&subsets=latin&variants=regular',
        filename: 'caveat.ttf',
        zipEntry: 'caveat-v18-latin-regular.ttf'
    },
    {
        id: 'kaushan-script',
        name: 'Kaushan Script',
        url: 'https://gwfh.mranftl.com/api/fonts/kaushan-script?download=zip&subsets=latin&variants=regular',
        filename: 'kaushan_script.ttf',
        zipEntry: 'kaushan-script-v18-latin-regular.ttf'
    },
    {
        id: 'pacifico',
        name: 'Pacifico',
        url: 'https://gwfh.mranftl.com/api/fonts/pacifico?download=zip&subsets=latin&variants=regular',
        filename: 'pacifico.ttf',
        zipEntry: 'pacifico-v22-latin-regular.ttf'
    },
    {
        id: 'satisfy',
        name: 'Satisfy',
        url: 'https://gwfh.mranftl.com/api/fonts/satisfy?download=zip&subsets=latin&variants=regular',
        filename: 'satisfy.ttf',
        zipEntry: 'satisfy-v21-latin-regular.ttf'
    },
    {
        id: 'permanent-marker',
        name: 'Permanent Marker',
        url: 'https://gwfh.mranftl.com/api/fonts/permanent-marker?download=zip&subsets=latin&variants=regular',
        filename: 'permanent_marker.ttf',
        zipEntry: 'permanent-marker-v16-latin-regular.ttf'
    }
];

console.log('⚠️  This script requires the "adm-zip" package.');
console.log('Install it with: npm install adm-zip --save-dev\n');

// Try to import adm-zip
let AdmZip;
try {
    const module = await import('adm-zip');
    AdmZip = module.default;
} catch (err) {
    console.error('❌ adm-zip not found. Please install it first:');
    console.error('   npm install adm-zip --save-dev');
    process.exit(1);
}

function downloadFont(font) {
    return new Promise((resolve, reject) => {
        const filePath = path.join(fontsDir, font.filename);
        const tempZipPath = path.join(fontsDir, `${font.id}.zip`);

        // Skip if already exists and is valid
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (stats.size > 10000) {
                // Check if it's a valid TTF file (starts with 0x00010000)
                const buffer = Buffer.alloc(4);
                const fd = fs.openSync(filePath, 'r');
                fs.readSync(fd, buffer, 0, 4, 0);
                fs.closeSync(fd);

                if (buffer[0] === 0x00 && buffer[1] === 0x01 && buffer[2] === 0x00 && buffer[3] === 0x00) {
                    console.log(`✓ ${font.name} already exists (${Math.round(stats.size / 1024)}KB)`);
                    resolve();
                    return;
                }
            }
            // Delete invalid file
            fs.unlinkSync(filePath);
        }

        console.log(`Downloading ${font.name}...`);

        const file = fs.createWriteStream(tempZipPath);

        https.get(font.url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                https.get(response.headers.location, (redirectResponse) => {
                    redirectResponse.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        extractFont(font, tempZipPath, filePath, resolve, reject);
                    });
                }).on('error', reject);
            } else if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    extractFont(font, tempZipPath, filePath, resolve, reject);
                });
            } else {
                fs.unlink(tempZipPath, () => { });
                reject(new Error(`HTTP ${response.statusCode}`));
            }
        }).on('error', reject);
    });
}

function extractFont(font, zipPath, outputPath, resolve, reject) {
    try {
        const zip = new AdmZip(zipPath);
        const zipEntries = zip.getEntries();

        // Find the TTF file in the zip
        const ttfEntry = zipEntries.find(entry =>
            entry.entryName.endsWith('.ttf') &&
            (entry.entryName.includes('regular') || entry.entryName.includes('Regular'))
        );

        if (ttfEntry) {
            zip.extractEntryTo(ttfEntry, fontsDir, false, true);

            // Rename to our standard naming
            const extractedPath = path.join(fontsDir, ttfEntry.entryName);
            fs.renameSync(extractedPath, outputPath);

            // Clean up zip
            fs.unlinkSync(zipPath);

            const stats = fs.statSync(outputPath);
            console.log(`✓ Downloaded ${font.name} (${Math.round(stats.size / 1024)}KB)`);
            resolve();
        } else {
            fs.unlinkSync(zipPath);
            reject(new Error('TTF file not found in zip'));
        }
    } catch (err) {
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        reject(err);
    }
}

async function downloadAllFonts() {
    console.log('Starting font downloads...\n');

    for (const font of fonts) {
        try {
            await downloadFont(font);
        } catch (err) {
            console.error(`✗ Failed to download ${font.name}:`, err.message);
        }
    }

    console.log('\nVerifying downloads:');

    let allValid = true;
    for (const font of fonts) {
        const filePath = path.join(fontsDir, font.filename);
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            const buffer = Buffer.alloc(4);
            const fd = fs.openSync(filePath, 'r');
            fs.readSync(fd, buffer, 0, 4, 0);
            fs.closeSync(fd);

            const isValid = buffer[0] === 0x00 && buffer[1] === 0x01 && buffer[2] === 0x00 && buffer[3] === 0x00;

            if (isValid) {
                console.log(`✓ ${font.name}: ${Math.round(stats.size / 1024)}KB (Valid TTF)`);
            } else {
                console.log(`✗ ${font.name}: Invalid format (header: ${buffer.toString('hex')})`);
                allValid = false;
            }
        } else {
            console.log(`✗ ${font.name}: Missing`);
            allValid = false;
        }
    }

    if (allValid) {
        console.log('\n✅ All fonts downloaded and verified successfully!');
    } else {
        console.log('\n⚠️  Some fonts failed validation.');
    }
}

downloadAllFonts();
