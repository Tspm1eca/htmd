/**
 * YouTube timestamp processing module.
 * Converts [H:MM:SS] / [MM:SS] patterns to clickable seek links.
 */

const TIMESTAMP_LINK_PREFIX = 'yt-seek:';

/**
 * Parse a timestamp string (e.g. "1:23:45", "12:34", "0:15") to total seconds.
 */
function parseTimestamp(ts) {
    const parts = ts.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    return 0;
}

/**
 * Convert [H:MM:SS] / [MM:SS] timestamp markers to markdown links.
 * e.g. [1:23:45] → [1:23:45](yt-seek:5025)
 */
export function processTimestamps(text) {
    if (!text) return text;
    return text.replace(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g, (match, ts) => {
        const seconds = parseTimestamp(ts);
        return `[${ts}](${TIMESTAMP_LINK_PREFIX}${seconds})`;
    });
}

/**
 * Check whether an href is a timestamp seek link.
 */
export function isTimestampLink(href) {
    if (!href) return false;
    return href.startsWith(TIMESTAMP_LINK_PREFIX);
}

/**
 * Extract seek seconds from a timestamp link href.
 */
export function extractSeekSeconds(href) {
    if (!href || !href.startsWith(TIMESTAMP_LINK_PREFIX)) return null;
    const seconds = parseInt(href.substring(TIMESTAMP_LINK_PREFIX.length), 10);
    return Number.isFinite(seconds) ? seconds : null;
}
