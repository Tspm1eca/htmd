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
 * Normalize Text Fragment citation links with a parenthesis-depth scan.
 * This avoids cross-link captures when punctuation appears right after `)`.
 */
function normalizeTextFragmentLinks(text) {
    const citationStartRegex = /\[(\d+)\]\(#:~:text=/g;
    let normalizedText = '';
    let cursor = 0;
    let hasReplacement = false;

    while (true) {
        const startMatch = citationStartRegex.exec(text);
        if (!startMatch) {
            break;
        }

        const citationNumber = startMatch[1];
        const linkStartIndex = startMatch.index;
        const payloadStartIndex = citationStartRegex.lastIndex;

        let scanIndex = payloadStartIndex;
        let parenthesisDepth = 1;
        let hasClosingParenthesis = false;

        while (scanIndex < text.length) {
            const currentChar = text[scanIndex];

            if (currentChar === '\n') {
                break;
            }

            if (currentChar === '(') {
                parenthesisDepth += 1;
            } else if (currentChar === ')') {
                parenthesisDepth -= 1;
                if (parenthesisDepth === 0) {
                    hasClosingParenthesis = true;
                    break;
                }
            }

            scanIndex += 1;
        }

        if (!hasClosingParenthesis) {
            continue;
        }

        const fragmentText = text.slice(payloadStartIndex, scanIndex);
        const encodedFragmentText = encodeCitationPayload(fragmentText);

        normalizedText += text.slice(cursor, linkStartIndex);
        normalizedText += `[${citationNumber}](${TEXT_FRAGMENT_PREFIX}${encodedFragmentText})`;

        cursor = scanIndex + 1;
        citationStartRegex.lastIndex = cursor;
        hasReplacement = true;
    }

    if (!hasReplacement) {
        return text;
    }

    return normalizedText + text.slice(cursor);
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

    text = normalizeTextFragmentLinks(text);

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
