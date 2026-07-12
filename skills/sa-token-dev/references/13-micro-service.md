# 微服务架构

> 适用于 Sa-Token 1.45.0+（1.40.x 及以上，核心 API 向后兼容）。本文覆盖分布式 Session、网关统一鉴权、内部服务隔离（Same-Token）、依赖引入规则。

## 1. 依赖引入规则（关键）

> **核心原则：网关和内部服务必须分开引入 Sa-Token 依赖。不要在顶级父 pom 中统一引入。**

### 1.1 两个核心依赖

| 依赖 artifactId | 适用模型 | 适用场景 |
|---|---|---|
| `sa-token-spring-boot-starter` | Servlet (SpringMVC) | 内部基础服务、Zuul 网关 |
| `sa-token-reactor-spring-boot-starter` | Reactor (WebFlux) | SpringCloud Gateway、ShenYu |

### 1.2 SpringBoot 版本对应

| SpringBoot | Servlet 依赖 | Reactor 依赖 |
|---|---|---|
| 2.x | `sa-token-spring-boot-starter` | `sa-token-reactor-spring-boot-starter` |
| 3.x | `sa-token-spring-boot3-starter` | `sa-token-reactor-spring-boot3-starter` |
| 4.x | `sa-token-spring-boot4-starter` | `sa-token-reactor-spring-boot4-starter` |

### 1.3 不可混用

> **`sa-token-spring-boot-starter` 和 `sa-token-reactor-spring-boot-starter` 不可同时引入同一项目，否则项目无法启动。**

### 1.4 Redis 集成（必须）

网关和子服务通过 Redis 同步会话数据，Redis 集成包必须引入：
```xml
<!-- 版本号请使用最新稳定版，1.40.x+ 均适用；各 sa-token-* 依赖版本保持一致 -->
<dependency>
    <groupId>cn.dev33</groupId>
    <artifactId>sa-token-redis-template</artifactId>
    <version>1.45.0</version>
</dependency>
<dependency>
    <groupId>org.apache.commons</groupId>
    <artifactId>commons-pool2</artifactId>
</dependency>
```

> SpringBoot 3.x：Redis 前缀用 `spring.data.redis`。

---

## 2. 分布式 Session 会话

### 2.1 问题

微服务多节点部署时，单机 Session 无法跨节点共享。用户在节点 A 登录，下次请求落在节点 B 时认为未登录。

### 2.2 四种方案对比

| 方案 | 描述 | 评价 |
|---|---|---|
| Session 同步 | 节点数据改变时强制同步 | 性能消耗大，不推荐 |
| Session 粘滞 | 网关保证请求稳定落在同一节点 | 与框架无关，网关层处理 |
| **会话中心（Redis）** | Session 存 Redis，节点无状态 | **Sa-Token 推荐** |
| 无状态 Token（JWT） | 用户数据写入 Token 本身 | 功能受限，复杂业务不适用 |

### 2.3 实现

引 `sa-token-redis-template` + 配置 Redis 连接即可。所有上层 API 不变，框架自动将数据存入 Redis。

```yaml
spring:
  data:           # SB3.x
    redis:
      host: 127.0.0.1
      port: 6379
      database: 1
```

### 2.4 架构流程

```
用户请求 → 负载均衡 → 节点A / 节点B / 节点C
                         ↓        ↓        ↓
                         ──→ Redis 会话中心 ←──
```

1. 用户在任意节点登录，Session 写入 Redis
2. 后续请求落在任意节点，均从 Redis 读取 Session
3. 所有节点无状态，可自由横向扩展

### 2.5 最佳实践
- 推荐 Redis 方案（方案三），比 JWT 功能更完整。
- JWT Stateless 模式虽无状态，但不支持踢人/Session/active-timeout（见 `14-plugin.md` §1）。
- 如需权限缓存与业务缓存隔离，用 Alone-Redis 插件（见 `14-plugin.md` §6）。

---

## 3. 网关统一鉴权

### 3.1 两种模式

| 模式 | 描述 |
|---|---|
| 各服务各自鉴权 | 与单体应用差别不大 |
| **网关统一鉴权** | 网关集中处理所有鉴权逻辑（推荐） |

### 3.2 依赖（SpringCloud Gateway 为例）

```xml
<!-- Reactor 依赖（Gateway 是 WebFlux 模型） -->
<dependency>
    <groupId>cn.dev33</groupId>
    <artifactId>sa-token-reactor-spring-boot-starter</artifactId>
    <version>1.45.0</version>
</dependency>
<!-- Redis（必须） -->
<dependency>
    <groupId>cn.dev33</groupId>
    <artifactId>sa-token-redis-template</artifactId>
    <version>1.45.0</version>
</dependency>
<dependency>
    <groupId>org.apache.commons</groupId>
    <artifactId>commons-pool2</artifactId>
</dependency>
```

### 3.3 实现 StpInterface（权限数据源）

```java
@Component
public class StpInterfaceImpl implements StpInterface {
    @Override
    public List<String> getPermissionList(Object loginId, String loginType) {
        // 方案一：网关集成 ORM 直接查库
        // 方案二：先查 Redis 缓存，未命中查库
        // 方案三：先查 Redis，未命中 RPC 调子服务
        return ...;
    }

    @Override
    public List<String> getRoleList(Object loginId, String loginType) {
        return ...;
    }
}
```

### 3.4 注册全局过滤器

```java
@Configuration
public class SaTokenConfigure {

    @Bean
    public SaReactorFilter getSaReactorFilter() {
        return new SaReactorFilter()
            .addInclude("/**")
            .addExclude("/favicon.ico")
            .setAuth(obj -> {
                // 登录校验
                SaRouter.match("/**", "/user/doLogin", r -> StpUtil.checkLogin());

                // 按模块校验权限
                SaRouter.match("/user/**", r -> StpUtil.checkPermission("user"));
                SaRouter.match("/admin/**", r -> StpUtil.checkPermission("admin"));
                SaRouter.match("/goods/**", r -> StpUtil.checkPermission("goods"));
            })
            .setError(e -> {
                return SaResult.error(e.getMessage());
            });
    }
}
```

### 3.5 架构流程

```
客户端请求
    │
    ▼
SpringCloud Gateway
    │
    ▼
SaReactorFilter（全局过滤器）
    │  1. 拦截 /** 所有路径
    │  2. 排除公开路径（登录接口等）
    │  3. 登录校验 → 权限校验
    │  4. 异常 → setError → SaResult
    │
    ▼
下游子服务（无需重复鉴权）
```

### 3.6 最佳实践
- **Redis 必须**：网关通过 Redis 与子服务同步会话。
- **Reactor 依赖**：Gateway 用 `sa-token-reactor-spring-boot-starter`，不能用 Servlet 依赖。
- **登录接口排除**：`/user/doLogin` 需排除在登录校验之外。
- **setError 必须**：过滤器异常不进 `@ExceptionHandler`。
- 子服务无需重复鉴权（网关已校验），但建议保留注解作为二次防线。

---

## 4. 内部服务外网隔离（Same-Token）

### 4.1 需求场景

子服务不应被外网直接访问，必须通过网关转发。

| 隔离方式 | 描述 |
|---|---|
| 物理隔离 | 子服务部署内网，仅网关对外 |
| 逻辑隔离 | 子服务有权限拦截层，只接受网关请求（Same-Token 方案） |

### 4.2 两个环节

| 环节 | 描述 |
|---|---|
| 网关转发鉴权 | 网关转发请求时携带 Same-Token，子服务校验 |
| 服务间内部调用 | Feign 等 RPC 调用时携带 Same-Token |

### 4.3 环节一：网关转发鉴权

**网关添加 GlobalFilter**：
```java
@Component
public class ForwardAuthFilter implements GlobalFilter {
    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest newRequest = exchange.getRequest().mutate()
            .header(SaSameUtil.SAME_TOKEN, SaSameUtil.getToken())
            .build();
        return chain.filter(exchange.mutate().request(newRequest).build());
    }
}
```

**子服务校验 Same-Token**：
```java
@Configuration
public class SaTokenConfigure {
    @Bean
    public SaServletFilter getSaServletFilter() {
        return new SaServletFilter()
            .addInclude("/**")
            .addExclude("/favicon.ico")
            .setAuth(obj -> {
                // 简化写法：
                SaSameUtil.checkCurrentRequestToken();
                // 等价于：
                // String token = SaHolder.getRequest().getHeader(SaSameUtil.SAME_TOKEN);
                // SaSameUtil.checkToken(token);
            })
            .setError(e -> SaResult.error(e.getMessage()));
    }
}
```

### 4.4 环节二：服务间 Feign 调用

**调用方添加 FeignInterceptor**：
```java
@Component
public class FeignInterceptor implements RequestInterceptor {
    @Override
    public void apply(RequestTemplate requestTemplate) {
        // 添加 Same-Token
        requestTemplate.header(SaSameUtil.SAME_TOKEN, SaSameUtil.getToken());

        // 如需被调用方有会话状态，还需传递 satoken
        // requestTemplate.header(StpUtil.getTokenName(), StpUtil.getTokenValue());
    }
}
```

**Feign 接口使用**：
```java
@FeignClient(
    name = "sp-home",
    configuration = FeignInterceptor.class,
    fallbackFactory = SpHomeFallback.class
)
public interface SpHomeInterface {
    @RequestMapping("/api/getConfig")
    String getConfig(@RequestParam("key") String key);
}
```

### 4.5 SaSameUtil API

| 方法 | 说明 |
|---|---|
| `getToken()` | 获取当前 Same-Token |
| `isValid(token)` | 判断是否有效 |
| `checkToken(token)` | 校验（无效抛异常） |
| `checkCurrentRequestToken()` | 校验当前请求的 Same-Token |
| `refreshToken()` | 刷新 Token |
| `SaSameUtil.SAME_TOKEN` | 储存 key 常量 |

### 4.6 Same-Token 刷新机制

- Token 默认存 Redis，有效期一天。
- **旧 Token 保留一个刷新周期**作为次级 Token，防止刷新瞬间服务中断。
- **生产环境**：专门起一个服务用定时任务刷新，不要多服务同时刷新：
```java
@Scheduled(cron = "0 0/5 * * * ?")
public void refreshToken() {
    SaSameUtil.refreshToken();
}
```

### 4.7 最佳实践
- **物理隔离优于逻辑隔离**：条件允许时子服务部署内网。
- **Same-Token 刷新集中化**：一个服务定时刷新，不要多服务同时调 `refreshToken()`。
- **刷新间隔**：须低于有效期（默认一天），建议 5 分钟 ~ 2 小时。
- **Feign 如需会话状态**：除 Same-Token 外还需传 `satoken`。
- **子服务校验可简化**：`SaSameUtil.checkCurrentRequestToken()` 一行搞定。

---

## 5. 依赖汇总速查

| 场景 | artifactId | 说明 |
|---|---|---|
| 内部服务 (SB2.x) | `sa-token-spring-boot-starter` | Servlet |
| 内部服务 (SB3.x) | `sa-token-spring-boot3-starter` | Servlet |
| 网关 (SB2.x) | `sa-token-reactor-spring-boot-starter` | Reactor |
| 网关 (SB3.x) | `sa-token-reactor-spring-boot3-starter` | Reactor |
| Redis 集成 | `sa-token-redis-template` | 必须 |
| 连接池 | `commons-pool2` | 必须 |
| HTTP 工具 | `sa-token-forest` | SSO 模式三需要 |
| 独立 Redis | `sa-token-alone-redis` | 缓存隔离 |

> **关键提醒**：Servlet 和 Reactor 依赖不可共存。微服务架构中网关用 Reactor，子服务用 Servlet，各自单独引入。
