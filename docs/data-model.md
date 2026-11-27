# 数据模型

## 公开目录与政策

`db/migrations/001_policy.sql` 定义以下 PostgreSQL 表。第二次迁移为政策发布补充快照和审核流程，保留首轮表及数据。

| 实体 | 主键和引用 | 主要字段 |
| --- | --- | --- |
| `country` | 两位国家代码 | 中英文名称、官方签证入口 |
| `visa_route` | 路径标识，关联国家 | 中英文名称和描述、路径类别、官方申请指南 |
| `official_source` | 来源标识，关联国家 | 唯一的官方 URL、主管机关、来源标题 |
| `policy_version` | 版本记录标识，关联路径 | 政策键、版本号、判定阶段和范围、入审与审批身份、审核状态、审核时间及审核依据 |
| `policy_condition` | 政策版本与条件键，关联来源 | 输入键、比较运算符、预期值、显示顺序、条件和行动说明、原文定位、适用范围、生效起止日期、核验时间和状态 |
| `source_observation` | 观察记录标识，关联来源 | 观察时间、正文归一化版本、基准和观察指纹、变化或错误状态 |
| `source_review` | 观察记录标识 | 人工处置结果、审核人、审核时间、审核依据和说明 |
| `policy_publication_event` | 发布审核记录标识，关联政策版本 | 状态变更、数据库会话身份、审核依据、记录时间 |

国家和路径标识在显示名称更新时保持稳定。每组路径、政策键和阶段至多有一个获批版本。切换版本时在同一事务内停用前一版并批准后继版本。已撤回的版本及其审核依据留在数据库中。服务层要求已批准版本与部署的 Git 快照内容一致才会提供相应规则。

`db/migrations/002_policy_publication.sql` 为政策版本添加 Git 提交、SHA-256 指纹和 JSON 规则快照。开始审核后的规则快照保持原样，修订以新版本提交。

`db/migrations/003_policy_permissions.sql` 从数据库会话记录入审和审批身份，另设获批快照和审核队列的只读视图。此前缺少可核验身份的发布记录仍留作历史，须以新版本重新入审并批准后才会由获批快照视图返回。

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

### 第三阶段新加坡 Employment Pass

2026 年 11 月 23 日核对新加坡人力部新申请条件。核对范围为新加坡的职位邀请和第一阶段固定月薪。以递交时的年龄、雇主主要业务所属行业和固定月薪选用官方对应表。固定月薪为基本月薪与固定月度津贴之和，花红、加班费、报销和浮动津贴应另列。雇主行业按该机构所属行业确认，职业头衔无法确定行业。 [申请资格及工资表](https://www.mom.gov.sg/passes-and-permits/employment-pass/eligibility) · [职位邀请](https://www.mom.gov.sg/passes-and-permits/employment-pass/key-facts) · [固定月薪定义](https://www.mom.gov.sg/faq/employment-pass/what-is-a-fixed-monthly-salary) · [雇主行业分类](https://www.mom.gov.sg/faq/compass/how-do-i-check-and-update-my-organisation-sector-classification)

- **2025 版新申请工资表**适用于 2025 年 1 月 1 日起，至 2027 年 1 月 1 日前的递交日期。按行业及年龄查表。 [2024 年生效公告](https://www.mom.gov.sg/newsroom/press-releases/2024/cos-foreign-workforce-policy-factsheet)
- **2027 版新申请工资表**自新加坡当地日期 2027 年 1 月 1 日起适用。 [2026 年政策公告](https://www.mom.gov.sg/newsroom/press-releases/2026/0303-partnering-businesses-and-workers-to-thrive-in-a-changed-world)

2026 年 11 月 27 日（新加坡时间）核对续签工资表、COMPASS 积分及豁免。以下两个快照的版本均为 `2026-11-27.1`，版本日期采用 UTC。生产环境需经人工独立审核，在 PostgreSQL 中批准与 Git 提交一致的快照后方可启用。 [政策发布流程](testing-deployment.md)

- **续签第一阶段**（`sg-ep-stage-1-renewal`）核对是否继续在同一雇主处从事管理、高管或专业岗位，并按现有准证到期日选表。2026 年 1 月 1 日至 2027 年 12 月 31 日到期使用原表。2028 年 1 月 1 日起到期使用调整后标准，即使提前递交也按到期日选表。所有准证类型都须在到期日前递交，按新加坡当地核对日计算。到期当日及之后应请雇主重新申请准证。确认持有普通准证后才按到期前 180 天判断开放日。准证类型不明时保留待核实，担保类准证的三个月窗口请由雇主向新加坡人力部核实。 [薪资表](https://www.mom.gov.sg/passes-and-permits/employment-pass/eligibility) · [续签流程](https://www.mom.gov.sg/passes-and-permits/employment-pass/renew-a-pass) · [2026 年政策公告](https://www.mom.gov.sg/newsroom/press-releases/2026/0303-partnering-businesses-and-workers-to-thrive-in-a-changed-world)
- **第二阶段**（`sg-ep-stage-2-compass`）新申请自 2023 年 9 月 1 日适用。续签自准证于 2024 年 9 月 1 日起到期时适用。本工具对已确认持有普通准证且处于当前续签窗口内的申请核对积分。固定月薪至少 S$22,500、适用贸易协定下的海外公司内部调动、岗位期限一个月或更短，均为官方豁免依据。其他情况需达到 C1 至 C6 合计 40 分。按雇主自评工具确认的分项积分计算，未确认分数保留未知并显示上下界。C5 及 C6 加分所需证据由雇主核实。 [生效公告](https://www.mom.gov.sg/newsroom/press-releases/2023/0329-details-on-compass-bonus-criteria) · [COMPASS 规则及豁免](https://www.mom.gov.sg/passes-and-permits/employment-pass/eligibility) · [MOM 自评工具](https://www.mom.gov.sg/eservices/services/employment-s-pass-self-assessment-tool)

工资表的年龄、行业或月薪资料不足时，保留待核实状态。公平考量框架、特殊政策安排、证明材料以及完整申请资格仍须单独核实。

每次提交问卷时，页面重新获取服务器按当前政策日期筛选的规则。就业准证的排序以两个必要阶段中条件较欠缺的一项为准。缺少已发布的必要阶段时显示未覆盖。申请类型、现有准证类型、到期日、雇主及岗位相关答案、年龄、雇主行业、薪资、新加坡当地核对日或 COMPASS 规则版本变化时，雇主确认的 COMPASS 积分及非薪资豁免须重新填写。问卷答案留在浏览器内，核对结果显示实际使用的新加坡政策日期。 [C1 薪资基准版本及适用日期](https://www.mom.gov.sg/passes-and-permits/employment-pass/eligibility/compass-c1-salary-benchmarks) · [C2 学历清单及适用日期](https://www.mom.gov.sg/passes-and-permits/employment-pass/eligibility)

### 第三阶段英国 Skilled Worker

2026 年 11 月 23 日核对首次主申请人适用规则。核对不低于 18 岁、由雇主分配适用于该岗位和申请类别的担保证明、雇主的 A 级 Skilled Worker 担保资质及许可范围，以及可接受的首次申请 B2 英语证明。境外入境许可申请的担保证明还包括 Defined CoS 要求。年龄和担保规则以 2020 年 12 月 1 日生效的变更为依据，首次申请 B2 要求自 2026 年 1 月 8 日生效。核对依据为用户报告，证明材料仍需主管机关核验。 [Skilled Worker 附录](https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-skilled-worker) · [HC 813](https://www.gov.uk/government/publications/statement-of-changes-to-the-immigration-rules-hc-813-22-october-2020) · [持牌担保人登记册](https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers) · [英语要求附录](https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-english-language) · [HC 1333](https://www.gov.uk/government/publications/statement-of-changes-to-the-immigration-rules-hc-1333-14-october-2025/statement-of-changes-to-the-immigration-rules-hc-1333-14-october-2025-accessible-version)

完整担保证明有效性、职业代码、薪资及职业工资标准、生活费证明、适格性和续签、变更雇主或附属申请的规则均须单独核实。

2026 年 11 月 26 日核对 SW 3.3。自 2026 年 3 月 26 日起，从英国境外以阿富汗国籍申请入境许可的 Skilled Worker 主申请人受此限制。以其他国籍申请的双重国籍人员按本次申报的国籍核对。境内申请跳过此项，申请地点未知或境外申请所用国籍未知时显示待补充信息。 [英国内政部签证限制指南](https://www.gov.uk/guidance/visa-brake-changes-to-the-uk-visa-system)

## 规则与评估

规则定义分开记录描述、适用条件和判断表达式。原子条件比较支持等于、包含于、至少和至多，数据库通过 `jsonb` 保存预期值。复合表达式引用条件标识，可表示 AND、OR、带适用范围或例外的条件，以及积分。日期、币种、语言等级和资格认证须保留单位、当地口径和时间基准。

一条判断结果可包含规则标识、评估状态、评估时使用的政策版本、判定阶段和官方来源。可区分满足、未满足、答案缺失以及适用条件无法确定。程序无法核验的一般性条件应显示为人工核实事项，而不能因为没有对应程序条件就自动通过。

## 问卷与评估数据

首轮问卷面向个人条件和路线偏好。建议在增加持久化前明确用户同意、删除接口、加密、访问权限和保留期限。分析使用情况时优先从非敏感、聚合指标入手，避免保留输入内容。问卷结构与政策表分离，公开政策的更新过程中无需读取用户资料。
