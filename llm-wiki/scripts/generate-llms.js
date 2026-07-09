/**
 * Sa-Token llms.txt 生成脚本
 *
 * 功能：
 * 1. 解析 _sidebar.md → 提取分组和链接结构
 * 2. 清洗 markdown（去掉 docsify 自定义 HTML 标签）
 * 3. 生成 llms.txt 索引文件
 * 4. 生成 llms-full.txt 全量聚合文件
 *
 * 用法：node llm-wiki/scripts/generate-llms.js
 * 输出：llm-wiki/ 目录下的 llms.txt 和 llms-full.txt
 */

const fs = require('fs');
const path = require('path');

const DOC_DIR = path.resolve(__dirname, '..', '..', 'sa-token-doc');
const SIDEBAR_PATH = path.join(DOC_DIR, '_sidebar.md');
const OUTPUT_DIR = path.resolve(__dirname, '..');

// 单篇清洗模块（保留原始标题层级，不做聚合降级），用于生成 docs/ 下的清洗版单篇
const { cleanDocFile } = require('./clean-doc.js');
const DOCS_OUT_DIR = path.resolve(__dirname, '..', '..', 'docs');

// 读取 Sa-Token 顶部版本号（来自 sa-token-doc/doc.html 的 saTokenTopVersion）
// 用于替换文档中的 ${sa.top.version} 占位符，使依赖片段携带具体版本号
function readTopVersion() {
  const docHtmlPath = path.join(DOC_DIR, 'doc.html');
  if (!fs.existsSync(docHtmlPath)) {
    console.warn(`  ⚠ 未找到 ${docHtmlPath}，跳过版本占位符替换`);
    return null;
  }
  const html = fs.readFileSync(docHtmlPath, 'utf-8');
  const m = html.match(/saTokenTopVersion\s*=\s*['"]([^'"]+)['"]/);
  return m ? m[1] : null;
}
const TOP_VERSION = readTopVersion();

// ─── 排除列表 ───

// 不对 LLM 有价值的条目：项目运营信息、下载链接、社区信息等
// 使用 _sidebar.md 中的 docsify 路径格式（不带 .md 后缀）
const EXCLUDED_PATHS = new Set([
  '/',                         // 首页（README.md，纯营销着陆页）
  '/start/download',           // 其它环境集成示例（非核心技术文档）
  '/more/download-demos',      // 示例大全下载
  '/more/update-log',          // 更新日志
  '/more/link',                // 框架生态（外链集合）
  '/more/blog',                // 框架博客
  '/more/tj-gzh',              // 推荐公众号
  '/more/join-group',          // 加入讨论群
  '/more/content-cooperation', // 内容合作群
  '/more/sa-token-donate',     // 赞助
  '/more/demand-commit',       // 需求提交
  '/more/wenjuan',             // 问卷调查
  '/more/common-questions',    // 常见问题排查（FAQ，价值低）
  '/more/noun-intro',          // 框架名词解释
  '/more/common-action',       // 全局类方法（和 API 手册重复）
  '/fun/git-pr',               // 贡献代码指南
  '/fun/timeline',             // 开源大事记
  '/fun/team',                 // 团队成员
  '/fun/sa-token-test',        // 在线考试
  '/fun/issue-template',       // issue 提问模板
  '/fun/refer-info',           // 参考资料
  '/fun/tech-stack',           // 框架源码技术栈
  '/arch/dir-intro',           // 仓库目录（非技术文档）
  '/arch/data-structure',      // 数据结构（内部设计，对使用者无价值）
]);

// 不对 LLM 有价值的完整分组（整个分组排除）
const EXCLUDED_GROUPS = new Set(['其它']);

// llms.txt 规范定义哪些分组归入 Optional 段
const OPTIONAL_GROUPS = ['附录', '框架设计'];

// ─── 1. 解析 _sidebar.md ───

function parseSidebar(content) {
  const groups = [];
  let currentGroup = null;
  // 保存 docsify 原始路径，用于排除比对
  let currentRawPath = '';

  const lines = content.split('\n');
  for (const rawLine of lines) {
    // 去掉 HTML 注释内容（<!-- ... -->），这些是未发布的条目
    const line = rawLine.replace(/<!--.*?-->/g, '');

    // 匹配分组标题：- **分组名**
    const groupMatch = line.match(/^\s*-\s*\*\*(.+?)\*\*/);
    if (groupMatch) {
      currentGroup = { name: groupMatch[1], items: [] };
      // 排除整个分组
      if (!EXCLUDED_GROUPS.has(currentGroup.name)) {
        groups.push(currentGroup);
      } else {
        currentGroup = null; // 标记为已排除，后续条目也不收集
      }
      continue;
    }

    // 匹配链接项：[标题](/路径)
    if (currentGroup) {
      const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        const title = linkMatch[1];
        let urlPath = linkMatch[2];
        currentRawPath = urlPath;

        // 过滤外部链接（如 Sa-Pro 商业版）
        if (urlPath.startsWith('http://') || urlPath.startsWith('https://')) {
          continue;
        }

        // 过滤排除列表中的条目
        if (EXCLUDED_PATHS.has(urlPath)) {
          continue;
        }

        // 处理 docsify 路径 → md 文件路径
        // /use/login-auth → use/login-auth.md
        // / → README.md (首页)
        if (urlPath === '/') {
          urlPath = 'README.md';
        } else {
          urlPath = urlPath.replace(/^\//, '') + '.md';
        }

        currentGroup.items.push({ title, filePath: urlPath });
      }
    }
  }

  return groups;
}

// ─── 2. 清洗 markdown ───

// 保护代码块内容不被误清洗：逐行状态机提取 ```...``` 代码块 → 清洗正文 → 拼回
// 相比纯正则，状态机能处理源文档漏写闭围栏的情况（自动补闭合），避免孤立 ```
// 污染聚合文档的 markdown 结构
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

  // 容错：文档结尾仍未闭合的代码块（源文档漏写闭围栏，如 fun/firewall.md）
  // 自动补一个闭围栏并整体保护，杜绝孤立的 ``` 破坏后续章节结构
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

// ─── 通用 HTML 标签清扫（白名单制）───
// 清理源文档内嵌的原始 HTML（Thymeleaf 测试页、class 按钮链接、HTML 页面脚手架等），
// 容器标签保留内文，空/结构标签直接移除。白名单机制避免误伤 Java 泛型 <String>、<T> 等。
const HTML_CONTAINER_TAGS = [
  'a', 'span', 'p', 'div', 'button', 'font', 'details', 'summary', 'object',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label', 'td', 'th', 'li', 'strong', 'em', 'b', 'u', 'code', 'pre',
  'table', 'thead', 'tbody', 'tr', 'ul', 'ol', 'form', 'nav', 'header', 'footer',
  'section', 'article', 'main', 'aside'
];
const HTML_VOID_TAGS = ['br', 'img', 'meta', 'link', 'input', 'hr', 'source', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr'];
const HTML_STRUCT_TAGS = ['html', 'head', 'body', 'title', 'meta', 'link', 'script', 'style'];

function sweepHtmlTags(text) {
  // 1. script / style / head 整块移除（含内容，兜底多行属性情况）
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<head[\s\S]*?<\/head>/gi, '');

  // 2. 容器标签成对移除，保留内文（多趟处理同标签嵌套）
  const allContainer = HTML_CONTAINER_TAGS.join('|');
  const containerRe = new RegExp('<(' + allContainer + ')(\\s[^>]*)?>([\\s\\S]*?)<\\/\\1>', 'gi');
  let prev, guard = 0;
  do {
    prev = text;
    text = text.replace(containerRe, '$3');
  } while (text !== prev && ++guard < 5);

  // 3. 残留的开/闭标签（白名单内）一律移除
  const allTags = HTML_CONTAINER_TAGS.concat(HTML_VOID_TAGS, HTML_STRUCT_TAGS).join('|');
  text = text.replace(new RegExp('<\\/?(' + allTags + ')\\b[^>]*>', 'gi'), '');

  return text;
}

function cleanMarkdown(content) {
  // 版本占位符替换（在代码块保护前执行，确保代码块内的版本号也被替换为具体值）
  if (TOP_VERSION) {
    content = content.replace(/\$\{sa\.top\.version\}/g, TOP_VERSION);
  }
  // 先保护代码块
  const { result: protected, codeBlocks } = protectCodeBlocks(content);
  let text = protected;

  // <green>text</green> / <green>**text**</green> → **text**
  text = text.replace(/<green>(.*?)<\/green>/g, (_, inner) => {
    if (inner.startsWith('**') && inner.endsWith('**')) {
      return inner;
    }
    return `**${inner}**`;
  });

  // <red>text</red> → **text**
  text = text.replace(/<red>(.*?)<\/red>/g, (_, inner) => {
    if (inner.startsWith('**') && inner.endsWith('**')) {
      return inner;
    }
    return `**${inner}**`;
  });

  // <font color="#xxx">text</font> → **text**（docsify 着色标签）
  text = text.replace(/<font[^>]*color="[^"]*"[^>]*>(.*?)<\/font>/g, (_, inner) => {
    return inner.trim() ? `**${inner.trim()}**` : '';
  });

  // 移除 HTML 注释 <!-- ... -->
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  // 移除 <object> 标签（SVG 交互图）
  text = text.replace(/<object[^>]*>.*?<\/object>/g, '');

  // 移除徽章图片行
  text = text.replace(/<img[^>]*shields\.io[^>]*\/?>/g, '');
  text = text.replace(/<img[^>]*badge\/star\.svg[^>]*\/?>/g, '');
  text = text.replace(/<img[^>]*badge\/fork\.svg[^>]*\/?>/g, '');

  // 移除带 class 的 img 标签（w-100 展示图、logo、s-w 截图等）
  text = text.replace(/<img[^>]*class="[^"]*"[^>]*\/?>/g, '');

  // 移除其余 <img> 标签（保留有价值 alt 文本，排除截图类）
  text = text.replace(/<img[^>]*alt="([^"]*)"[^>]*\/?>/g, (_, alt) => {
    if (alt === '运行结果' || alt === 'logo' || alt === '运行结果图') {
      return '';
    }
    return alt ? `*图: ${alt}*` : '';
  });
  text = text.replace(/<img[^>]*\/?>/g, '');

  // 移除 HTML 文档结构标签
  text = text.replace(/<head[^>]*>.*?<\/head>/gi, '');
  text = text.replace(/<body[^>]*>/gi, '');
  text = text.replace(/<\/body>/gi, '');
  text = text.replace(/<title[^>]*>.*?<\/title>/gi, '');
  text = text.replace(/<meta[^>]*>/gi, '');

  // 移除布局标签（保留内容）
  text = text.replace(/<p[^>]*>/g, '');
  text = text.replace(/<\/p>/g, '');
  text = text.replace(/<div[^>]*>/g, '');
  text = text.replace(/<\/div>/g, '');
  text = text.replace(/<h[1-6][^>]*>/g, '');
  text = text.replace(/<\/h[1-6]>/g, '');

  // 移除 <details>/<summary> 标签（保留内容）
  text = text.replace(/<details>/g, '');
  text = text.replace(/<\/details>/g, '');
  text = text.replace(/<summary>(.*?)<\/summary>/g, (_, inner) => `**${inner.trim()}**`);

  // 移除 <a href="..."><img ...></a> 徽章链接块（含空壳残留）
  text = text.replace(/<a[^>]*><img[^>]*\/?><\/a>/g, '');
  text = text.replace(/<a[^>]*>\s*<\/a>/g, '');
  text = text.replace(/<a[^>]*href="[^"]*badge[^"]*"[^>]*>.*?<\/a>/g, '');
  text = text.replace(/<a[^>]*href="[^"]*shields\.io[^"]*"[^>]*>.*?<\/a>/g, '');
  text = text.replace(/<a[^>]*href="[^"]*stargazers[^"]*"[^>]*>.*?<\/a>/g, '');
  text = text.replace(/<a[^>]*href="[^"]*members[^"]*"[^>]*>.*?<\/a>/g, '');

  // 移除 <br/> 标签
  text = text.replace(/<br\s*\/?>/gi, '');

  // 通用 HTML 标签清扫（白名单制）：兜底清理上述规则未覆盖的残留 HTML
  // （内嵌 HTML 页面脚手架、class 按钮链接、<span>/<a>/<p> 等），保留容器内文
  text = sweepHtmlTags(text);

  // 清理多余空行（3+ 连续空行 → 2 个）
  text = text.replace(/\n{3,}/g, '\n\n');

  // 去掉末尾空行
  text = text.trimEnd() + '\n';

  // 标题层级修正：剥除文档首个 H1（与注入锚点 ### path: title 重复），
  // 再按映射降级，确保文档内部标题全部位于注入锚点(###)与分组(##)之下，消除层级反转。
  // 映射：H1→H4、H2→H4、H3→H5、H4→H6、H5→H6（H6 为下限，避免超出 markdown 六级上限）。
  // 代码块已被保护，行首 # 不会误伤代码内容。
  text = text.replace(/^# .+\n?/m, '');          // 剥除首个 H1 标题
  text = text.replace(/^##### /gm, '###### ');    // H5 → H6
  text = text.replace(/^#### /gm, '###### ');     // H4 → H6
  text = text.replace(/^### /gm, '##### ');       // H3 → H5
  text = text.replace(/^## /gm, '#### ');         // H2 → H4
  text = text.replace(/^# /gm, '#### ');          // 剩余 H1 → H4
  text = text.replace(/\n{3,}/g, '\n\n');         // 剥除标题后重新收敛空行
  text = text.replace(/^\s+/, '');                // 去除开头残留空白

  // 还原代码块
  text = restoreCodeBlocks(text, codeBlocks);

  return text;
}

// ─── 3. 读取并清洗文档内容 ───

function readAndCleanDoc(filePath) {
  const fullPath = path.join(DOC_DIR, filePath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`  ⚠ 文件不存在: ${filePath}`);
    return null;
  }
  const raw = fs.readFileSync(fullPath, 'utf-8');
  return cleanMarkdown(raw);
}

// ─── 4. 生成 llms.txt ───

function generateLlmsTxt(groups) {
  let output = '';

  // H1 标题 + blockquote 概述
  output += '# Sa-Token\n\n';
  output += '> Sa-Token 是一个轻量级 Java 权限认证框架，主要解决：登录认证、权限认证、单点登录（SSO）、OAuth2.0、分布式 Session 会话、微服务网关鉴权、API Key 认证等问题。API 设计极简，核心功能一行代码调用。\n\n';
  output += '> 核心 API：StpUtil.login(id) / StpUtil.checkLogin() / StpUtil.checkPermission(\"xxx\") / StpUtil.logout()\n\n';

  // 必选分组（H2）
  for (const group of groups) {
    if (OPTIONAL_GROUPS.includes(group.name)) continue;

    output += `## ${group.name}\n\n`;
    for (const item of group.items) {
      // llms.txt 链接指向 docs/ 下的清洗版单篇（已去除 docsify 噪声）
      const linkPath = `docs/${item.filePath}`;
      output += `- [${item.title}](${linkPath})\n`;
    }
    output += '\n';
  }

  // Optional 段
  const optionalGroups = groups.filter(g => OPTIONAL_GROUPS.includes(g.name));
  if (optionalGroups.length > 0) {
    output += '## Optional\n\n';
    for (const group of optionalGroups) {
      for (const item of group.items) {
        const linkPath = `docs/${item.filePath}`;
        output += `- [${item.title}](${linkPath})\n`;
      }
    }
    output += '\n';
  }

  return output;
}

// ─── 5. 生成 llms-full.txt ───

function generateLlmsFull(groups) {
  let output = '';

  // 顶部信息
  output += '# Sa-Token — 完整文档\n\n';
  output += '> 以下为 Sa-Token 官方文档的全量聚合版本，按功能域分组。由脚本从 _sidebar.md 自动生成。\n\n';

  for (const group of groups) {
    // Optional 分组标注
    const isOptional = OPTIONAL_GROUPS.includes(group.name);
    const prefix = isOptional ? '## Optional — ' : '## ';

    output += `${prefix}${group.name}\n\n`;

    for (const item of group.items) {
      const content = readAndCleanDoc(item.filePath);
      if (content) {
        // 章节标题包含文件路径，便于回溯到 llms.txt 条目
        // 格式：### path: 标题（如 ### use/login-auth: 登录认证）
        const pathKey = item.filePath.replace(/^sa-token-doc\//, '').replace(/\.md$/, '');
        output += `### ${pathKey}: ${item.title}\n\n`;
        output += content;
        output += '\n---\n\n';
      }
    }
  }

  return output;
}

// ─── 5.5 生成清洗版单篇（docs/）───
// 让 llms.txt 索引链接指向干净单篇，而非原始带噪声的 sa-token-doc/*.md。
// 复用 clean-doc.js 的独立清洗逻辑（保留原始标题层级，不做聚合降级）。
// 输出目录为仓库根 docs/，按 sa-token-doc 相对路径铺开（如 docs/sso/sso-type1.md）。
function generateCleanDocs(groups) {
  let count = 0, skip = 0;
  for (const group of groups) {
    for (const item of group.items) {
      const outPath = path.join(DOCS_OUT_DIR, item.filePath);
      try {
        const cleaned = cleanDocFile(item.filePath); // 相对 sa-token-doc 的路径
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, cleaned, 'utf-8');
        count++;
      } catch (e) {
        console.warn(`  ⚠ 清洗单篇失败，已跳过: ${item.filePath} - ${e.message}`);
        skip++;
      }
    }
  }
  console.log(`  ✓ 已生成 ${count} 篇清洗单篇${skip ? `，${skip} 篇跳过` : ''}`);
}

// ─── 6. 主流程 ───

function main() {
  console.log(`→ 顶部版本号: ${TOP_VERSION || '(未读取，跳过占位符替换)'}`);
  console.log('→ 读取 _sidebar.md...');
  const sidebarContent = fs.readFileSync(SIDEBAR_PATH, 'utf-8');

  console.log('→ 解析分组结构...');
  const groups = parseSidebar(sidebarContent);

  // 统计
  const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);
  console.log(`  解析到 ${groups.length} 个分组，${totalItems} 个文档条目`);

  // 验证文件存在性
  let missingCount = 0;
  for (const group of groups) {
    for (const item of group.items) {
      const fullPath = path.join(DOC_DIR, item.filePath);
      if (!fs.existsSync(fullPath)) {
        console.warn(`  ⚠ 文件不存在: ${item.filePath}`);
        missingCount++;
      }
    }
  }
  if (missingCount > 0) {
    console.warn(`  ⚠ 共 ${missingCount} 个文件缺失，将跳过`);
  }

  console.log('→ 生成 llms.txt...');
  const llmsTxt = generateLlmsTxt(groups);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'llms.txt'), llmsTxt, 'utf-8');
  console.log(`  ✓ llms.txt 已写入`);

  console.log('→ 生成 llms-full.txt...');
  const llmsFull = generateLlmsFull(groups);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'llms-full.txt'), llmsFull, 'utf-8');
  const fullSizeKB = Buffer.byteLength(llmsFull, 'utf-8') / 1024;
  console.log(`  ✓ llms-full.txt 已写入 (${fullSizeKB.toFixed(1)} KB)`);

  console.log('→ 生成清洗版单篇 (docs/)...');
  generateCleanDocs(groups);
}

main();
