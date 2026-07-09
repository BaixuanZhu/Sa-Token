---
name: sa-token-dev
description: >-
  Sa-Token（cn.dev33）Java 权限认证框架的开发助手。当涉及 Sa-Token / SaToken 的登录认证、权限校验、角色鉴权、
  注解鉴权（@SaCheckLogin / @SaCheckPermission / @SaCheckRole / @SaCheckOr / @SaIgnore）、路由拦截鉴权
  （SaInterceptor / SaRouter）、Session 会话、StpUtil API、踢人下线、集成 Redis、前后端分离 token 传递、
  框架配置、以及 SSO 单点登录 / OAuth2 / 微服务网关鉴权 / 插件（JWT、API-Key 等）时使用。
  也适用于排查 NotLoginException 场景值、异常状态码、注解不生效、Redis 数据丢失、跨域、反代 uri 丢失等问题。
agent_created: true
---

# Sa-Token 开发助手

面向日常 Java 开发的 Sa-Token（当前稳定版 **1.45.0**）编码助手。采用「本地核心速查 + 在线文档兜底」的混合策略。

## 核心 API 速记（一行调用）

```java
StpUtil.login(id);                    // 登录
StpUtil.isLogin();                    // 是否登录
StpUtil.checkLogin();                 // 登录校验（未登录抛 NotLoginException）
StpUtil.getLoginId();                 // 取当前账号 id
StpUtil.logout();                     // 注销
StpUtil.checkPermission("user.add");  // 权限校验（失败抛 NotPermissionException）
StpUtil.checkRole("admin");           // 角色校验（失败抛 NotRoleException）
StpUtil.kickout(id);                  // 踢人下线
```

注解（需先注册 `SaInterceptor`）：`@SaCheckLogin`、`@SaCheckRole("admin")`、`@SaCheckPermission("user.add")`、`@SaCheckOr(...)`、`@SaIgnore`。

---

## 决策路由（先判场景，再决定读本地还是查在线）

### A. 高频核心 → 读本地 references/（离线可用，优先）

| 需求场景 | 读取文件 |
|---|---|
| 集成 SpringBoot、依赖、yml 配置、启动示例 | `references/01-setup.md` |
| 登录、登出、会话/token 查询、token 有效期(timeout/active-timeout) | `references/02-login-auth.md` |
| 权限码、角色、StpInterface 数据源、通配符 | `references/03-permission.md` |
| 注解鉴权（@SaCheck*、SaMode、orRole、@SaIgnore、@SaCheckOr） | `references/04-annotation.md` |
| 路由拦截鉴权（SaInterceptor / SaRouter / match / free / stop） | `references/05-interceptor-route.md` |
| Session 会话（Account/Token/Custom）、三大作用域 | `references/06-session.md` |
| 集成 Redis、前后端分离 token 传递 | `references/07-redis-frontsep.md` |
| StpUtil 常用 API 速查（登录/踢人/封禁/二级认证/身份切换等） | `references/08-api-stputil.md` |
| 排错：NotLoginException 场景值、异常码、注解不生效、跨域、反代 uri | `references/09-pitfalls.md` |

### B. 低频 / 易变模块 → 在线 fetch（保证最新）

在线索引：`https://baixuanzhu.github.io/Sa-Token/llms.txt`
全量聚合：`https://baixuanzhu.github.io/Sa-Token/llms-full.txt`
单篇规律：`https://baixuanzhu.github.io/Sa-Token/docs/<相对路径>`（相对路径见 llms.txt）

| 需求场景 | fetch 路径前缀 |
|---|---|
| 单点登录 SSO（Server 搭建、三种模式、单点注销等） | `docs/sso/*` |
| OAuth2.0（Server 搭建、scope、grant_type、OIDC 等） | `docs/oauth2/*` |
| 微服务（分布式 Session、网关统一鉴权、内网隔离） | `docs/micro/*` |
| 插件（JWT、API-Key、API 签名、Dubbo、gRPC、AOP、Thymeleaf 等） | `docs/plugin/*` |
| 深入进阶（二级认证、记住我、同端互斥、账号封禁、密码加密、多账号等） | `docs/up/*` |
| 完整配置项、Session 模型、异常码全表、防火墙等细节 | `docs/fun/*`、`docs/api/*` |
| WebFlux / Solon 环境集成 | `docs/start/*` |

**兜底原则：** 冷门 API、最新特性、本地 references 未覆盖的内容，一律 fetch 在线单篇；无法确定路径时先 fetch `llms.txt` 索引再定位。

---

## 使用流程

1. 判断需求属于 A（核心）还是 B（低频/易变）。
2. A → 读对应 `references/*.md`；B → fetch 对应在线单篇。
3. 给出代码时保持与 1.45.0 API 一致；涉及 SpringBoot 3.x/4.x 注意 starter 与 `spring.data.redis` 前缀差异。
4. 前端按钮级权限仅辅助，**后端接口必须再次校验**。

## 版本注意
- 依赖坐标 `cn.dev33:sa-token-*`，本地 references 基于 1.45.0。
- 若用户环境版本不同、或使用较新特性，以在线 llms.txt / 官方站 `sa-token.cc` 为准。
