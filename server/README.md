# AI Summary Assistant - Java 后端

Spring Boot 3 + MyBatis-Plus + MySQL 8 + Spring Security + JWT

## 环境要求

- Java 21
- Maven 3.8+
- MySQL 8.x

## 快速启动

### 1. 创建数据库

登录 MySQL，执行 `sql/schema.sql` 建库建表：

```bash
mysql -u root -p < sql/schema.sql
```

### 2. 修改配置

编辑 `src/main/resources/application.yml`，修改数据库连接信息：

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/ai_summary?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true
    username: root        # 改成你的 MySQL 用户名
    password: 123456      # 改成你的 MySQL 密码
```

### 3. 启动

```bash
cd server
mvn spring-boot:run
```

服务启动后访问 http://localhost:8080

## API 接口

| 方法   | 路径                              | 说明              | 需要登录 |
|--------|-----------------------------------|-------------------|----------|
| POST   | /api/auth/register                | 用户注册          | 否       |
| POST   | /api/auth/login                   | 用户登录，返回JWT | 否       |
| GET    | /api/auth/me                      | 获取当前用户信息  | 是       |
| POST   | /api/summaries                    | 保存摘要          | 是       |
| GET    | /api/summaries?page=&size=&keyword=&sourceType=&tagId= | 分页查询历史 | 是 |
| GET    | /api/summaries/{id}               | 查看摘要详情      | 是       |
| DELETE | /api/summaries/{id}               | 删除摘要          | 是       |
| POST   | /api/summaries/{id}/tags          | 给摘要加标签      | 是       |
| DELETE | /api/summaries/{id}/tags/{tagId}  | 移除摘要标签      | 是       |
| GET    | /api/tags                         | 获取所有标签      | 是       |
| POST   | /api/tags                         | 创建标签          | 是       |
| DELETE | /api/tags/{id}                    | 删除标签          | 是       |

需要登录的接口在请求头中携带：`Authorization: Bearer <token>`

## 项目结构

```
server/src/main/java/com/example/aisummary/
├── AiSummaryApplication.java      # 启动类
├── config/
│   ├── SecurityConfig.java        # Spring Security + JWT 配置
│   ├── JwtAuthFilter.java         # JWT 认证过滤器
│   ├── CorsConfig.java            # 跨域配置
│   ├── MyBatisPlusConfig.java     # 分页插件 + 自动填充
│   └── GlobalExceptionHandler.java # 全局异常处理
├── controller/
│   ├── AuthController.java        # 认证接口
│   ├── SummaryController.java     # 摘要 CRUD 接口
│   └── TagController.java         # 标签接口
├── service/
│   ├── AuthService.java           # 认证业务逻辑
│   ├── SummaryService.java        # 摘要业务逻辑
│   └── TagService.java            # 标签业务逻辑
├── mapper/
│   ├── UserMapper.java
│   ├── SummaryMapper.java
│   ├── SummaryTagMapper.java
│   └── TagMapper.java
├── entity/
│   ├── User.java
│   ├── Summary.java
│   ├── Tag.java
│   └── SummaryTag.java
├── dto/
│   ├── LoginRequest.java
│   ├── RegisterRequest.java
│   ├── AuthResponse.java
│   ├── SummaryRequest.java
│   ├── SummaryResponse.java
│   ├── TagRequest.java
│   └── Result.java
└── util/
    └── JwtUtil.java
```
