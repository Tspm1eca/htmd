/**
 * 引用處理模組
 * 處理 cite: 連結的編碼和渲染
 */

/**
 * 處理文本中的 cite: 連結
 * 自動編碼空格和特殊字符，確保 Markdown 解析器正確識別連結
 * @param {string} text - 要處理的文本
 * @returns {string} 處理後的文本
 */
export function processCitations(text) {
    // 預處理 cite: 連結，自動編碼空格和特殊字符
    // 這樣可以確保 Markdown 解析器正確識別連結
    // 支援任意文字（包含 | 等特殊字符），匹配到最後一個 ) 為止
    text = text.replace(/\[(\d+)\]\(cite:(.+?)\)(?=\s|$|[，。,.\]\)])/g, (match, num, citeText) => {
        const encodedText = encodeURIComponent(citeText.trim());
        return `[${num}](cite:${encodedText})`;
    });

    // 備用處理：處理行尾或句尾的 cite 連結
    text = text.replace(/\[(\d+)\]\(cite:([^)\n]+)\)/g, (match, num, citeText) => {
        // 檢查是否已經編碼過（避免重複編碼）
        if (citeText.includes('%')) {
            return match;
        }
        const encodedText = encodeURIComponent(citeText.trim());
        return `[${num}](cite:${encodedText})`;
    });

    return text;
}

/**
 * 解碼 cite: 連結中的文本
 * @param {string} encodedText - 編碼後的文本
 * @returns {string} 解碼後的文本
 */
export function decodeCitation(encodedText) {
    try {
        return decodeURIComponent(encodedText);
    } catch (e) {
        console.error('解碼引用文本失敗:', e);
        return encodedText;
    }
}

/**
 * 從 href 中提取引用文本
 * @param {string} href - 連結的 href 屬性值
 * @returns {string|null} 引用文本，如果不是 cite: 連結則返回 null
 */
export function extractCitationText(href) {
    if (!href || !href.startsWith('cite:')) {
        return null;
    }
    const encodedText = href.substring(5); // 移除 'cite:' 前綴
    return decodeCitation(encodedText);
}