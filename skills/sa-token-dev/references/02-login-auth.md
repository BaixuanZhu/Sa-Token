# 登录认证

> 核心：登录本质是把「唯一标识 userId」交给框架，框架生成 token + session 并返回前端。

## 1. 登录

```java
// 参数为账号 id，建议类型：long | int | String，不可传 User/Admin 等复杂对象
StpUtil.login(Object userId);
```

典型登录接口：
```java
@RequestMapping("doLogin")
public SaResult doLogin(String name, String pwd) {
    if ("zhang".equals(name) && "123456".equals(pwd)) {   // 真实项目查库比对
        StpUtil.login(10001);
        return SaResult.ok("登录成功");
    }
    return SaResult.error("登录失败");
}
```

## 2. 校验是否登录

```java
StpUtil.isLogin();     // 返回 true/false
StpUtil.checkLogin();  // 未登录则抛出 NotLoginException
```

配合全局异常处理器统一返回：
```java
@RestControllerAdvice
public class GlobalException {
    @ExceptionHandler(NotLoginException.class)
    public SaResult handler(NotLoginException e) {
        return SaResult.error(e.getMessage());
    }
}
```

> `NotLoginException` 有 7 种场景值（未提交/无效/过期/被顶/被踢/被冻结/无前缀），精细化处理见 `09-pitfalls.md`。

## 3. 会话查询

```java
StpUtil.getLoginId();              // 未登录抛异常
StpUtil.getLoginIdAsString();     // 转 String
StpUtil.getLoginIdAsInt();        // 转 int
StpUtil.getLoginIdAsLong();       // 转 long
StpUtil.getLoginIdDefaultNull();  // 未登录返回 null
StpUtil.getLoginId(T defaultValue); // 未登录返回默认值
```

## 4. Token 查询

```java
StpUtil.getTokenValue();               // 当前会话 token 值
StpUtil.getTokenName();                // token 名称
StpUtil.getLoginIdByToken(tokenValue); // token 反查账号 id，无效返回 null
StpUtil.getTokenTimeout();             // 剩余有效期（秒，-1=永久）
StpUtil.getTokenInfo();                // token 详细参数 SaTokenInfo
```

## 5. 注销

```java
StpUtil.logout();
```

## Token 有效期：timeout vs active-timeout
- `timeout`：长久有效期（默认 30 天）。到期必须重新登录。v1.29.0+ 可用 `StpUtil.renewTimeout(seconds)` 续期。`-1` 永久。
- `active-timeout`：最低活跃频率。超过此时长无操作则被「冻结」（非删除）。有操作自动续签。`-1` 不限制。
- 两者独立，任一过期 token 即不可用。
- 自动续签：框架在直接/间接调用 `getLoginId()`、`getTokenSession()`（含 `checkLogin`、`hasRole`、`checkPermission` 及 `@SaCheckLogin` 等注解）时执行冻结检查与续签。
- 手动续签：
```java
StpUtil.checkActiveTimeout();     // 检查是否已冻结，是则抛异常
StpUtil.updateLastActiveToNow();  // 续签（更新最后操作时间）
```
- 关闭自动续签：配置 `autoRenew=false`。
