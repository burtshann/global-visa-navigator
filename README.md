# Global Visa Navigator

Global Visa Navigator 是一个中英文签证路径查询和条件核对工具。用户可浏览九国的签证入口，并根据目标和可选个人资料，核对已有官方依据的申请条件。

## 运行

需要 Node.js 22.12 或更新的版本及 npm。

```bash
npm ci
npm run dev
```

打开 `http://localhost:3000`。可从页头切换简体中文和英文。

```bash
npm run check
npm run build
npm run start
```

`npm run check` 执行 ESLint、TypeScript 类型检查和自动化测试。单独执行测试使用 `npm test`。构建后用 `npm run start` 运行生产模式。生产模式需要有效的 `POLICY_DATABASE_URL` 才能提供已批准的规则，未连接时仍可浏览目录。

## 第三阶段

- 新加坡 Employment Pass 核对新申请的本地职位邀请和第一阶段固定月薪。按核对当天适用的工资表、申请时年龄和雇主行业核对月薪。新申请标准于 2027 年 1 月 1 日切换，使用新加坡日期。 [规则来源与范围](docs/data-model.md#第三阶段新加坡-employment-pass)
- 英国 Skilled Worker 核对首次主申请人的年龄、担保证明、雇主担保资质和 B2 英语证明。两个新增路径都保留完整资格待核实的提示。 [规则来源与范围](docs/data-model.md#第三阶段英国-skilled-worker)
- PostgreSQL 区分网页读取、政策入审和审批权限。审核记录使用独立数据库登录身份。正式生产环境通过只读凭据加载获批快照。 [生产与发布配置](docs/testing-deployment.md#web-部署)
- 私人预览使用受保护的 HTTPS 入口，供授权人员在 iPhone 上体验。 [预览配置与验收](docs/testing-deployment.md#iphone-私人预览)

## 第二阶段

- 提交问卷后，个人结果按已选目标列出可评估的路径。目录同时收录待核验条目，可继续浏览官方入口和比较路径。
- 结果分别说明目标相关性、已核对的条件和完整申请资格的核实范围。每项条件可显示已满足、明确缺口或需要补充的信息，并附来源与下一步行动。
- 新增德国机会卡境外首次申请的积分路径，使用学历及资格依据、语言、职业经验、申请时年龄和可证明的生活费来源。技术人才路径仍单独核对。 [规则覆盖和核验记录](docs/data-model.md#第二阶段德国机会卡积分路径)
- 已发布政策可经 PostgreSQL 服务层加载，政策内容仍通过 Git 版本和官方原始来源追溯。审核和发布由人工执行，来源差异检测仅生成观察结果。 [政策维护和部署](docs/testing-deployment.md)
- Playwright 覆盖中英文、手机视口、缺失资料和评估状态。 [本地与 CI 验证](docs/testing-deployment.md#浏览器端到端测试)

## 首轮范围

- 目录包含美国、加拿大、英国、德国、澳大利亚、新西兰、日本、韩国和新加坡的 19 个条目，覆盖技术工作、求职、技术移民、留学及留学后工作等路径类别。
- 问卷提供国籍、年龄、学历、职业、工作经验、语言、预算、工作邀请、目标及路径专项问题。规则样例使用专项答案。所有问题均可跳过，答案在当前标签页的内存中使用，刷新或关闭后清除。
- 英国 Graduate visa 核对提交申请时是否在英国，以及教育机构是否已通知英国内政部课程完成情况。 [英国 Graduate 规则](https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-graduate)
- 德国 Opportunity Card 的技术人才途径核对国籍范围、德国资格或获认可的外国资格，以及生活费用证明。 [德国政府申请指南](https://www.make-it-in-germany.com/en/visa-recognition/opportunity-card/job-search) · [德国居留法 §20a](https://www.gesetze-im-internet.de/aufenthg_2004/__20a.html)
- 结果区支持并排查看最多三条路径。初版评估范围限于已录入的申请条件，界面分别说明申请条件、邀请阶段和最终获批阶段。
- PostgreSQL 迁移和官方来源变动检查脚本可独立运行。Web 原型读取随 Git 提交的规则快照，变动检查结果须由人工复核。

## 项目文档

- [产品需求](docs/product.md)
- [架构设计](docs/architecture.md)
- [数据模型](docs/data-model.md)
- [测试和部署](docs/testing-deployment.md)
- [实施路线图](docs/roadmap.md)
