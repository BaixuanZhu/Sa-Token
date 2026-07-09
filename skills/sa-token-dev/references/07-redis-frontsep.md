# 集成 Redis 与前后端分离

## 一、集成 Redis

默认数据存内存（最快，但重启丢失、无法分布式共享）。集成 Redis 做到重启不丢 + 多节点会话一致。

### 1. 依赖

```xml
<!-- Sa-Token 整合 RedisTemplate（官方推荐） -->
<dependency>
    <groupId>cn.dev33</groupId>
    <artifactId>sa-token-redis-template</artifactId>
    <version>1.45.0</version>
</dependency>
<!-- Redis 连接池 -->
<dependency>
    <groupId>org.apache.commons</groupId>
    <artifactId>commons-pool2</artifactId>
</dependency>
```

Gradle：`implementation 'cn.dev33:sa-token-redis-template:1.45.0'`

> Redis 集成包版本尽量与 sa-token-starter 一致，否则可能兼容性问题。

### 2. 配置 Redis 连接（必须）

```yaml
spring:
  redis:
    database: 1
    host: 127.0.0.1
    port: 6379
    # password:
    timeout: 10s
    lettuce:
      pool:
        max-active: 200
        max-wait: -1ms
        max-idle: 10
        min-idle: 0
```

> **SpringBoot 3.x：前缀 `spring.redis` 改为 `spring.data.redis`。**

### 3. 要点
- 引入依赖 + 配好 Redis 连接即可，**框架自动保存**，所有上层 API 不变。
- 默认以 JSON 格式存储（Jackson）。可换 Fastjson/Fastjson2/Snack3（引对应 `sa-token-fastjson2` 等依赖）；或自定义 String 序列化（`SaManager.setSaSerializerTemplate(...)`）。

---

## 二、前后端分离（无 Cookie 模式）

App/小程序无 Cookie，需手动传递 token：后端返回 token，前端存本地，每次请求塞进 header。

### 1. 后端返回 token

```java
@RequestMapping("doLogin")
public SaResult doLogin() {
    StpUtil.login(10001);
    SaTokenInfo tokenInfo = StpUtil.getTokenInfo();  // 含 tokenName 与 tokenValue
    return SaResult.data(tokenInfo);
}
```

### 2. 前端提交 token（塞进 header，格式 {tokenName: tokenValue}）

```js
// uni-app 示例
uni.request({
    url: 'https://www.example.com/request',
    header: {
        "content-type": "application/x-www-form-urlencoded",
        "satoken": uni.getStorageSync('tokenValue')  // 参数名即 tokenName，默认 satoken
    },
    success: (res) => { console.log(res.data); }
});
```

更灵活写法（tokenName 也从后端返回值动态取）：
```js
var header = { "content-type": "application/x-www-form-urlencoded" };
var tokenName = uni.getStorageSync('tokenName');
var tokenValue = uni.getStorageSync('tokenValue');
if (tokenName) header[tokenName] = tokenValue;
```

> token 传递逻辑应封装进统一请求函数，避免每个请求重复写。
> 本质上 Cookie 只是一个特殊 header，无 Cookie 模式即手动模拟这一过程。
