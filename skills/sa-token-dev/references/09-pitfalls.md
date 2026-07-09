# 常见坑与排错

## 1. NotLoginException 场景值

未登录时获取 loginId 会抛 `NotLoginException`，同为未登录有 7 种场景：

| 场景值 | 常量 | 含义 |
|---|---|---|
| -1 | `NOT_TOKEN` | 未从请求读到 token |
| -2 | `INVALID_TOKEN` | token 无效 |
| -3 | `TOKEN_TIMEOUT` | token 已过期 |
| -4 | `BE_REPLACED` | token 已被顶下线 |
| -5 | `KICK_OUT` | token 已被踢下线 |
| -6 | `TOKEN_FREEZE` | token 已被冻结（active-timeout 超时）|
| -7 | `NO_PREFIX` | 未按指定前缀提交 token |

定制化处理：
```java
@ExceptionHandler(NotLoginException.class)
public SaResult handler(NotLoginException nle) {
    String msg;
    if (nle.getType().equals(NotLoginException.NOT_TOKEN))        msg = "未读取到有效 token";
    else if (nle.getType().equals(NotLoginException.INVALID_TOKEN)) msg = "token 无效";
    else if (nle.getType().equals(NotLoginException.TOKEN_TIMEOUT)) msg = "token 已过期";
    else if (nle.getType().equals(NotLoginException.BE_REPLACED))   msg = "token 已被顶下线";
    else if (nle.getType().equals(NotLoginException.KICK_OUT))      msg = "token 已被踢下线";
    else if (nle.getType().equals(NotLoginException.TOKEN_FREEZE))  msg = "token 已被冻结";
    else if (nle.getType().equals(NotLoginException.NO_PREFIX))     msg = "未按指定前缀提交 token";
    else msg = "当前会话未登录";
    return SaResult.error(msg);
}
```

## 2. 异常细分状态码 code

所有异常继承 `SaTokenException`，均可 `e.getCode()` 获取细分码，用于同类异常的不同情形区分（尤其 SSO/OAuth2）。

```java
@ExceptionHandler(SaTokenException.class)
public SaResult handler(SaTokenException e) {
    if (e.getCode() == 30001) return SaResult.error("redirect url 无效");
    if (e.getCode() == 30004) return SaResult.error("ticket 无效");
    return SaResult.error("服务器繁忙");
}
```

常用码段：核心包 11011~11016（token 无效/过期/被顶/被踢/冻结）、11041 缺角色、11051 缺权限、11071 二级认证未过；SSO 30001~30011；OAuth2 30101+；JWT 30201+。完整表在线 fetch `docs/fun/exception-code.md`。

## 3. 注解不生效

排查顺序：
1. 是否注册了 `SaInterceptor`（注解鉴权依赖它，默认关闭）。见 `04-annotation.md`。
2. 高版本 SpringBoot（≥2.6.x）配置类是否加了 `@EnableWebMvc`。
3. 注解是否被写在被 Spring 管理的 Bean（Controller）上。

## 4. SaSession 取不到值

`SaSession` 与 `HttpSession` 无关，互不通。全程只用 `SaSession`（`StpUtil.getSession()`），勿混用 `HttpSession`。

## 5. Redis 集成后仍丢数据 / 报错

- 是否配置了 Redis 连接信息（仅引依赖不够）。
- SpringBoot 3.x 前缀须为 `spring.data.redis`。
- Redis 集成包版本与 starter 版本尽量一致。

## 6. 跨域 CORS

前后端分离常见。Sa-Token 官方给出跨域处理参考（过滤器/配置层面），需要时在线 fetch `docs/fun/cors-filter.md`。

## 7. 反向代理后 uri 丢失

Nginx 反代后 `SaHolder.getRequest().getUrl()` 可能不对（影响 SSO 等）。两种方案：
- Nginx 加 `proxy_set_header Public-Network-URL http://$http_host$request_uri;` 并重写 `SaTokenContext.getRequest().getUrl()`。
- 或直接在 yml 配置 `sa-token.curr-domain: http://your-domain/api`。

详见在线 `docs/fun/curr-domain.md`。
