# Global Visa Navigator

Global Visa Navigator 是一个面向公众的中英文 Web 原型。用户填写可选的个人条件，浏览九国的签证入口，查看已录入条件的匹配结果、差距和政府依据。

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

`npm run check` 执行 ESLint、TypeScript 类型检查和自动化测试。单独执行测试使用 `npm test`。构建后用 `npm run start` 运行生产模式。

## 首轮范围

- 目录包含美国、加拿大、英国、德国、澳大利亚、新西兰、日本、韩国和新加坡的 19 个条目，覆盖技术工作、求职、技术移民、留学及留学后工作等路径类别。
- 问卷提供国籍、年龄、学历、职业、工作经验、语言、预算、工作邀请、目标及路径专项问题。规则样例使用专项答案。所有问题均可跳过，答案在当前标签页的内存中使用，刷新或关闭后清除。
- 英国 Graduate visa 核对提交申请时是否在英国，以及教育机构是否已通知英国内政部课程完成情况。 [英国 Graduate 规则](https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-graduate)
- 德国 Opportunity Card 的技术人才途径核对国籍范围、德国资格或获认可的外国资格，以及生活费用证明。 [德国政府申请指南](https://www.make-it-in-germany.com/en/visa-recognition/opportunity-card/job-search) · [德国居留法 §20a](https://www.gesetze-im-internet.de/aufenthg_2004/__20a.html)
- 结果区支持并排查看最多三条路径。通过检查表示用户回答满足已录入的规则。界面分别说明申请条件、邀请阶段和最终获批阶段，初版评估范围限于已录入的申请条件。
- PostgreSQL 迁移和官方来源变动检查脚本可独立运行。Web 原型读取随 Git 提交的规则快照，变动检查结果须由人工复核。

## 项目文档

- [产品需求](docs/product.md)
- [架构设计](docs/architecture.md)
- [数据模型](docs/data-model.md)
- [测试和部署](docs/testing-deployment.md)
- [实施路线图](docs/roadmap.md)
