/**
 * Device information parser utility
 * Parses user agent strings to extract browser, OS, and device information
 */

/**
 * Parse browser information from user agent string
 * @param {string} userAgent - The user agent string
 * @returns {object} Browser name and version
 */
const parseBrowser = (userAgent) => {
    if (!userAgent) {
        return { name: 'Unknown', version: '' };
    }

    const ua = userAgent.toLowerCase();

    // Edge (Chromium-based)
    if (ua.includes('edg/')) {
        const match = userAgent.match(/edg\/([\d.]+)/i);
        return { name: 'Edge', version: match ? match[1] : '' };
    }

    // Chrome
    if (ua.includes('chrome/') && !ua.includes('edg/')) {
        const match = userAgent.match(/chrome\/([\d.]+)/i);
        return { name: 'Chrome', version: match ? match[1] : '' };
    }

    // Firefox
    if (ua.includes('firefox/')) {
        const match = userAgent.match(/firefox\/([\d.]+)/i);
        return { name: 'Firefox', version: match ? match[1] : '' };
    }

    // Safari (must check after Chrome as Chrome UA includes Safari)
    if (ua.includes('safari/') && !ua.includes('chrome/')) {
        const match = userAgent.match(/version\/([\d.]+)/i);
        return { name: 'Safari', version: match ? match[1] : '' };
    }

    // Opera
    if (ua.includes('opr/') || ua.includes('opera/')) {
        const match = userAgent.match(/(?:opr|opera)\/([\d.]+)/i);
        return { name: 'Opera', version: match ? match[1] : '' };
    }

    // Internet Explorer
    if (ua.includes('trident/') || ua.includes('msie')) {
        const match = userAgent.match(/(?:msie |rv:)([\d.]+)/i);
        return { name: 'Internet Explorer', version: match ? match[1] : '' };
    }

    return { name: 'Unknown', version: '' };
};

/**
 * Parse operating system from user agent string
 * @param {string} userAgent - The user agent string
 * @returns {string} Operating system name
 */
const parseOS = (userAgent) => {
    if (!userAgent) {
        return 'Unknown';
    }

    const ua = userAgent.toLowerCase();

    // Windows
    if (ua.includes('windows nt 10.0')) return 'Windows 10/11';
    if (ua.includes('windows nt 6.3')) return 'Windows 8.1';
    if (ua.includes('windows nt 6.2')) return 'Windows 8';
    if (ua.includes('windows nt 6.1')) return 'Windows 7';
    if (ua.includes('windows')) return 'Windows';

    // macOS
    if (ua.includes('mac os x')) {
        const match = userAgent.match(/mac os x ([\d_]+)/i);
        if (match) {
            const version = match[1].replace(/_/g, '.');
            return `macOS ${version}`;
        }
        return 'macOS';
    }

    // iOS
    if (ua.includes('iphone')) return 'iOS (iPhone)';
    if (ua.includes('ipad')) return 'iOS (iPad)';
    if (ua.includes('ipod')) return 'iOS (iPod)';

    // Android
    if (ua.includes('android')) {
        const match = userAgent.match(/android ([\d.]+)/i);
        if (match) {
            return `Android ${match[1]}`;
        }
        return 'Android';
    }

    // Linux
    if (ua.includes('linux')) return 'Linux';

    // Chrome OS
    if (ua.includes('cros')) return 'Chrome OS';

    return 'Unknown';
};

/**
 * Generate human-readable device name
 * @param {string} userAgent - The user agent string
 * @returns {string} Human-readable device name (e.g., "Chrome on Windows")
 */
export const parseDeviceName = (userAgent) => {
    if (!userAgent || typeof userAgent !== 'string') {
        return 'Unknown Device';
    }

    const browser = parseBrowser(userAgent);
    const os = parseOS(userAgent);

    // Format browser name with version (if available)
    const browserName = browser.version
        ? `${browser.name} ${browser.version.split('.')[0]}`
        : browser.name;

    return `${browserName} on ${os}`;
};

/**
 * Parse complete device information from user agent string
 * @param {string} userAgent - The user agent string
 * @returns {object} Complete device information
 */
export const parseDeviceInfo = (userAgent) => {
    if (!userAgent || typeof userAgent !== 'string') {
        return {
            browser: { name: 'Unknown', version: '' },
            os: 'Unknown',
            deviceName: 'Unknown Device'
        };
    }

    const browser = parseBrowser(userAgent);
    const os = parseOS(userAgent);
    const deviceName = parseDeviceName(userAgent);

    return {
        browser,
        os,
        deviceName
    };
};

/**
 * Main export for backward compatibility and convenience
 */
export default {
    parseDeviceName,
    parseDeviceInfo
};
