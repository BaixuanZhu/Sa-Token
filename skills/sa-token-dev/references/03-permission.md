# 权限认证与角色认证

> 核心：实现 `StpInterface` 告诉框架每个账号拥有的「权限码」和「角色」集合，再用 `StpUtil.checkXxx` 校验。

## 1. 实现权限数据源 StpInterface（必做）

```java
@Component  // 必须被 SpringBoot 扫描
public class StpInterfaceImpl implements StpInterface {

    // 返回一个账号拥有的权限码集合
    @Override
    public List<String> getPermissionList(Object loginId, String loginType) {
        // 实际项目按业务查库
        List<String> list = new ArrayList<>();
        list.add("user.add");
        list.add("user.update");
        list.add("art.*");
        return list;
    }

    // 返回一个账号拥有的角色标识集合
    @Override
    public List<String> getRoleList(Object loginId, String loginType) {
        List<String> list = new ArrayList<>();
        list.add("admin");
        list.add("super-admin");
        return list;
    }
}
```

- `loginId`：即 `StpUtil.login(id)` 写入的唯一标识。
- `loginType`：账号体系标识（多账号认证用，单账号可忽略）。
- 该接口不在启动时执行，每次鉴权时才调用。

## 2. 权限校验 API

```java
StpUtil.getPermissionList();                    // 当前账号权限集合
StpUtil.hasPermission("user.add");              // 判断，返回 true/false
StpUtil.checkPermission("user.add");            // 校验，失败抛 NotPermissionException
StpUtil.checkPermissionAnd("user.add", "user.get");  // 必须全部通过
StpUtil.checkPermissionOr("user.add", "user.get");   // 满足其一即可
```

## 3. 角色校验 API（与权限独立）

```java
StpUtil.getRoleList();
StpUtil.hasRole("super-admin");            // 返回 true/false
StpUtil.checkRole("super-admin");          // 失败抛 NotRoleException
StpUtil.checkRoleAnd("super-admin", "shop-admin");
StpUtil.checkRoleOr("super-admin", "shop-admin");
```

## 4. 权限通配符

```java
// 拥有 art.*
StpUtil.hasPermission("art.add");     // true
StpUtil.hasPermission("goods.add");   // false

// 拥有 *.delete
StpUtil.hasPermission("user.delete"); // true

// 拥有 "*" —— 通过任何权限码（角色同理）
```

## 5. 全局异常拦截

鉴权失败抛出的异常不可直接给用户看，统一拦截：
```java
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler
    public SaResult handler(Exception e) {
        e.printStackTrace();
        return SaResult.error(e.getMessage());
    }
}
```

> `NotPermissionException` / `NotRoleException` 均可通过 `getLoginType()` 获取是哪个 StpLogic 抛出。

## 要点
- 前端按钮级权限只是辅助显示，**后端接口必须再次校验**，前端校验可被轻松绕过。
