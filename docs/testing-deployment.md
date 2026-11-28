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

## 浏览器端到端测试

```bash
npx playwright install chromium
npm run build
npm run test:e2e
```

Playwright 启动绑定本机回环地址的开发服务器，使用 Git 规则快照和固定的示例评估日期。测试覆盖中英文、移动端、目标匹配、缺少个人资料时的提示、规则状态以及浏览器内处理问卷的边界。GitHub Actions 单独验证生产构建，再安装 Chromium 并运行同一组浏览器测试。Linux 环境缺少浏览器依赖时，可用 `npx playwright install --with-deps chromium` 安装。使用已安装的系统 Chromium 时，可设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 为其可执行文件路径。

## Web 部署

在 Node.js 运行环境中使用与本地一致的版本和锁定依赖完成构建。

```bash
npm ci
npm run build
npm run start
```

在生产运行环境设置 `POLICY_DATABASE_URL`，使用属于 `gvn_policy_reader` 的独立登录账号。连接串中填写具体账号和数据库，并对远端数据库使用 `sslmode=verify-full`。托管机密仅注入服务端运行环境，使用数据库主机名和受信任的 TLS 证书。未配置连接、连接配置无效或数据库不可用时，生产界面仅提供目录。Git 快照供未连接数据库的本地开发和自动化测试使用。

Next.js 默认监听端口 `3000`。通过托管平台或反向代理提供 HTTPS。部署后检查首页、语言切换及已批准规则，确认运行环境只注入网页只读凭据。审批连接与数据库迁移连接仅在相应操作环境使用。

## PostgreSQL 初始化

使用 PostgreSQL 16 或更新版本。由持有迁移凭据的数据库对象所有者依次应用尚未执行过的迁移。第三次迁移还需要创建角色的权限。`GVN_MIGRATION_DATABASE_URL` 是下面命令使用的运维变量。

```bash
psql "$GVN_MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/001_policy.sql
psql "$GVN_MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/002_policy_publication.sql
psql "$GVN_MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/003_policy_permissions.sql
```

第三次迁移创建三组不允许直接登录的数据库角色。为网页服务和实际操作者分别创建登录账号，按职责授予一个组角色。下面是由数据库管理员在 `psql` 中执行的示例。使用 `\password` 在交互提示中设置密码，或由托管数据库提供商下发凭据。

```sql
CREATE ROLE gvn_web LOGIN;
CREATE ROLE gvn_policy_editor_a LOGIN;
CREATE ROLE gvn_policy_reviewer_b LOGIN;
GRANT gvn_policy_reader TO gvn_web;
GRANT gvn_policy_stager TO gvn_policy_editor_a;
GRANT gvn_policy_reviewer TO gvn_policy_reviewer_b;
\password gvn_web
\password gvn_policy_editor_a
\password gvn_policy_reviewer_b
```

| PostgreSQL 组角色 | 连接及权限 |
| --- | --- |
| `gvn_policy_reader` | `POLICY_DATABASE_URL`。只读已批准且符合身份审计的政策快照。 |
| `gvn_policy_stager` | `POLICY_EDITOR_DATABASE_URL`。查看审核队列，提交待审快照及依据。 |
| `gvn_policy_reviewer` | `POLICY_EDITOR_DATABASE_URL`。查看审核队列，批准或撤回快照并记录依据。 |

网页和操作者账号仅使用所需的组权限。保留对象所有者和迁移账号供维护。隔离的预览数据库使用自己的网页、入审和审批账号。若曾用旧版流程发布，旧审批记录仍可查阅。采用新权限后，以新版本提交并由另一位授权操作者批准，网页才会重新显示对应规则。

在独立测试数据库应用迁移后，可用下列命令验证人工审核记录、政策版本切换、来源观察约束和角色权限。脚本在事务中插入示例数据并回滚。

```bash
psql "$GVN_MIGRATION_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f db/tests/001_policy_smoke.sql
psql "$GVN_MIGRATION_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f db/tests/002_policy_publication_smoke.sql
psql "$GVN_MIGRATION_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f db/tests/003_policy_permissions_smoke.sql
```

GitHub Actions 同时在 PostgreSQL 16 服务上运行 `npm run test:db`。本地复现时，将 `POLICY_TEST_ADMIN_URL` 设置为一次性本地 PostgreSQL 实例的 `postgres` 数据库连接串，账号须能创建数据库和登录角色。该测试分别创建空库和带 M2 审批记录的数据库，执行迁移并以不同身份验证入审、独立批准、生产读取和撤回。

CI 还在生产构建上验证规则读取故障和恢复。完成生产构建并准备 Chromium 后，可设置 `POLICY_TEST_ASSESSMENT_RECOVERY=1` 随数据库套件运行。测试会暂停一次性数据库的新连接并断开应用读取会话，再恢复连接，检查刷新返回 503 时不显示过时结果、目录仍可浏览且问卷答案保留在当前标签页。

### 从 M2 切换政策发布权限

已有 M2 审批记录的数据库使用下列替换快照。各规则的政策条件和来源核验日期沿用原值。

| 路径 | 政策标识 | M2 版本 | 重新入审版本 |
| --- | --- | --- | --- |
| `uk-graduate` | `uk-graduate` | `2026-11-23.1` | `2026-11-26.1` |
| `de-opportunity-card` | `de-opportunity-card-skilled-worker` | `2026-11-23.2` | `2026-11-26.1` |
| `de-opportunity-card` | `de-opportunity-card-points` | `2026-11-23.2` | `2026-11-26.1` |

1. 在隔离的 M2 数据库副本演练升级，并按已有运维流程保留数据库备份和当前应用版本。准备待切换的 Git 版本和三种独立数据库登录。
2. 在维护窗口暂停对外的规则评估，再应用迁移 003。该迁移保留旧审批历史，生产只读视图从此忽略缺少独立身份审计的旧审批。
3. 从待部署的 Git 版本由入审者提交表中的新版本，再由独立审核者逐项核对并批准。确认只读账号可以读取新版本以及部署计划所需的已获批快照。
4. 由负责人切换应用版本和只读连接。在该版本验收审批版本、规则日期和对外评估后再恢复服务。空库安装依次应用 001 至 003，再直接以当前 Git 版本入审、批准及启用规则。

## 人工审核与发布

在已核对官方证据的 Git 版本中操作。分别为入审和审批操作设置相应账号的 `POLICY_EDITOR_DATABASE_URL`。数据库从登录会话记录操作者身份。使用 `<reference>` 关联 GitHub 审核或证据记录。

```text
npm run policy:review -- list
npm run policy:review -- stage <route-id> <policy-id> <reference>
npm run policy:review -- approve <route-id> <policy-id> <version> <reference>
npm run policy:review -- withdraw <route-id> <policy-id> <version> <reference>
```

`stage` 记录待审核的 Git 规则快照，执行前先提交 `src/data` 和 `src/domain` 的变更。审批人员核对待审版本、快照指纹、官方证据和测试后执行 `approve`。数据库要求审批登录与原入审登录不同。`withdraw` 撤回已发布版本或终止待审核版本，保留审核记录。应用仅显示当前有效、已批准且与部署快照一致的版本。新加坡 2027 年工资表使用独立政策标识，可提前入审和批准，到生效日才供评估。来源指纹变更或抓取失败只产生观察结果，发布状态仍由获授权的审核命令更新。

## iPhone 私人预览

在已授权的托管项目上，使用独立的 Preview 部署和隔离的 PostgreSQL 数据库。正式公开前只批准实际参与测试的账号或用户组。以 Vercel 为例，在创建 Preview 部署前启用 Vercel Authentication，只共享受保护的 Preview URL。Standard Protection 对 Production 域名的权限另行处理。私人测试期间保持 Preview 部署，不创建公开的 Production 部署或可绕过认证的分享链接。 [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection) · [Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication)

在 Preview 环境设置专用 `POLICY_DATABASE_URL`，用网页只读账号连接预览数据库。由独立的入审和审批账号处理所需版本。测试前以未登录会话确认应用页面和静态资源受保护，登录后确认可打开。预览使用测试数据，问卷无需录入姓名、证件或其他个人标识。完成测试后撤销不再需要的访问权限。

对于自托管环境，先在预览主机以生产模式构建并只监听回环地址。应用在下例使用端口 `3000`，网关默认使用 `3100`。

```bash
npm ci
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

在另一终端启动本机网关。设定 `PRIVATE_PREVIEW_PASSWORD` 为 32 至 128 字符的随机 Base64URL 密钥，通过机密管理器或交互输入注入环境。网关用户名默认 `preview`，可用 `PRIVATE_PREVIEW_USERNAME` 更改。`PRIVATE_PREVIEW_PORT` 与 `PRIVATE_PREVIEW_ORIGIN_PORT` 分别覆盖网关与应用端口。

```bash
read -r -s -p 'Private preview password: ' PRIVATE_PREVIEW_PASSWORD
export PRIVATE_PREVIEW_PASSWORD
node scripts/private-preview.mjs
unset PRIVATE_PREVIEW_PASSWORD
```

在本机测试 `http://127.0.0.1:3100`。未提供有效凭据应收到 `401`，使用正确凭据应打开应用。要让 iPhone 连接，使用已获授权的 HTTPS 反向代理或隧道，并只把它的上游接到网关。应用和网关的回环端口保持在主机内部，凭据通过独立的安全渠道交给测试人员。回环测试可验证网关，不会产生手机可用的 HTTPS 入口。

用 iPhone 的 Safari 在正常和私人浏览标签中分别验证授权与拒绝场景，完成中英文切换，选择技术工作目标并填写新加坡或英国的可选条件。确认可看见已核对项、未知项和完整资格提示，再比较目录条目、打开官方依据和清空答案。记录机型、iOS 版本、测试网址和可复现步骤。

## 官方来源变动检查

```bash
npm run policy:check
```

脚本读取 `db/policy-sources.baseline.json`，比较英国 Graduate 附录、德国居留法第 20a、20b、18g 条、法定积分附件及德国驻斯科普里使馆机会卡指引的归一化正文指纹，并以 JSON 输出结果。退出码 `0` 表示与基准一致，`1` 表示至少一项发生变化，`2` 表示存在抓取、提取或基准错误。指纹变化可能来自正文调整或页面结构变化，覆盖范围限于基准中列出的正文。

出现变化或错误时，审核者应阅读政府原文，确认适用范围、生效日期和受影响的规则，记录来源与结论。复核后在 Git 变更中更新需要调整的规则、测试和基准指纹。脚本只输出观察结果，发布依据来自人工复核。

网络要求系统代理时，可在支持相关环境变量的 Node.js 版本中启用代理及系统证书，例如在 Node.js 24 中运行 `NODE_USE_ENV_PROXY=1 NODE_USE_SYSTEM_CA=1 npm run policy:check`。
