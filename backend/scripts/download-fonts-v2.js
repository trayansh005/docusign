/**
 * Script to download Google Fonts for signature rendering
 * Uses Google Fonts API to get direct download links
 * Run with: node backend/scripts/download-fonts-v2.js
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

// Google Fonts API URLs (these are more reliable)
const fonts = [
    {
        id: 'dancing-script',
        name: 'Dancing Script',
        // Using fonts.gstatic.com which is the CDN for Google Fonts
        url: 'https://fonts.gstatic.com/s/dancingscript/v24/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSo3Sup8.ttf',
        filename: 'dancing_script.ttf'
    },
    {
        id: 'great-vibes',
        name: 'Great Vibes',
        url: 'https://fonts.gstatic.com/s/greatvibes/v19/RWmMoKWR9v4ksMfaWd_JN-XCg6UKDXlq.ttf',
        filename: 'great_vibes.ttf'
    },
    {
        id: 'allura',
        name: 'Allura',
        url: 'https://fonts.gstatic.com/s/allura/v21/9oRPNYsQpS4zjuAPjAIXPtrrGA.ttf',
        filename: 'allura.ttf'
    },
    {
        id: 'alex-brush',
        name: 'Alex Brush',
        url: 'https://fonts.gstatic.com/s/alexbrush/v22/SZc83FzrJKuqFbwMKk6EtUL57DtOmCc.ttf',
        filename: 'alex_brush.ttf'
    },
    {
        id: 'amatic-sc',
        name: 'Amatic SC',
        url: 'https://fonts.gstatic.com/s/amaticsc/v26/TUZyzwprpvBS1izr_vO0De6ecZQf1A.ttf',
        filename: 'amatic_sc.ttf'
    },
    {
        id: 'caveat',
        name: 'Caveat',
        url: 'https://fonts.gstatic.com/s/caveat/v18/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9eIipYQ.ttf',
        filename: 'caveat.ttf'
    },
    {
        id: 'kaushan-script',
        name: 'Kaushan Script',
        url: 'https://fonts.gstatic.com/s/kaushanscript/v18/vm8vdRfvXFLG3OLnsO15WYS5DF7_ytN3M48a.ttf',
        filename: 'kaushan_script.ttf'
    },
    {
        id: 'pacifico',
        name: 'Pacifico',
        url: 'https://fonts.gstatic.com/s/pacifico/v22/FwZY7-Qmy14u9lezJ96A4sijpFu_.ttf',
        filename: 'pacifico.ttf'
    },
    {
        id: 'satisfy',
        name: 'Satisfy',
        url: 'https://fonts.gstatic.com/s/satisfy/v21/rP2Hp2yn6lkG50LoOZSCHBeHFl0.ttf',
        filename: 'satisfy.ttf'
    },
    {
        id: 'permanent-marker',
        name: 'Permanent Marker',
        url: 'https://fonts.gstatic.com/s/permanentmarker/v16/Fh4uPib9Iyv2ucM6pGQMWimMp004HaqIfrT5nlk.ttf',
        filename: 'permanent_marker.ttf'
    }
];

function downloadFont(font) {
    return new Promise((resolve, reject) => {
        const filePath = path.join(fontsDir, font.filename);

        // Skip if already exists and is larger than 1KB (valid font file)
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (stats.size > 1024) {
                console.log(`✓ ${font.name} already exists (${Math.round(stats.size / 1024)}KB)`);
                resolve();
                return;
            } else {
                // Delete invalid file
                fs.unlinkSync(filePath);
            }
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
                        const stats = fs.statSync(filePath);
                        console.log(`✓ Downloaded ${font.name} (${Math.round(stats.size / 1024)}KB)`);
                        resolve();
                    });
                }).on('error', (err) => {
                    fs.unlink(filePath, () => { });
                    reject(err);
                });
            } else if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    const stats = fs.statSync(filePath);
                    console.log(`✓ Downloaded ${font.name} (${Math.round(stats.size / 1024)}KB)`);
                    resolve();
                });
            } else {
                fs.unlink(filePath, () => { });
                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
            }
        }).on('error', (err) => {
            fs.unlink(filePath, () => { });
            reject(err);
        });
    });
}

async function downloadAllFonts() {
    console.log('Starting font downloads from Google Fonts CDN...\n');

    for (const font of fonts) {
        try {
            await downloadFont(font);
        } catch (err) {
            console.error(`✗ Failed to download ${font.name}:`, err.message);
        }
    }

    console.log('\nFont download complete!');
    console.log('\nVerifying downloads:');

    // Verify all fonts
    let allValid = true;
    for (const font of fonts) {
        const filePath = path.join(fontsDir, font.filename);
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (stats.size > 1024) {
                console.log(`✓ ${font.name}: ${Math.round(stats.size / 1024)}KB`);
            } else {
                console.log(`✗ ${font.name}: Invalid (${stats.size} bytes)`);
                allValid = false;
            }
        } else {
            console.log(`✗ ${font.name}: Missing`);
            allValid = false;
        }
    }

    if (allValid) {
        console.log('\n✅ All fonts downloaded successfully!');
    } else {
        console.log('\n⚠️  Some fonts failed to download. Please try again.');
    }
}

downloadAllFonts();
