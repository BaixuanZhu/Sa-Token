# 注解鉴权

> 将鉴权与业务分离。**前提：必须注册 SaInterceptor 拦截器，注解才生效。**

## 注解清单

- `@SaCheckLogin`：登录校验
- `@SaCheckRole("admin")`：角色校验
- `@SaCheckPermission("user.add")`：权限校验
- `@SaCheckSafe`：二级认证校验
- `@SaCheckHttpBasic` / `@SaCheckHttpDigest`：HTTP Basic/Digest 校验
- `@SaCheckDisable("comment")`：账号服务封禁校验
- `@SaCheckSign`：API 签名校验
- `@SaIgnore`：忽略校验（最高优先级）

## 1. 注册拦截器（必做）

```java
@Configuration
public class SaTokenConfigure implements WebMvcConfigurer {
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 注册 Sa-Token 拦截器，打开注解式鉴权
        registry.addInterceptor(new SaInterceptor()).addPathPatterns("/**");
    }
}
```

> 高版本 SpringBoot（≥2.6.x）若注册失效，类上额外加 `@EnableWebMvc`。

## 2. 使用注解

```java
@SaCheckLogin
@RequestMapping("info")
public String info() { return "查询用户信息"; }

@SaCheckRole("super-admin")
@RequestMapping("add")
public String add() { return "用户增加"; }

@SaCheckPermission("user-add")
@RequestMapping("add2")
public String add2() { return "用户增加"; }
```

> 注解可加在类上，代表对该类所有方法生效。

## 3. 校验模式 AND / OR

```java
@SaCheckPermission(value = {"user-add", "user-all"}, mode = SaMode.OR)  // 满足其一
```
- `SaMode.AND`：必须全部具有（默认）。
- `SaMode.OR`：具有其一即可。

## 4. 权限 or 角色 双重校验

```java
// 具备权限 user.add 或角色 admin 即可通过
@SaCheckPermission(value = "user.add", orRole = "admin")
```
- `orRole = "admin"`：需拥有 admin。
- `orRole = {"admin", "manager"}`：三者其一。
- `orRole = {"admin, manager"}`：必须同时具有。

## 5. 忽略认证 @SaIgnore

```java
@SaCheckLogin
@RestController
public class TestController {
    @SaIgnore   // 此接口允许游客访问
    @RequestMapping("getList")
    public SaResult getList() { return SaResult.ok(); }
}
```
- `@SaIgnore` 优先级最高，与其它鉴权注解同时出现时后者被忽略。
- 同时可忽略路由拦截鉴权（对自定义拦截器/过滤器不生效）。

## 6. 批量注解 @SaCheckOr

```java
@SaCheckOr(
    login = @SaCheckLogin,
    role = @SaCheckRole("admin"),
    permission = @SaCheckPermission("user.add")
)
@RequestMapping("test")
public SaResult test() { return SaResult.ok(); }
```
- 满足其中任一注解即通过。
- 多个鉴权注解并列写 = 天然 AND 关系（故无 `@SaCheckAnd`）。

## 扩展
- 在 Service 层用注解：在线 fetch `docs/plugin/aop-at.md`。
- 自定义鉴权注解：在线 fetch `docs/fun/custom-annotations.md`。
