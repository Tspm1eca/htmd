/**
 * Citation processing module.
 * Uses W3C Text Fragment format: #:~:text=
 */

const TEXT_FRAGMENT_PREFIX = '#:~:text=';

/**
 * Normalize citation payload to a safely encoded URI component.
 * - fully encoded: remains stable
 * - partially encoded: decoded then re-encoded
 * - plain text: encoded directly
 */
function encodeCitationPayload(text) {
    const value = String(text ?? '').trim();
    if (!value) {
        return '';
    }

    try {
        return encodeURIComponent(decodeURIComponent(value));
    } catch (error) {
        return encodeURIComponent(value);
    }
}

/**
 * Format consecutive citation links as: [1](...)｜[2](...)｜[3](...)
 * Preserves original trailing whitespace/newline to avoid merging lines.
 */
function formatConsecutiveCitationLinks(text) {
    const citationGroupRegex = /(?:\[\d+\]\(#:~:text=[^)\n]+\)\s*){2,}/g;
    const citationLinkRegex = /\[\d+\]\(#:~:text=[^)\n]+\)/g;

    return text.replace(citationGroupRegex, (group) => {
        const trailingWhitespaceMatch = group.match(/\s*$/);
        const trailingWhitespace = trailingWhitespaceMatch ? trailingWhitespaceMatch[0] : '';
        const coreGroup = trailingWhitespace ? group.slice(0, -trailingWhitespace.length) : group;

        const links = coreGroup.match(citationLinkRegex);
        if (!links || links.length < 2) {
            return group;
        }

        return `${links.join('｜')}${trailingWhitespace}`;
    });
}

/**
 * Process citation links in message text.
 * Supports:
 * 1) [n](#:~:text=...)
 */
export function processCitations(text) {
    if (!text) {
        return text;
    }

    // Ensure Text Fragment links are correctly encoded (boundary-aware)
    text = text.replace(
        /\[(\d+)\]\(#:~:text=(.+?)\)(?=\s|$|\[|[,.\u3002\]\)])/g,
        (match, num, fragmentText) => `[${num}](${TEXT_FRAGMENT_PREFIX}${encodeCitationPayload(fragmentText)})`
    );

    // Fallback for Text Fragment links at line end/sentence end
    text = text.replace(/\[(\d+)\]\(#:~:text=([^)\n]+)\)/g, (match, num, fragmentText) => {
        return `[${num}](${TEXT_FRAGMENT_PREFIX}${encodeCitationPayload(fragmentText)})`;
    });

    return formatConsecutiveCitationLinks(text);
}

/**
 * Decode citation payload.
 */
export function decodeCitation(encodedText) {
    try {
        return decodeURIComponent(encodedText);
    } catch (error) {
        console.error('Failed to decode citation text:', error);
        return encodedText;
    }
}

/**
 * Check whether an href is a citation link.
 */
export function isCitationLink(href) {
    if (!href) return false;
    return href.startsWith(TEXT_FRAGMENT_PREFIX);
}

/**
 * Extract citation text from href.
 */
export function extractCitationText(href) {
    if (!href) return null;

    if (href.startsWith(TEXT_FRAGMENT_PREFIX)) {
        const encodedText = href.substring(TEXT_FRAGMENT_PREFIX.length);
        return decodeCitation(encodedText);
    }

    return null;
}

/**
 * Get Text Fragment prefix.
 */
export function getTextFragmentPrefix() {
    return TEXT_FRAGMENT_PREFIX;
}
