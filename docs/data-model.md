# 数据模型

## 公开目录与政策

`db/migrations/001_policy.sql` 定义以下 PostgreSQL 表。第二次迁移为政策发布补充快照和审核流程，保留首轮表及数据。

| 实体 | 主键和引用 | 主要字段 |
| --- | --- | --- |
| `country` | 两位国家代码 | 中英文名称、官方签证入口 |
| `visa_route` | 路径标识，关联国家 | 中英文名称和描述、路径类别、官方申请指南 |
| `official_source` | 来源标识，关联国家 | 唯一的官方 URL、主管机关、来源标题 |
| `policy_version` | 版本记录标识，关联路径 | 政策键、版本号、判定阶段和范围、审核状态、审核人、审核时间及审核依据 |
| `policy_condition` | 政策版本与条件键，关联来源 | 输入键、比较运算符、预期值、显示顺序、条件和行动说明、原文定位、适用范围、生效起止日期、核验时间和状态 |
| `source_observation` | 观察记录标识，关联来源 | 观察时间、正文归一化版本、基准和观察指纹、变化或错误状态 |
| `source_review` | 观察记录标识 | 人工处置结果、审核人、审核时间、审核依据和说明 |
| `policy_publication_event` | 发布审核记录标识，关联政策版本 | 状态变更、审核人、审核依据、记录时间 |

国家和路径标识在显示名称更新时保持稳定。每组路径、政策键和阶段至多有一个获批版本。切换版本时在同一事务内停用前一版并批准后继版本。已撤回的版本及其审核依据留在数据库中。服务层要求已批准版本与部署的 Git 快照内容一致才会提供相应规则。

`db/migrations/002_policy_publication.sql` 为政策版本添加 Git 提交、SHA-256 指纹和 JSON 规则快照。开始审核后的规则快照保持原样，修订以新版本提交。

规则分别记录政策生效日期和来源核验时间。核验时间表示打开并核对原文的时间。生效日期以官方资料所载日期为准，失效日期采用不包含当日的上界。当官方来源无法确认日期时字段可为空，核验记录应说明原因。页面更新时间、首次看到页面的日期和代码提交时间均不能作为生效日期的依据。

### 首批规则核验记录

核验日期为 2026 年 11 月 23 日。`src/data/policies.ts` 记录了本次核对所用的规则版本和逐项依据。

- 英国 Graduate。GR 1.2(d) 规定递交申请时在英国境内，GR 4.2–4.3 涉及课程完成与教育机构通知。HC 1248 规定这一路径自 2021 年 7 月 1 日实施。若未收到通知，个案工作人员在指引所述情形下可向教育机构查询。 [现行 Graduate 附录](https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-graduate) · [生效依据 HC 1248](https://www.gov.uk/government/publications/statement-of-changes-to-the-immigration-rules-hc-1248-4-march-2021) · [通知处理指引](https://www.gov.uk/government/publications/graduate-caseworker-guidance/graduate-caseworker-guidance-accessible-version)
- 德国机会卡。第 20a(3)(1) 条和第 18(3) 条涉及首次申请的技术人才选项和资格认定，第 20a(4) 条涉及生活保障及境内申请的附加条件。国籍筛查依据政府入境指引。修法第 3(3) 条增设第 20a 条，依第 12(4) 条于 2024 年 6 月 1 日生效。 [现行第 20a 条](https://www.gesetze-im-internet.de/aufenthg_2004/__20a.html) · [机会卡申请指南](https://www.make-it-in-germany.com/en/visa-recognition/opportunity-card/job-search) · [按国籍划分的入境指引](https://www.make-it-in-germany.com/en/visa-recognition/apply-for-visa) · [联邦法律公报](https://www.recht.bund.de/bgbl/1/2023/217/regelungstext.pdf?__blob=publicationFile&v=2)

### 第二阶段德国机会卡积分路径

2026 年 11 月 23 日核对 §20a、§20b、法定积分附件及政府申请指引。`src/data/de-opportunity-card.ts` 按条件保存证据、适用范围和日期。新规则适用于非欧盟及非欧洲自由贸易联盟国籍人士从境外首次申请的积分机制。§20a(3)(1) 的技术人才机制保留独立核对。条款于 2024 年 6 月 1 日生效。境内申请、续期、其他居留条件和申请证明仍需单独核实。 [§20a](https://www.gesetze-im-internet.de/aufenthg_2004/__20a.html) · [§20b](https://www.gesetze-im-internet.de/aufenthg_2004/__20b.html) · [法定积分附件](https://www.gesetze-im-internet.de/aufenthg_2004/anlage.html) · [生效依据](https://www.recht.bund.de/bgbl/1/2023/217/regelungstext.pdf?__blob=publicationFile&v=2)

- **申请门槛**包括有官方依据的境外学位或职业资格、法定替代资格、具备证明的德语至少 A1 或英语至少 B2、生活费保障及至少六分。境外资格按颁发国的承认方式核实，职业资格通常要求至少两年培训。符合条文的德国海外商会资格或德国主管机构的认可决定可作为替代依据。 [官方条件说明](https://www.make-it-in-germany.com/en/visa-recognition/opportunity-card/job-search) · [§20b](https://www.gesetze-im-internet.de/aufenthg_2004/__20b.html)
- **积分**按官方附件核对资格认定、合规工作经验、紧缺职业、德语、英语、年龄、德国居留和伴侣共同申请。以计划递交时的年龄评估。官方指引对 35 岁和 40 岁边界的表述存在差异，系统保留各自可能的分值范围。 [法定积分附件](https://www.gesetze-im-internet.de/aufenthg_2004/anlage.html) · [德国外交部签证手册](https://www.auswaertiges-amt.de/resource/blob/207816/448ee20550723a28bf51724b8bebb5c1/visumhandbuch-data.pdf) · [德国驻斯科普里使馆指引](https://skopje.diplo.de/mk-de/service/05-visaeinreise/2633368-2633368)
- **标准生活费证明**按官方 2026 年口径核对每月 1,091 欧元，核对窗口从 2026 年 1 月 1 日起，至 2027 年 1 月 1 日止且不含当天。可使用冻结账户资金、正式担保声明，或符合每周平均最高 20 小时要求的德国兼职合同净收入加所需的冻结账户补足额。工作邀约答案用于核对合同资金渠道，须有已签合同、工时及金额资料支持。主管机关仍需判定个案证明。 [德国政府资金证明问答](https://www.make-it-in-germany.com/en/visa-recognition/opportunity-card/questions-answers)

## 规则与评估

规则定义分开记录描述、适用条件和判断表达式。原子条件比较支持等于、包含于、至少和至多，数据库通过 `jsonb` 保存预期值。复合表达式引用条件标识，可表示 AND、OR、带适用范围或例外的条件，以及积分。日期、币种、语言等级和资格认证须保留单位、当地口径和时间基准。

一条判断结果可包含规则标识、评估状态、评估时使用的政策版本、判定阶段和官方来源。可区分满足、未满足、答案缺失以及适用条件无法确定。程序无法核验的一般性条件应显示为人工核实事项，而不能因为没有对应程序条件就自动通过。

## 问卷与评估数据

首轮问卷面向个人条件和路线偏好。建议在增加持久化前明确用户同意、删除接口、加密、访问权限和保留期限。分析使用情况时优先从非敏感、聚合指标入手，避免保留输入内容。问卷结构与政策表分离，公开政策的更新过程中无需读取用户资料。
