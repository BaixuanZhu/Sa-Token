---
name: sa-token-dev
description: >-
  Sa-Token（cn.dev33）Java 权限认证框架开发助手。
  适用于：项目已使用 Sa-Token 依赖（sa-token-spring-boot-starter /
  sa-token-spring-boot3-starter / sa-token-spring-boot4-starter /
  sa-token-reactor-spring-boot-starter）、StpUtil API、登录认证、权限认证（StpInterface /
  权限码 / 角色 / 通配符）、注解鉴权（@SaCheckLogin / @SaCheckPermission / @SaCheckRole /
  @SaCheckOr / @SaIgnore / @SaCheckSafe / @SaCheckDisable）、路由拦截鉴权（SaInterceptor /
  SaRouter）、Session 会话（Account/Token/Custom 三种类型）、集成 Redis、前后端分离 token 传递、
  记住我、同端互斥登录、踢人下线、账号封禁、二级认证、身份切换、多账号认证、密码加密、
  Token 风格与前缀、全局侦听器与过滤器、SSO 单点登录（三种模式）、OAuth2.0、微服务网关鉴权、
  JWT / API-Key / API 签名 / AOP 注解 / 临时 Token 等插件。
  不适用于：Shiro / Spring Security 项目、纯 JWT 自实现方案、非 Java 语言。
  纯 Spring Security 项目仅异常码参考章节部分适用。
agent_created: true
---

# Sa-Token 开发助手

面向日常 Java 开发的 Sa-Token 编码助手。推荐 **1.45.0+**（最新稳定版），**1.40.x 及以上全线适用**，核心 API（StpUtil / SaInterceptor / StpInterface / SaSession 等）保持向后兼容，新版本可能在已有基础上新增方法，本 skill 中的示例在 1.40.x ~ 最新版均可直接使用。历史版本差异已在文中以 `v1.xx.0+` 标注。
采用**完全本地自包含**策略：所有知识沉淀于本地 `references/`，运行时不依赖任何外部文档站点。

## 版本与依赖（先判 SpringBoot 版本）

| SpringBoot | starter 坐标 | 环境 |
|---|---|---|
| 2.x | `sa-token-spring-boot-starter` | Servlet (SpringMVC) |
| 3.x | `sa-token-spring-boot3-starter` | Servlet (SpringMVC) |
| 4.x | `sa-token-spring-boot4-starter` | Servlet (SpringMVC) |
| 2.x (响应式) | `sa-token-reactor-spring-boot-starter` | WebFlux / Gateway |
| 3.x (响应式) | `sa-token-reactor-spring-boot3-starter` | WebFlux / Gateway |
| 4.x (响应式) | `sa-token-reactor-spring-boot4-starter` | WebFlux / Gateway |

- **切勿**同时引入 `sa-token-spring-boot-starter` 和 `sa-token-reactor-spring-boot-starter`，项目无法启动。
- **Redis 集成**：引 `sa-token-redis-template` + `commons-pool2`，分布式场景必须。
- **SpringBoot 3.x**：Redis 前缀从 `spring.redis` 改为 `spring.data.redis`。
- 微服务网关用 Reactor 依赖，子服务用 Servlet 依赖，**不要在父 pom 统一引入**。

## 何时使用本技能

| 信号 | 判定 |
|------|------|
| 依赖含 `sa-token-*` / 代码用 `StpUtil` / `SaInterceptor` / `SaRouter` | 激活 |
| 提到 `@SaCheckLogin` / `@SaCheckPermission` / `@SaCheckRole` / `@SaIgnore` / "Sa-Token" / "sa-token" | 激活 |
| SSO 单点登录 / OAuth2.0 / 微服务网关鉴权 / JWT / API-Key / API 签名 | 激活 |
| 纯 Spring Security / Shiro 项目 | 不适用 |
| 非 Java 语言（Go / Python / Node.js） | 不适用 |
| 纯 JWT 自实现（无 Sa-Token 依赖） | 不适用 |

> **检查点**：判定为「不适用」→ 告知用户当前问题不在 Sa-Token 范围，建议退出本技能。

## 独特价值

本技能不只是 API 字典，而是 **Sa-Token 最佳实践指南**：
1. **antipattern 纠偏**（`10-antipattern.md`）：28 条 Agent 生成 Sa-Token 代码时的常见错误，每条含「错误写法 → 正确写法 → 为什么」。
2. **强约束**：12 条核心规则，Agent 生成代码前必须遵守。
3. **关键决策检查点**：6 个关键决策点（JWT 模式 / SSO 模式 / Cookie vs Header / 注解 vs 路由 / 微服务 Session / 多账号），Agent 不可擅自替用户选择，必须先确认方向。
4. **决策树**：注解 vs 路由拦截、Cookie vs Header、JWT 三种模式选型、SSO 三种模式选型——均有明确指引。
5. **全本地自包含**：SSO、OAuth2、微服务、插件等高级模块全部本地化，无需 web search。

## 快速判断

| 用户说... | 先读 | 同时警告 |
|-----------|------|---------|
| "集成 Sa-Token" / "怎么用" | `01-setup.md` | SpringBoot 版本决定 starter 坐标 |
| "登录" / "登出" / "token 过期" | `02-login-auth.md` | timeout vs active-timeout 是两个独立机制 |
| "权限" / "角色" / "RBAC" | `03-permission.md` | 必须实现 StpInterface；后端必须再次校验 |
| "注解不生效" / "@SaCheck" | `04-annotation.md` | 必须先注册 SaInterceptor，否则注解无效 |
| "路由拦截" / "批量鉴权" | `05-interceptor-route.md` | 注解 vs 路由拦截选型 |
| "Session" / "会话" / "存数据" | `06-session.md` | SaSession ≠ HttpSession，不可混用 |
| "Redis" / "分布式" / "前后端分离" | `07-redis-frontsep.md` | SB3.x 前缀 spring.data.redis |
| "StpUtil 有哪些方法" | `08-api-stputil.md` | 踢人 vs 注销 vs 顶人场景值不同 |
| "报错了" / "排错" | `09-pitfalls.md` | NotLoginException 7 种场景值 |
| "记住我" / "同端互斥" / "封禁" / "二级认证" | `11-advanced.md` | v1.31.0+ login 不再自动校验封禁 |
| "SSO" / "单点登录" | `12-sso-oauth2.md` | 三种模式选型看前端是否同域+后端是否同 Redis |
| "OAuth2" / "开放平台" | `12-sso-oauth2.md` | SSO vs OAuth2 选型 |
| "微服务" / "网关鉴权" | `13-micro-service.md` | 网关用 Reactor 依赖，子服务用 Servlet |
| "JWT" / "API-Key" / "签名" | `14-plugin.md` | JWT 三种模式功能差异大 |
| "代码有坑吗" / "最佳实践" | `10-antipattern.md` | 核心价值文件，每次生成代码前必看 |

## 常见任务速查

| 任务 | 先读 | 同时警告 |
|------|------|---------|
| 集成 + 跑通登录 | `01-setup.md` | 零配置可启动，但生产需调 timeout/is-concurrent |
| 全局登录校验 + 排除白名单 | `05-interceptor-route.md` | SaInterceptor 注册后注解才生效 |
| 前后端分离 token 传递 | `07-redis-frontsep.md` | 前端塞 header，参数名即 tokenName |
| 权限设计（RBAC） | `03-permission.md` | 实现 StpInterface；通配符 * 代表全通过 |
| 注解鉴权 vs 路由拦截选型 | `04-annotation.md` §7 | 粗粒度用路由，细粒度用注解，可混用 |
| 踢人下线 / 账号封禁 | `08-api-stputil.md` + `11-advanced.md` | kickout vs disable 不同；封禁需先踢下线 |
| 记住我 / 非记住我 | `11-advanced.md` §1 | 本质是 Cookie 持久 vs 临时；前后端分离需前端控制 |
| 同端互斥登录 | `11-advanced.md` §2 | 需配 is-concurrent=false + 指定 device |
| 二级认证（敏感操作） | `11-advanced.md` §4 | openSafe + checkSafe；注解 @SaCheckSafe |
| 多账号体系 | `11-advanced.md` §6 | 推荐 StpKit 门面模式；LoginType 不可运行时更改 |
| SSO 单点登录 | `12-sso-oauth2.md` | 三种模式选型；allow-url 生产必须配详细地址 |
| 微服务网关鉴权 | `13-micro-service.md` | SaReactorFilter 全局过滤器；Redis 必须 |
| JWT 集成 | `14-plugin.md` §1 | 三种模式选型；Simple 推荐 |
| 跨域 CORS | `09-pitfalls.md` §6 | 过滤器异常不进 @ExceptionHandler |
| Token 前缀（Bearer） | `11-advanced.md` §9 | 前缀与值之间必须有空格；Cookie 模式需额外配置 |

## 主动行为触发

| 代码模式 | 主动提醒 |
|---------|---------|
| 用 `@SaCheck*` 注解但未注册 `SaInterceptor` | 注解依赖拦截器，默认关闭，必须注册 |
| `StpUtil.login(id)` 后直接返回成功 | Cookie 模式自动注入；前后端分离需返回 tokenValue |
| `StpUtil.getSession()` 与 `HttpSession` 混用 | SaSession ≠ HttpSession，互不通 |
| 权限校验只在前端做 | 后端接口必须再次校验，前端校验可被绕过 |
| `is-share: true` + 需要踢人/顶人下线 | is-share=true 时多端共用 token，踢人语义变化 |
| `StpUtil.login(id)` 未校验封禁 | v1.31.0+ login 不再自动校验，需显式 `checkDisable` |
| JWT Stateless 模式 + 需要 Session/踢人 | Stateless 无 Session，不支持踢人/顶人/active-timeout |
| Reactor 依赖 + Servlet 依赖同时引入 | 不可共存，项目无法启动 |
| SSO `allow-url: "*"` | 生产环境必须配置为详细 URL |
| 过滤器 `setError` 未配置 | 过滤器异常不进 @ExceptionHandler，必须用 setError |
| `active-timeout` 配了但自动续签不理解 | getLoginId/checkLogin 等调用时自动续签；关闭用 autoRenew=false |
| 网关用 Servlet 依赖 | SpringCloud Gateway 是 Reactor 模型，必须用 reactor 依赖 |
| Feign 内部调用未传 Same-Token | 子服务会拒绝未携带 Same-Token 的请求 |
| `@SaCheckDisable` 不指定 service | 校验全账号封禁；分类封禁需指定 service |

## 核心强约束（Agent 必须遵守）

1. **先注册拦截器再用注解**：`@SaCheck*` 注解依赖 `SaInterceptor`，默认关闭。必须先 `registry.addInterceptor(new SaInterceptor()).addPathPatterns("/**")` 注册，注解才生效。高版本 SpringBoot（≥2.6.x）可能需额外加 `@EnableWebMvc`。
2. **SaSession ≠ HttpSession**：`StpUtil.getSession()` 返回的 `SaSession` 与 `HttpSession` 无任何关系，互不通。用 Sa-Token 时统一使用 `SaSession`，不要混用。
3. **权限校验后端必须做**：前端按钮级权限只是辅助显示，后端接口必须用 `StpUtil.checkPermission()` 或 `@SaCheckPermission` 再次校验。
4. **实现 StpInterface 才能鉴权**：权限/角色校验依赖 `StpInterface` 实现类（`@Component`），返回权限码和角色集合。不实现则所有权限/角色校验通过。
5. **timeout vs active-timeout 独立**：`timeout` 是长久有效期（默认 30 天），`active-timeout` 是最低活跃频率（超时冻结）。两者独立，任一过期 token 不可用。`-1` 代表永久/不限制。
6. **踢人 vs 注销 vs 顶人不同**：`logout`=正常退出；`kickout`=被动踢下线（场景值 -5）；`replaced`=被顶下线（场景值 -4）。`is-share` 和 `is-concurrent` 配置影响行为。
7. **封禁需先踢下线**：`StpUtil.disable(id, time)` 不会自动让已登录用户下线。需先 `StpUtil.kickout(id)` 再 `disable`。v1.31.0+ `login()` 不再自动校验封禁，需显式 `checkDisable`。
8. **Starter 不可混用**：`sa-token-spring-boot-starter`（Servlet）和 `sa-token-reactor-spring-boot-starter`（Reactor）不可同时引入同一项目。
9. **前后端分离需手动传 token**：Cookie 模式自动注入；前后端分离（App/小程序）需后端返回 `SaTokenInfo`，前端塞 header（参数名即 `tokenName`，默认 `satoken`）。
10. **过滤器异常不进 @ExceptionHandler**：`SaServletFilter` / `SaReactorFilter` 中抛出的异常不进入 Spring 全局异常处理器，必须通过 `.setError()` 处理。
11. **Redis 前缀注意版本**：SpringBoot 2.x 用 `spring.redis.*`，SpringBoot 3.x 用 `spring.data.redis.*`。配错导致连接失败。
12. **JWT 三种模式功能差异大**：Simple（推荐，支持踢人/Session）、Mixin（不支持踢人/顶人）、Stateless（无 Session，不支持踢人/active-timeout）。按需选择，不要盲目用 Stateless。

## 关键决策检查点（生成代码前必须确认）

以下场景存在多条技术路线，Agent **不可擅自替用户选择**。须先简要说明选项差异，确认方向后再编码。

| # | 触发信号 | 必须确认的问题 | 选项差异 | 默认推荐（用户未指定时） |
|---|---------|-------------|---------|----------------------|
| C1 | 用户提到 "JWT" | ① 是否需要踢人/顶人下线？② 是否需要 Session？③ 是否需要无状态（不依赖 Redis）？ | **Simple**：支持踢人/Session/active-timeout，依赖 Redis<br>**Mixin**：Token 内嵌信息，不支持踢人/顶人<br>**Stateless**：纯无状态，无 Session，不支持踢人/active-timeout | **Simple**（功能最全，大多数场景适用） |
| C2 | 用户提到 "SSO" / "单点登录" | ① 各子系统前端是否同域？② 各子系统后端是否共享同一 Redis？ | **模式一**：前端同域 + 后端同 Redis → 共享 Cookie<br>**模式二**：前端不同域 + 后端同 Redis → URL 重定向 + Ticket<br>**模式三**：前端不同域 + 后端不同 Redis → HTTP 请求校验 | 按条件自动判定（同域同 Redis → 模式一） |
| C3 | 用户提到 "登录" / "认证"（未明确前后端分离） | ① 前端是浏览器渲染页面，还是 App/小程序/SPA？② 是否前后端分离？ | **Cookie 模式**：浏览器自动管理，login() 后自动注入<br>**Header 模式**：前后端分离，后端返回 tokenValue，前端塞 header | Cookie（浏览器）；Header（前后端分离/App/小程序） |
| C4 | 用户提到 "鉴权" / "权限" / "保护接口" | ① 需要粗粒度（路径级）还是细粒度（接口/方法级）？② 是否有全局白名单？ | **路由拦截**：SaInterceptor + SaRouter，粗粒度，路径匹配<br>**注解**：@SaCheck*，细粒度，方法级<br>**混用**：路由做白名单 + 注解做细粒度（推荐） | **混用**（路由全局 + 注解细粒度） |
| C5 | 用户提到 "微服务" / "网关" | ① 是否需要无状态（不依赖 Redis）？② 是否需要踢人/active-timeout？ | **Redis 方案**：有状态，支持踢人/active-timeout/Session（推荐）<br>**JWT Stateless**：无状态，不依赖 Redis，但不支持踢人/active-timeout | **Redis 方案**（功能完整） |
| C6 | 用户提到 "多账号" / "多体系" / "多端" | ① 需要几套独立登录体系？② 各体系是否需要不同 timeout/配置？ | **StpKit 门面模式**：每个体系独立 StpLogic，可独立配置<br>**单账号 + device 参数**：同一体系区分设备类型 | 按体系数量决定（≥2 套 → StpKit） |

> **执行规则**：
> 1. 检测到触发信号 → 先向用户提出确认问题，**不要直接生成代码**。
> 2. 用户未明确回答 → 使用「默认推荐」列的策略，但在输出中标注"未确认，已使用默认方案"。
> 3. 用户确认方向 → 按选择生成代码，不再追问。
> 4. 一个需求命中多个检查点 → 逐一确认，全部完成后一次性生成代码。

## 决策路由（全部本地，无在线 fetch）

| 需求场景 | 读取文件 |
|---|---|
| 依赖、starter 选择、yml 配置、最小示例、生产配置清单 | `references/01-setup.md` |
| 登录、登出、会话查询、Token 查询、timeout/active-timeout、登录流程最佳实践 | `references/02-login-auth.md` |
| 权限认证、角色认证、StpInterface、通配符、RBAC 设计模式 | `references/03-permission.md` |
| 注解鉴权（@SaCheck*、SaMode、orRole、@SaIgnore、@SaCheckOr）、注解 vs 路由选型 | `references/04-annotation.md` |
| 路由拦截鉴权（SaInterceptor / SaRouter / match / free / stop / back）、路由设计模式 | `references/05-interceptor-route.md` |
| Session 会话（Account/Token/Custom）、三大作用域、Session 使用模式 | `references/06-session.md` |
| 集成 Redis、前后端分离 token 传递、Redis 部署模式 | `references/07-redis-frontsep.md` |
| StpUtil 常用 API 速查（登录/踢人/封禁/二级认证/身份切换/多账号等） | `references/08-api-stputil.md` |
| 排错：NotLoginException 场景值、异常码、注解不生效、跨域、反代 uri、过滤器异常 | `references/09-pitfalls.md` |
| **Agent 常见错误与最佳实践（核心价值，每次生成代码前必看）** | `references/10-antipattern.md` |
| 高级特性：记住我、同端互斥、账号封禁、二级认证、身份切换、多账号、密码加密、Token 风格/前缀、全局侦听器/过滤器、Http Basic/Digest | `references/11-advanced.md` |
| SSO 单点登录（三种模式）、OAuth2.0（四种授权模式）、SSO vs OAuth2 选型 | `references/12-sso-oauth2.md` |
| 微服务：分布式 Session、网关统一鉴权、内部服务隔离（Same-Token）、依赖引入 | `references/13-micro-service.md` |
| 插件：JWT、API-Key、API 签名、AOP 注解、临时 Token、Alone Redis、SpEL 表达式 | `references/14-plugin.md` |

> **多场景交叉优先级**：当需求同时命中多个 references 时，按下表确定阅读顺序：
>
> | 组合场景 | 先读 | 再读 | 原因 |
> |---------|------|------|------|
> | 注解 + 路由拦截 | `04-annotation.md` | `05-interceptor-route.md` | 先确认注解依赖拦截器，再写路由规则 |
> | 权限 + 注解 | `03-permission.md` | `04-annotation.md` | 先实现 StpInterface，再用注解校验 |
> | 前后端分离 + 跨域 | `07-redis-frontsep.md` | `09-pitfalls.md` §6 | 先确认 token 传递，再处理跨域 |
> | Redis + 分布式 Session | `07-redis-frontsep.md` | `06-session.md` | 先集成 Redis，再理解 Session 模型 |
> | 踢人/封禁 + 异常处理 | `08-api-stputil.md` | `09-pitfalls.md` | 先确认 API，再处理异常场景值 |
> | 记住我 + 前后端分离 | `11-advanced.md` §1 | `07-redis-frontsep.md` | 先确认记住我机制，再适配前后端分离 |
> | SSO + 前后端分离 | `12-sso-oauth2.md` | `07-redis-frontsep.md` | 先选 SSO 模式，再处理 token 传递 |
> | 微服务 + JWT | `13-micro-service.md` | `14-plugin.md` §1 | 先确认网关架构，再选 JWT 模式 |
> | 多账号 + JWT | `11-advanced.md` §6 | `14-plugin.md` §1 | 先确认多账号体系，再集成 JWT |
> | 全局过滤器 + 路由拦截 | `11-advanced.md` §11 | `05-interceptor-route.md` | 先理解过滤器 vs 拦截器，再写规则 |

## 使用流程

1. **确认 Sa-Token 适用性**：看依赖 / StpUtil 使用 / SaInterceptor 注册。不适用 → 告知用户并建议退出；正常 → 继续。
2. **关键决策检查点**：查上方「关键决策检查点」表，命中触发信号 → 先向用户确认方向，**不要直接生成代码**。
3. **定位 reference**：查上方「决策路由」表，读对应文件。
4. **编码前看 antipattern**：生成代码前必读 `10-antipattern.md`，对照常见错误。
5. **编码遵循强约束**：先看 12 条核心强约束，再读 reference 给代码。
6. **遇异常先查排错**：`references/09-pitfalls.md`。
7. **输出前自检（9 项）**：
   - [ ] starter 坐标对应 SpringBoot 版本？（2.x / 3.x / 4.x）
   - [ ] 命中关键决策检查点？→ 已向用户确认方向（或使用默认方案并标注）
   - [ ] 用了 @SaCheck* 注解？→ 确认注册了 SaInterceptor
   - [ ] 前后端分离？→ 确认返回了 tokenValue，前端塞 header
   - [ ] 用了 SaSession？→ 确认没和 HttpSession 混用
   - [ ] 用了 Redis？→ 确认 SpringBoot 版本对应正确前缀（spring.redis vs spring.data.redis）
   - [ ] 用了踢人/封禁？→ 确认先 kickout 再 disable
   - [ ] 用了过滤器？→ 确认配置了 setError
   - [ ] 用了 JWT？→ 确认选对模式（Simple/Mixin/Stateless）

## 版本注意
- 依赖坐标 `cn.dev33:sa-token-*`，本地 references 基于 **1.45.0** 整理，**1.40.x 及以上全线适用**。
- **前向兼容**：Sa-Token 核心 API 保持向后兼容。如遇新版本 API 签名变更，以官方 `StpUtil` 源码为准；本 skill 未覆盖的新增功能可参考 `sa-token.cc` 官方文档补充。
- v1.31.0+：`StpUtil.login()` 不再自动校验账号封禁，需显式 `StpUtil.checkDisable()`。
- v1.29.0+：`StpUtil.renewTimeout(seconds)` 可续期 token。
- Reactor 依赖（WebFlux/Gateway）与 Servlet 依赖不可共存。
- `sa-token-jwt` 显式依赖 `hutool-jwt`，hutool 5.8.13/5.8.14 存在类型转换问题，建议避开。
