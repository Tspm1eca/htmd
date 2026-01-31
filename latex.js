/**
 * LaTeX 數學公式處理模組
 * 處理數學公式的提取、轉換和渲染
 */

import { processCitations } from './citation.js';
import {
    extractCodeBlocks,
    extractInlineCode,
    extractLinks,
    restoreCodeBlocks,
    restoreInlineCode,
    restoreLinks,
    processBoldFormatting,
    processThinkTags,
    renderMarkdown
} from './markdown.js';

/**
 * 檢測文本是否可能包含數學公式
 * @param {string} text - 要檢測的文本
 * @returns {boolean} 是否可能包含數學公式
 */
export function textMayContainMath(text) {
    if (!text) return false;
    const str = String(text);
    if (/(\\\(|\\\[|\$\$|\\begin\{|\\boxed\{)/.test(str)) return true;
    // Detect inline $...$ (paired unescaped $) so MathJax can typeset it.
    const unescapedDollars = str.match(/(^|[^\\])\$/g);
    return (unescapedDollars?.length ?? 0) >= 2;
}

/**
 * \mathds 字符映射表
 */
const mathdsMap = {
    'A': '𝔸', 'B': '𝔹', 'C': 'ℂ', 'D': '𝔻', 'E': '𝔼',
    'F': '𝔽', 'G': '𝔾', 'H': 'ℍ', 'I': '𝕀', 'J': '𝕁',
    'K': '𝕂', 'L': '𝕃', 'M': '𝕄', 'N': 'ℕ', 'O': '𝕆',
    'P': 'ℙ', 'Q': 'ℚ', 'R': 'ℝ', 'S': '𝕊', 'T': '𝕋',
    'U': '𝕌', 'V': '𝕍', 'W': '𝕎', 'X': '𝕏', 'Y': '𝕐',
    'Z': 'ℤ',
    '0': '𝟘', '1': '𝟙', '2': '𝟚', '3': '𝟛', '4': '𝟜',
    '5': '𝟝', '6': '𝟞', '7': '𝟟', '8': '𝟠', '9': '𝟡'
};

/**
 * 處理 LaTeX 數學環境
 * @param {string} text - 要處理的文本
 * @returns {string} 處理後的文本
 */
function processMathEnvironments(text) {
    // 处理 \mathds 命令
    text = text.replace(/\\mathds\{([A-Z0-9])\}/g, (match, char) => {
        return mathdsMap[char] || match;
    });

    // 替换行首的 \begin{align*} 为 \[
    text = text.replace(/^\s*\\begin\{align\*\}/gm, '\\[\n\\begin{align*}');
    // 替换行尾的 \end{align*} 为 \]
    text = text.replace(/\\end\{align\*\}\s*$/gm, '\\end{align*}\n\\]');

    text = text.replace(/\\label{eq:.*?}/gm, '');

    // 替换行首的 \begin{equation} 为 \[
    text = text.replace(/^\s*\\begin\{equation\}/gm, '\\[\n\\begin{equation}');
    // 替换行尾的 \end{equation} 为 \]
    text = text.replace(/\\end\{equation\}\s*$/gm, '\\end{equation}\n\\]');

    // 处理 \boxed 命令，将其包装在 \[ \] 中
    text = text.replace(/(\\\[\s*)?\$*\\boxed\{([\s\S]+)\}\$*(\s*\\\])?/g, '\\[\\boxed{$2}\\]');

    // 处理 \textsc 命令
    text = text.replace(/\\textsc\{([^}]+)\}/g, (match, content) => {
        return content.toUpperCase();
    });

    return text;
}

/**
 * 提取並處理數學公式
 * @param {string} text - 要處理的文本
 * @param {Array} mathExpressions - 存儲數學公式的數組
 * @returns {string} 替換後的文本
 */
function extractMathExpressions(text, mathExpressions) {
    let mathIndex = mathExpressions.length;

    // 临时替换数学公式（支持 \(..\)、\[..\]、$$..$$ 以及单行内联 $..$）
    return text.replace(/(\\\\\([^]+?\\\\\))|(\\\([^]+?\\\))|(\\\[[\s\S]+?\\\])|(\$\$[\s\S]+?\$\$)|(\$(?!\$)[^\n]*?\$)/g, (match) => {
        // 处理除号
        match = match.replace(/\\div\b/g, ' ÷ ');
        match = match.replace(/\\\[\s*(.+?)\s*\\+\]/g, '\\[ $1 \\]');
        match = match.replace(/\\\(\s*(.+?)\s*\\）/g, '\\( $1 \\)');
        match = match.replace(/\\\(\s*(.+?)\s*\\，/g, '\\( $1 \\)，');
        match = match.replace(/</g, '&lt;');
        match = match.replace(/>/g, '&gt;');
        match = match.replace(/%\s/g, '');

        // 处理 \bm 命令，将其替换为 \boldsymbol 粗体向量
        match = match.replace(/\\bm\{([^{}]+)\}/g, '\\boldsymbol{$1}');
        match = match.replace(/\\bm\s*(\\[A-Za-z]+|[A-Za-z0-9])/g, '\\boldsymbol{$1}');

        // 处理 \coloneqq 命令（避免依赖额外 TeX 包）
        match = match.replace(/\\coloneqq\b/g, '\\mathrel{:=}');

        // 如果是普通括号形式公式，转换为 \(...\) 形式
        if (match.startsWith('(') && match.endsWith(')') && !match.startsWith('\\(')) {
            console.log('警告：请使用 \\(...\\) 来表示行内公式');
        }

        // 为行间公式添加容器
        if (match.startsWith('\\[') || match.startsWith('$$')) {
            match = `<div class="math-display-container">${match}</div>`;
        }

        const placeholder = `%%MATH_EXPRESSION_${mathIndex}%%`;
        mathExpressions.push(match);
        mathIndex++;
        return placeholder;
    });
}

/**
 * 恢復數學公式
 * @param {string} html - 要處理的 HTML
 * @param {Array} mathExpressions - 存儲數學公式的數組
 * @returns {string} 恢復後的 HTML
 */
function restoreMathExpressions(html, mathExpressions) {
    return html.replace(/%%MATH_EXPRESSION_(\d+)%%/g, (_, index) => {
        return mathExpressions[index];
    });
}

/**
 * 處理數學公式和 Markdown 的主函數
 * @param {string} text - 要處理的文本
 * @returns {string} 處理後的 HTML
 */
export function processMathAndMarkdown(text) {
    const mathExpressions = [];
    const imageExpressions = [];
    const linkExpressions = [];
    const codeBlockExpressions = [];
    const inlineCodeExpressions = [];
    let imageIndex = 0;

    // 預處理，提取代碼塊（防止代碼塊內容被其他處理邏輯修改）
    text = extractCodeBlocks(text, codeBlockExpressions);

    // 預處理，提取行內代碼（防止行內代碼內容被其他處理邏輯修改）
    text = extractInlineCode(text, inlineCodeExpressions);

    // 预处理，提取图片标签
    text = text.replace(/<span class="image-tag".*?<\/span>/g, (match) => {
        const placeholder = `%%IMAGE_EXPRESSION_${imageIndex}%%`;
        imageExpressions.push(match);
        imageIndex++;
        return placeholder;
    });

    // 预处理，提取 Markdown 連結（防止連結中的 $ 符號被誤判為數學公式）
    text = extractLinks(text, linkExpressions);

    // 處理轉義的方括號
    text = text.replace(/\\\[([a-zA-Z\d]+)\]/g, '[$1]');

    // 處理 LaTeX 數學環境
    text = processMathEnvironments(text);

    // 移除分隔線
    text = text.replace(/^---\n$/gm, '');

    // 處理 think 標籤
    text = processThinkTags(text);

    // 移除换行的百分号
    text = text.replace(/%\n\s*/g, '');
    text = text.replace(/（\\\((.+?)\\）/g, '（\\($1\\)）');

    // 提取數學公式
    text = extractMathExpressions(text, mathExpressions);

    // 處理粗體格式
    text = processBoldFormatting(text);

    // 處理 cite: 連結
    text = processCitations(text);

    // 恢复 Markdown 連結（在 marked.parse 之前恢復，讓 marked 正確解析連結）
    text = restoreLinks(text, linkExpressions);

    // 恢復行內代碼（在 marked.parse 之前恢復）
    text = restoreInlineCode(text, inlineCodeExpressions);

    // 恢復代碼塊（在 marked.parse 之前恢復）
    text = restoreCodeBlocks(text, codeBlockExpressions);

    // 渲染 Markdown
    let html = renderMarkdown(text);

    // 恢复数学公式
    html = restoreMathExpressions(html, mathExpressions);

    // 恢复图片
    html = html.replace(/%%IMAGE_EXPRESSION_(\d+)%%/g, (_, index) => {
        return imageExpressions[index];
    });

    // 移除数学公式容器外的 p 标签
    html = html.replace(/<p>\s*(<div class="math-display-container">[\s\S]*?<\/div>)\s*<\/p>/g, '$1');

    return html;
}

/**
 * 渲染元素中的數學公式
 * @param {HTMLElement} element - 要渲染的元素
 * @returns {Promise} 渲染完成的 Promise
 */
export function renderMathInElement(element) {
    return new Promise((resolve, reject) => {
        const checkMathJax = () => {
            if (window.MathJax && window.MathJax.typesetPromise) {
                MathJax.typesetPromise([element])
                    .then(() => {
                        resolve();
                    })
                    .catch((err) => {
                        console.error('MathJax 渲染错误:', err);
                        console.error('错误堆栈:', err.stack);
                        reject(err);
                    });
            } else {
                console.log('等待 MathJax 加载...');
                setTimeout(checkMathJax, 100); // 每100ms检查一次
            }
        };
        checkMathJax();
    });
}
