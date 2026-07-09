/**
 * Sa-Token 单篇文档清洗脚本（独立工具）
 * ─────────────────────────────────────────────────────────────────
 * 与 generate-llms.js 解耦：专用于把单篇 docsify markdown 清洗为
 * 干净、AI 友好的纯 markdown，可独立部署为「清洗版单篇」（docs/），
 * 让 llms.txt 索引链接指向干净内容（而非原始带噪声的 sa-token-doc/*.md）。
 * 同时可被 generate-llms.js 以 require 方式调用，批量生成 docs/ 下的清洗单篇。
 *
 * 与聚合脚本的核心差异：
 *   - 聚合版(llms-full.txt) 会注入 ### path: title 锚点，故内部标题需降级；
 *   - 单篇版是独立文档，保留原始标题层级（# 即文档主标题），不降级。
 *
 * 支持的 docsify 语法：
 *   - ${sa.top.version} 版本占位符 → 具体版本号
 *   - <green>/<red>/<font color> 着色标签 → **加粗**
 *   - <br> / <button> / <object> / 徽章 <img> / 带 class 的 <img> 等 HTML 噪声
 *   - <!-- !> ... --> / <!-- ?> ... --> 提示框 → blockquote
 *   - > [!TIP| style:callout] GitHub 风 alert → 保留 blockquote 内容
 *   - <!---- tabs:start ----> / <!-- tab:名称 --> 选项卡 → 平铺展开为 **【名称】**
 *   - [text](../x.md#anchor ':include') 文件嵌入 → 递归内联被嵌文件（防环）
 *   - 未闭合代码块自动补全（保护代码内容不被正文清洗误伤）
 *
 * 用法：
 *   node clean-doc.js <doc相对路径> [--out <输出文件>]
 *   例：node clean-doc.js sso/sso-type1.md --out /tmp/sso-type1.clean.md
 *   doc相对路径：相对 sa-token-doc 目录，如 sso/sso-type1.md
 *   不带 --out 时结果打印到 stdout。
 */

const fs = require('fs');
const path = require('path');

const DOC_DIR = path.resolve(__dirname, '..', '..', 'sa-token-doc');

// ── 读取 Sa-Token 顶部版本号（同 generate-llms.js）──
function readTopVersion() {
  const docHtmlPath = path.join(DOC_DIR, 'doc.html');
  if (!fs.existsSync(docHtmlPath)) {
    console.error('  ⚠ 未找到 doc.html，跳过版本占位符替换');
    return null;
  }
  const html = fs.readFileSync(docHtmlPath, 'utf-8');
  const m = html.match(/saTokenTopVersion\s*=\s*['"]([^'"]+)['"]/);
  return m ? m[1] : null;
}
const TOP_VERSION = readTopVersion();

// ── 代码块保护：逐行状态机，自动补全未闭合围栏 ──
function protectCodeBlocks(content) {
  const codeBlocks = [];
  const lines = content.split('\n');
  const out = [];
  let inBlock = false;
  let blockLines = [];

  for (const line of lines) {
    if (/^```/.test(line)) {
      if (!inBlock) {
        inBlock = true;
        blockLines = [line];
      } else {
        blockLines.push(line);
        codeBlocks.push(blockLines.join('\n'));
        out.push(`__CODE_BLOCK_${codeBlocks.length - 1}__`);
        inBlock = false;
        blockLines = [];
      }
    } else if (inBlock) {
      blockLines.push(line);
    } else {
      out.push(line);
    }
  }

  if (inBlock) {
    blockLines.push('```');
    codeBlocks.push(blockLines.join('\n'));
    out.push(`__CODE_BLOCK_${codeBlocks.length - 1}__`);
  }

  return { result: out.join('\n'), codeBlocks };
}

function restoreCodeBlocks(content, codeBlocks) {
  for (let i = 0; i < codeBlocks.length; i++) {
    content = content.replace(`__CODE_BLOCK_${i}__`, codeBlocks[i]);
  }
  return content;
}

// ── 通用 HTML 标签清扫（白名单制）──
const HTML_CONTAINER_TAGS = [
  'a', 'span', 'p', 'div', 'button', 'font', 'details', 'summary', 'object',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label', 'td', 'th', 'li', 'strong', 'em', 'b', 'u', 'code', 'pre',
  'table', 'thead', 'tbody', 'tr', 'ul', 'ol', 'form', 'nav', 'header', 'footer',
  'section', 'article', 'main', 'aside'
];
const HTML_VOID_TAGS = ['br', 'img', 'meta', 'link', 'input', 'hr', 'source', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr'];
const HTML_STRUCT_TAGS = ['html', 'head', 'body', 'title', 'meta', 'link', 'script', 'style'];

function sweepHtmlTags(text) {
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<head[\s\S]*?<\/head>/gi, '');

  const allContainer = HTML_CONTAINER_TAGS.join('|');
  const containerRe = new RegExp('<(' + allContainer + ')(\\s[^>]*)?>([\\s\\S]*?)<\\/\\1>', 'gi');
  let prev, guard = 0;
  do {
    prev = text;
    text = text.replace(containerRe, '$3');
  } while (text !== prev && ++guard < 5);

  const allTags = HTML_CONTAINER_TAGS.concat(HTML_VOID_TAGS, HTML_STRUCT_TAGS).join('|');
  text = text.replace(new RegExp('<\\/?(' + allTags + ')\\b[^>]*>', 'gi'), '');

  return text;
}

// ── 核心清洗（可递归，visited 防环）──
function cleanContent(raw, absPath, visited) {
  // 1. 版本占位符替换（protect 之前，确保代码块内版本号也替换）
  if (TOP_VERSION) {
    raw = raw.replace(/\$\{sa\.top\.version\}/g, TOP_VERSION);
  }

  // 2. 保护代码块
  const { result: protectedContent, codeBlocks } = protectCodeBlocks(raw);
  let text = protectedContent;

  // 3. docsify 提示框：<!-- !> 文本 --> / <!-- ?> 文本 -->（必须在删通用注释前处理）
  text = text.replace(/<!--\s*[!?]>\s*([\s\S]*?)\s*-->/g, (_, inner) => `> **提示：** ${inner.trim()}`);

  // 4. GitHub 风 alert：> [!TIP| style:callout] 行 → 删标记，保留后续 blockquote 内容
  text = text.replace(/^>\s*\[!.*?\]\s*\n/gm, '');

  // 5. tabs 展开（两种注释风格）：精确删除 tabs:start / tabs:end 标记，tab:名称 → **【名称】**
  //    关键：必须用精确匹配，绝不可在标记间用 [\s\S]*?，否则会跨过中间的 tab: 内容一并删除
  text = text.replace(/<!-{3,}\s*tabs:(?:start|end)\s*-{3,}\s*>/g, '');
  text = text.replace(/<!--\s*tabs:(?:start|end)\s*-->/g, '');
  // HTML 注释风：<!------ tab:名称 ------>
  text = text.replace(/<!-{3,}\s*tab:([^<]+?)\s*-{3,}>/g, (_, name) => `\n\n**【${name.trim()}】**\n\n`);
  // 纯注释风：<!-- tab:名称 -->
  text = text.replace(/<!--\s*tab:([^<]+?)\s*-->/g, (_, name) => `\n\n**【${name.trim()}】**\n\n`);

  // 6. :include 文件嵌入 → 递归内联（防环）
  text = text.replace(/\[[^\]]*\]\(([^)]+?)\s+':include'\)/g, (_, p) => {
    const filePart = p.split('#')[0];
    const includeAbs = path.resolve(path.dirname(absPath), filePart);
    if (visited.has(includeAbs)) return '';
    if (!fs.existsSync(includeAbs)) {
      console.error(`  ⚠ :include 目标不存在，已跳过: ${filePart}`);
      return '';
    }
    visited.add(includeAbs);
    const incRaw = fs.readFileSync(includeAbs, 'utf-8');
    let incClean = cleanContent(incRaw, includeAbs, visited);
    // 内联时剥除被嵌文件的首个 H1，避免与宿主文档标题层级冲突
    incClean = incClean.replace(/^#\s+.*\n/, '');
    return '\n\n' + incClean.trim() + '\n\n';
  });

  // 7. 着色标签 <green>/<red> → **加粗**
  const emph = (_, inner) => (inner.startsWith('**') && inner.endsWith('**')) ? inner : `**${inner}**`;
  text = text.replace(/<green>(.*?)<\/green>/g, emph);
  text = text.replace(/<red>(.*?)<\/red>/g, emph);

  // 8. <font color> → **文本**
  text = text.replace(/<font[^>]*color="[^"]*"[^>]*>(.*?)<\/font>/g, (_, inner) => inner.trim() ? `**${inner.trim()}**` : '');

  // 9. 删除 HTML 注释（!> 已在步骤3提取，其余注释如被注释掉的链接应丢弃）
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  // 10. 删除 <object>（SVG 交互图）/ <button>（演示图按钮）
  text = text.replace(/<object[^>]*>.*?<\/object>/g, '');
  text = text.replace(/<button[\s\S]*?<\/button>/gi, '');

  // 11. 删除徽章 / 带 class 的 img，其余 img 仅保留有价值的 alt
  text = text.replace(/<img[^>]*shields\.io[^>]*\/?>/g, '');
  text = text.replace(/<img[^>]*badge\/star\.svg[^>]*\/?>/g, '');
  text = text.replace(/<img[^>]*badge\/fork\.svg[^>]*\/?>/g, '');
  text = text.replace(/<img[^>]*class="[^"]*"[^>]*\/?>/g, '');
  text = text.replace(/<img[^>]*alt="([^"]*)"[^>]*\/?>/g, (_, alt) => {
    if (alt === '运行结果' || alt === 'logo' || alt === '运行结果图') return '';
    return alt ? `*图: ${alt}*` : '';
  });
  text = text.replace(/<img[^>]*\/?>/g, '');

  // 12. 删除 HTML 文档结构标签
  text = text.replace(/<head[^>]*>.*?<\/head>/gi, '');
  text = text.replace(/<body[^>]*>/gi, '');
  text = text.replace(/<\/body>/gi, '');
  text = text.replace(/<title[^>]*>.*?<\/title>/gi, '');
  text = text.replace(/<meta[^>]*>/gi, '');

  // 13. 删除布局标签（保留内容）
  text = text.replace(/<p[^>]*>/g, '');
  text = text.replace(/<\/p>/g, '');
  text = text.replace(/<div[^>]*>/g, '');
  text = text.replace(/<\/div>/g, '');
  text = text.replace(/<h[1-6][^>]*>/g, '');
  text = text.replace(/<\/h[1-6]>/g, '');
  text = text.replace(/<details>/g, '');
  text = text.replace(/<\/details>/g, '');
  text = text.replace(/<summary>(.*?)<\/summary>/g, (_, inner) => `**${inner.trim()}**`);

  // 14. 删除 a 徽章链接块（shields / star / 空壳）
  text = text.replace(/<a[^>]*><img[^>]*\/?><\/a>/g, '');
  text = text.replace(/<a[^>]*>\s*<\/a>/g, '');
  text = text.replace(/<a[^>]*href="[^"]*badge[^"]*"[^>]*>.*?<\/a>/g, '');
  text = text.replace(/<a[^>]*href="[^"]*shields\.io[^"]*"[^>]*>.*?<\/a>/g, '');
  text = text.replace(/<a[^>]*href="[^"]*stargazers[^"]*"[^>]*>.*?<\/a>/g, '');
  text = text.replace(/<a[^>]*href="[^"]*members[^"]*"[^>]*>.*?<\/a>/g, '');

  // 15. 删除 <br/>
  text = text.replace(/<br\s*\/?>/gi, '');

  // 16. 通用 HTML 标签清扫兜底（保留容器内文）
  text = sweepHtmlTags(text);

  // 17. 收敛空行、去尾空白
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trimEnd() + '\n';

  // 18. 单篇：保留原始标题层级，不降级

  // 19. 还原代码块
  text = restoreCodeBlocks(text, codeBlocks);

  return text;
}

function cleanDocFile(relPath) {
  const abs = path.isAbsolute(relPath)
    ? relPath
    : path.join(DOC_DIR, relPath);
  if (!fs.existsSync(abs)) {
    throw new Error('文件不存在: ' + abs);
  }
  const raw = fs.readFileSync(abs, 'utf-8');
  return cleanContent(raw, abs, new Set([abs]));
}

// ── 入口（仅 CLI 直接调用时执行；被 require 时不触发）──
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('用法: node clean-doc.js <doc相对路径> [--out <输出文件>]');
    process.exit(1);
  }
  let relPath = null;
  let outFile = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') {
      outFile = args[++i];
    } else if (!relPath) {
      relPath = args[i];
    }
  }

  try {
    const result = cleanDocFile(relPath);
    if (outFile) {
      fs.writeFileSync(outFile, result, 'utf-8');
      console.error('→ 已写入 ' + outFile + ` (${Buffer.byteLength(result, 'utf-8')} 字节)`);
    } else {
      process.stdout.write(result);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

module.exports = { cleanDocFile, cleanContent };
