/**
 * Markdown 處理模組
 * 處理 Markdown 渲染和代碼高亮
 */

let markedConfigured = false;
let mermaidRenderScheduled = false;

/**
 * 調度 Mermaid 圖表渲染
 */
function scheduleMermaidRender() {
    if (mermaidRenderScheduled) return;
    mermaidRenderScheduled = true;
    const run = () => {
        mermaidRenderScheduled = false;
        if (window.renderMermaidDiagrams) {
            window.renderMermaidDiagrams();
        }
    };
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(run, { timeout: 300 });
    } else {
        setTimeout(run, 0);
    }
}

/**
 * 配置 marked 解析器（只初始化一次）
 */
export function configureMarked() {
    if (markedConfigured) return;

    marked.setOptions({
        breaks: true,
        gfm: true,
        sanitize: false,
        highlight: function(code, lang) {
            if (lang === 'mermaid') {
                return `<div class="mermaid">${code}</div>`;
            }
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return hljs.highlight(code, { language: lang }).value;
                } catch (err) {
                    console.error('代码高亮错误:', err);
                }
            }
            return hljs.highlightAuto(code).value;
        },
        renderer: Object.assign(new marked.Renderer(), {
            code(code, language) {
                // 检查是否包含数学表达式占位符
                if (code.includes('%%MATH_EXPRESSION_')) {
                    return code;  // 如果包含数学表达式，直接返回原文本
                }
                if (language === 'mermaid') {
                    return `<div class="mermaid">${code}</div>`;
                }
                const validLanguage = language && hljs.getLanguage(language) ? language : '';
                const highlighted = this.options.highlight(code, validLanguage);
                return `<pre data-language="${validLanguage || 'plaintext'}"><code>${highlighted}</code></pre>`;
            },
            listitem(text) {
                // 保持列表项的原始格式
                return `<li>${text}</li>\n`;
            }
        })
    });
    markedConfigured = true;
}

/**
 * 處理粗體格式的空格問題
 * @param {string} text - 要處理的文本
 * @returns {string} 處理後的文本
 */
export function processBoldFormatting(text) {
    text = text.replace(/:\s\*\*/g, ':**');
    text = text.replace(/\*\*([^*]+?)\*\*[^\S\n]+/g, '@@$1@@#');
    text = text.replace(/\*\*(?=.*[^\S\n].*\*\*)([^*]+?)\*\*(?!\s)/g, '#%$1%#@');
    text = text.replace(/\*\*(?=.*：.*\*\*)([^*]+?)\*\*(?!\s)/g, '**$1** ');
    text = text.replace(/\@\@(.+?)\@\@#/g, '**$1** ');
    text = text.replace(/\#\%(.+?)\%\#\@/g, '**$1** ');
    text = text.replace(/ *\*\*([^\s]+?)\*\*(?!\s)/g, ' **$1** ');
    text = text.replace(/(\*\*.+?\*\*)\s：/g, '$1：');
    text = text.replace(/(\*\*.+?\*\*)\s，/g, '$1，');
    text = text.replace(/(\*\*.+?\*\*)\s,/g, '$1,');
    text = text.replace(/(\*\*.+?\*\*)\s\./g, '$1.');
    text = text.replace(/(\*\*.+?\*\*)\s。/g, '$1。');
    return text;
}

/**
 * 處理 think 標籤，將其轉換為引用格式
 * @param {string} text - 要處理的文本
 * @returns {string} 處理後的文本
 */
export function processThinkTags(text) {
    // 首先处理完整的 <think>...</think> 标签
    text = text.replace(/<think>([\s\S]*?)<\/think>/g, (match, content) => {
        // 处理多行文本，为每一行添加引用符号
        return content.trim().split('\n').map(line => `> ${line.trim()}`).join('\n');
    });

    // 然后处理只有开始标签的情况
    text = text.replace(/<think>\n?([\s\S]*?)(?=<\/think>|$)/g, (match, content) => {
        if (!match.includes('</think>')) {
            // 如果没有结束标签，将所有后续内容都转换为引用格式
            return content.trim().split('\n').map(line => `> ${line.trim()}`).join('\n');
        }
        return match; // 如果有结束标签，保持原样（因为已经在上一步处理过了）
    });

    return text;
}

/**
 * 渲染 Markdown 文本為 HTML
 * @param {string} text - 要渲染的 Markdown 文本
 * @returns {string} 渲染後的 HTML
 */
export function renderMarkdown(text) {
    // 確保 marked 已配置
    configureMarked();

    // 渲染 Markdown
    let html = marked.parse(text);

    // 仅在确实包含 Mermaid 图表时再调度渲染，避免每次消息都触发
    if (/class=["']mermaid["']/.test(html)) {
        scheduleMermaidRender();
    }

    return html;
}

/**
 * 提取代碼塊（防止代碼塊內容被其他處理邏輯修改）
 * @param {string} text - 要處理的文本
 * @param {Array} codeBlockExpressions - 存儲代碼塊的數組
 * @returns {string} 替換後的文本
 */
export function extractCodeBlocks(text, codeBlockExpressions) {
    let codeBlockIndex = codeBlockExpressions.length;
    return text.replace(/```[\s\S]*?```/g, (match) => {
        const placeholder = `%%CODE_BLOCK_${codeBlockIndex}%%`;
        codeBlockExpressions.push(match);
        codeBlockIndex++;
        return placeholder;
    });
}

/**
 * 提取行內代碼（防止行內代碼內容被其他處理邏輯修改）
 * @param {string} text - 要處理的文本
 * @param {Array} inlineCodeExpressions - 存儲行內代碼的數組
 * @returns {string} 替換後的文本
 */
export function extractInlineCode(text, inlineCodeExpressions) {
    let inlineCodeIndex = inlineCodeExpressions.length;
    return text.replace(/`[^`\n]+`/g, (match) => {
        const placeholder = `%%INLINE_CODE_${inlineCodeIndex}%%`;
        inlineCodeExpressions.push(match);
        inlineCodeIndex++;
        return placeholder;
    });
}

/**
 * 恢復代碼塊
 * @param {string} text - 要處理的文本
 * @param {Array} codeBlockExpressions - 存儲代碼塊的數組
 * @returns {string} 恢復後的文本
 */
export function restoreCodeBlocks(text, codeBlockExpressions) {
    return text.replace(/%%CODE_BLOCK_(\d+)%%/g, (_, index) => {
        return codeBlockExpressions[index];
    });
}

/**
 * 恢復行內代碼
 * @param {string} text - 要處理的文本
 * @param {Array} inlineCodeExpressions - 存儲行內代碼的數組
 * @returns {string} 恢復後的文本
 */
export function restoreInlineCode(text, inlineCodeExpressions) {
    return text.replace(/%%INLINE_CODE_(\d+)%%/g, (_, index) => {
        return inlineCodeExpressions[index];
    });
}

/**
 * 提取 Markdown 連結（防止連結中的 $ 符號被誤判為數學公式）
 * 注意：排除 cite: 連結，讓它們在後續的 cite 處理邏輯中正常處理
 * @param {string} text - 要處理的文本
 * @param {Array} linkExpressions - 存儲連結的數組
 * @returns {string} 替換後的文本
 */
export function extractLinks(text, linkExpressions) {
    let linkIndex = linkExpressions.length;
    return text.replace(/\[([^\]]+)\]\((?!cite:)([^)]+)\)/g, (match) => {
        const placeholder = `%%LINK_EXPRESSION_${linkIndex}%%`;
        linkExpressions.push(match);
        linkIndex++;
        return placeholder;
    });
}

/**
 * 恢復 Markdown 連結
 * @param {string} text - 要處理的文本
 * @param {Array} linkExpressions - 存儲連結的數組
 * @returns {string} 恢復後的文本
 */
export function restoreLinks(text, linkExpressions) {
    return text.replace(/%%LINK_EXPRESSION_(\d+)%%/g, (_, index) => {
        return linkExpressions[index];
    });
}