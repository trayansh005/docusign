/**
 * Script to download Google Fonts for signature rendering
 * Run with: node backend/scripts/download-fonts.js
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

// Google Fonts to download (using direct CDN links for TTF files)
const fonts = [
    {
        id: 'dancing-script',
        name: 'Dancing Script',
        url: 'https://github.com/google/fonts/raw/main/ofl/dancingscript/static/DancingScript-Regular.ttf',
        filename: 'dancing_script.ttf'
    },
    {
        id: 'great-vibes',
        name: 'Great Vibes',
        url: 'https://github.com/google/fonts/raw/main/ofl/greatvibes/GreatVibes-Regular.ttf',
        filename: 'great_vibes.ttf'
    },
    {
        id: 'allura',
        name: 'Allura',
        url: 'https://github.com/google/fonts/raw/main/ofl/allura/Allura-Regular.ttf',
        filename: 'allura.ttf'
    },
    {
        id: 'alex-brush',
        name: 'Alex Brush',
        url: 'https://github.com/google/fonts/raw/main/ofl/alexbrush/AlexBrush-Regular.ttf',
        filename: 'alex_brush.ttf'
    },
    {
        id: 'amatic-sc',
        name: 'Amatic SC',
        url: 'https://github.com/google/fonts/raw/main/ofl/amaticsc/AmaticSC-Regular.ttf',
        filename: 'amatic_sc.ttf'
    },
    {
        id: 'caveat',
        name: 'Caveat',
        url: 'https://github.com/google/fonts/raw/main/ofl/caveat/static/Caveat-Regular.ttf',
        filename: 'caveat.ttf'
    },
    {
        id: 'kaushan-script',
        name: 'Kaushan Script',
        url: 'https://github.com/google/fonts/raw/main/ofl/kaushanscript/KaushanScript-Regular.ttf',
        filename: 'kaushan_script.ttf'
    },
    {
        id: 'pacifico',
        name: 'Pacifico',
        url: 'https://github.com/google/fonts/raw/main/ofl/pacifico/Pacifico-Regular.ttf',
        filename: 'pacifico.ttf'
    },
    {
        id: 'satisfy',
        name: 'Satisfy',
        url: 'https://github.com/google/fonts/raw/main/ofl/satisfy/Satisfy-Regular.ttf',
        filename: 'satisfy.ttf'
    },
    {
        id: 'permanent-marker',
        name: 'Permanent Marker',
        url: 'https://github.com/google/fonts/raw/main/ofl/permanentmarker/PermanentMarker-Regular.ttf',
        filename: 'permanent_marker.ttf'
    }
];

function downloadFont(font) {
    return new Promise((resolve, reject) => {
        const filePath = path.join(fontsDir, font.filename);

        // Skip if already exists
        if (fs.existsSync(filePath)) {
            console.log(`✓ ${font.name} already exists`);
            resolve();
            return;
        }

        console.log(`Downloading ${font.name}...`);

        const file = fs.createWriteStream(filePath);

        https.get(font.url, (response) => {
            // Follow redirects
            if (response.statusCode === 301 || response.statusCode === 302) {
                https.get(response.headers.location, (redirectResponse) => {
                    redirectResponse.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        console.log(`✓ Downloaded ${font.name}`);
                        resolve();
                    });
                }).on('error', (err) => {
                    fs.unlink(filePath, () => { });
                    reject(err);
                });
            } else {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    console.log(`✓ Downloaded ${font.name}`);
                    resolve();
                });
            }
        }).on('error', (err) => {
            fs.unlink(filePath, () => { });
            reject(err);
        });
    });
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

    console.log('\nFont download complete!');
}

downloadAllFonts();
