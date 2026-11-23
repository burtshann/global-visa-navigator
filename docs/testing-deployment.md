# 测试和部署

## 本地验证

使用 Node.js 22.12 或更新版本及 npm。

```bash
npm ci
npm run check
npm run build
```

`npm run check` 包含 ESLint、TypeScript 类型检查和 Vitest 自动化测试。`npm test` 可单独执行测试。GitHub Actions 工作流配置为在推送至 `main` 及拉取请求时运行检查和生产构建。

规则测试应覆盖必要条件的满足、明确缺口、答案未知、条件适用范围、经核验版本的选用及政策日期边界。修改规则时，为新口径添加能区分变动前后结果的测试。测试输入仅使用示例资料。

在浏览器中发起一次问卷评估，核对缺少德国认可资格答案时的解释，并打开结果中的官方来源。切换语言后确认状态、说明和比较表的内容一致。在窄屏检查目录和表单，使用键盘完成选择、提交和清空。

## Web 部署

在 Node.js 运行环境中使用与本地一致的版本和锁定依赖完成构建。

```bash
npm ci
npm run build
npm run start
```

Next.js 默认监听端口 `3000`。平台已有端口配置时，依照运行环境设置。通过托管平台或反向代理提供 HTTPS，部署后访问首页确认静态资源、语言切换和规则结果可用。Web 原型的公开目录和规则通过构建发布，无需连接数据库。

## PostgreSQL 初始化

下列命令向 PostgreSQL 16 或更新版本上的目标数据库应用首个政策模型迁移。`DATABASE_URL` 使用该环境的部署机密，且不得写入 Git。

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/001_policy.sql
```

迁移创建政策目录、版本、来源和变动审核所需的存储结构。Web 接入数据库、政策导入及审核界面属于后续工作。

在测试数据库应用迁移后，可用下列命令验证人工审核记录、政策版本切换和来源观察约束。脚本在事务中插入示例数据并回滚。

```bash
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f db/tests/001_policy_smoke.sql
```

## 官方来源变动检查

```bash
npm run policy:check
```

脚本读取 `db/policy-sources.baseline.json`，分别比较英国 Graduate 附录和德国居留法 §20a 的归一化正文指纹，并以 JSON 输出结果。退出码 `0` 表示与基准一致，`1` 表示至少一项发生变化，`2` 表示存在抓取、提取或基准错误。指纹变化可能来自正文调整或页面结构变化，覆盖范围限于基准中列出的正文。

出现变化或错误时，审核者应阅读政府原文，确认适用范围、生效日期和受影响的规则，记录来源与结论。复核后在 Git 变更中更新需要调整的规则、测试和基准指纹。脚本只输出观察结果，发布依据来自人工复核。

网络要求系统代理时，可在支持相关环境变量的 Node.js 版本中启用代理及系统证书，例如在 Node.js 24 中运行 `NODE_USE_ENV_PROXY=1 NODE_USE_SYSTEM_CA=1 npm run policy:check`。
