# 第一阶段计划：新增独立多智能体辩论分析能力

## Context

用户希望把另一个项目 `/Users/heybox/astrbot_plugin_fund_analyzer` 中的「股票智能分析」多智能体辩论能力引入当前股票分析系统，但采用方案三的第一阶段：**先单独起一个多智能体辩论分析功能**，不默认并入现有普通分析流程。

当前系统的普通分析链路位于：

- `api/v1/endpoints/analysis.py`
- `src/services/analysis_service.py`
- `src/core/pipeline.py`
- `src/analyzer.py`
- `data_provider/base.py`
- `src/storage.py`

它的特点是：数据聚合 + 技术/基本面/新闻上下文 + 单次 LLM 结构化报告。

外部 AstrBot 插件的多智能体辩论链路主要位于：

- `/Users/heybox/astrbot_plugin_fund_analyzer/stock/debate_engine.py`
- `/Users/heybox/astrbot_plugin_fund_analyzer/stock/agent_prompts.py`
- `/Users/heybox/astrbot_plugin_fund_analyzer/stock/data_collector.py`
- `/Users/heybox/astrbot_plugin_fund_analyzer/ai_analyzer/quant.py`
- `/Users/heybox/astrbot_plugin_fund_analyzer/main.py`

其流程是：

1. Phase 1：6 个 Agent 并行分析
2. Phase 2：多方辩手综合看涨论据
3. Phase 3：空方辩手综合看跌论据并反驳多方
4. Phase 4：裁判综合裁定

总计约 9 次 LLM 调用。第一阶段目标是把这个能力以**独立 API/服务/任务**形式引入当前项目，保持普通分析稳定、快速，不受辩论链路成本和耗时影响。

额外要求：多智能体辩论和裁判使用的模型可以分开配置，例如：

- Debate Agents / 多空辩手：DeepSeek
- Judge / 裁判：GPT

如果不配置，则全部默认继承当前主模型 `LITELLM_MODEL` 及现有 fallback。

## Approach

推荐第一阶段做成独立的「多智能体辩论分析」能力，不改现有 `/api/v1/analysis/analyze` 的默认行为。

新增一个 `src/debate/` 包，将 AstrBot 插件里的辩论核心逻辑迁移为当前项目可用的、无 AstrBot 依赖的实现：

- Prompt 迁移：复用 6 个 Agent、多方、空方、裁判 prompt。
- Engine 迁移：保留 Phase 1~4 的辩论流程，但把 `AstrBot provider.text_chat()` 替换为当前项目 LiteLLM 调用。
- Data adapter：不复制 AstrBot 的行情抓取逻辑，改为复用当前项目 `DataFetcherManager`、`storage`、`SearchService`、`StockTrendAnalyzer` 已经具备的数据能力。
- Service 层：新增 `DebateAnalysisService` 负责准备数据、运行辩论、生成报告、保存结果和按需推送通知。
- API 层：新增独立 endpoint，例如 `POST /api/v1/analysis/debate`，第一阶段建议只走异步任务，避免 HTTP 请求长时间阻塞。
- 通知层：辩论结果需要像普通分析一样生成可读 Markdown 报告并支持现有通知渠道；同时优化 Telegram 格式，避免当前 TG 中表格/分隔符渲染拥挤的问题，视觉上参考飞书卡片的分段、项目符号和留白。

模型配置采用三层继承：

1. `DEBATE_AGENT_MODEL`：Phase 1 六 Agent + Phase 2/3 多空辩手模型；为空则继承 `LITELLM_MODEL`。
2. `DEBATE_JUDGE_MODEL`：Phase 4 裁判模型；为空则继承 `DEBATE_AGENT_MODEL`；如果 `DEBATE_AGENT_MODEL` 也为空，则继承 `LITELLM_MODEL`。
3. fallback 默认复用现有 `LITELLM_FALLBACK_MODELS`；第一阶段可不新增独立 fallback，避免配置过度复杂。

这些配置必须支持在 Web 设置页可视化管理。后端配置注册表新增独立分类 `debate`，前端显示为「多智能体辩论」，位置放在「系统设置」和「Agent 设置」之间。页面上的标题、描述、选项文案全部使用中文；模型继承关系也要在字段说明中直接说明。

配置示例：

```env
ENABLE_DEBATE_ANALYSIS=true
DEBATE_AGENT_MODEL=
DEBATE_JUDGE_MODEL=
DEBATE_AGENT_PARALLELISM=3
DEBATE_TASK_CONCURRENCY=1
DEBATE_BATCH_MAX_SIZE=10
DEBATE_TIMEOUT_SECONDS=300
```

也支持按需分开指定模型，例如：

```env
# 示例：Agent/多空辩手用 DeepSeek，裁判用 GPT；不填则都继承主模型
DEBATE_AGENT_MODEL=deepseek/deepseek-chat
DEBATE_JUDGE_MODEL=openai/gpt-4.1
```

默认不配置模型时：

```text
DEBATE_AGENT_MODEL = LITELLM_MODEL
DEBATE_JUDGE_MODEL = DEBATE_AGENT_MODEL or LITELLM_MODEL
```

并发建议：虽然 AstrBot 版本 Phase 1 是 6 个并行 Agent，但当前项目有全局任务队列并发，第一阶段需要新增 `DEBATE_AGENT_PARALLELISM`，默认 3，避免多个任务叠加时触发 LLM 限流。任务层面参考现有分析队列支持批量提交，但辩论任务执行并发第一阶段固定/默认限制为 1，确保多只股票排队串行辩论。

数据源判断：第一阶段不复制 AstrBot 插件的 EastMoney/AkShare 数据源体系。当前项目已有 `DataFetcherManager`，并已接入 Tushare、TickFlow、AkShare、Efinance、YFinance、Longbridge 等数据源。对于 A 股辩论第一阶段需要的数据，Tushare/TickFlow 配置齐全时基本够用：

- 实时行情：TickFlow/Tushare 或当前 fallback 数据源。
- 日线 K 线：Tushare/TickFlow/现有日线 fallback。
- 资金流/主力流向：优先复用当前 `fundamental_context.capital_flow`、Tushare/TickFlow 能力；缺失时降级为“资金流数据不足”。
- 新闻/事件：依赖当前 `SearchService`，不是 Tushare/TickFlow。
- 筹码/龙虎榜/板块：第一阶段尽量复用现有能力，缺失不阻断辩论。

因此第一阶段认为现有数据源“够启动”，但 data adapter 必须明确标注数据覆盖率，Agent prompt 中要求对缺失数据降权，不允许编造。

## Files to modify

### 新增文件

- `src/debate/__init__.py`
- `src/debate/models.py`
  - 定义 `DebateAgentReport`、`DebateResult`、`DebateStockInfo`、可能的 `DebateRunConfig`。
- `src/debate/prompts.py`
  - 从 AstrBot 插件 `stock/agent_prompts.py` 迁移 6 Agent、多方、空方、裁判 prompts。
- `src/debate/llm_client.py`
  - 当前项目 LiteLLM 的轻量封装，支持按调用指定 model。
- `src/debate/engine.py`
  - 从 AstrBot 插件 `stock/debate_engine.py` 迁移并去除 AstrBot 依赖。
- `src/debate/data_adapter.py`
  - 把当前项目行情/历史/新闻/趋势/基本面数据整理成 Agent 输入文本。
- `src/services/debate_analysis_service.py`
  - 面向 API/任务队列的业务服务。
- `api/v1/schemas/debate.py`
  - 请求/响应模型。
- `templates/report_debate_markdown.j2`
  - 通用辩论分析 Markdown 报告模板。
- `templates/report_debate_telegram.j2`
  - Telegram 专用报告模板，避免 Markdown 表格，使用短标题、项目符号、分隔线和留白。
- `templates/report_debate_feishu.j2`
  - 飞书卡片友好的报告模板，可复用普通 Markdown，但保持与 image-2 类似的分段观感。
- 可选：`tests/test_debate_engine.py`
- 可选：`tests/test_debate_analysis_service.py`

### 修改文件

- `src/config.py`
  - 新增多智能体辩论配置项。
  - 新增模型继承/解析 helper。
- `src/core/config_registry.py`
  - 新增 `debate` 配置分类，display_order 介于 `system` 和 `agent`。
  - 注册所有 `DEBATE_*` 字段，标题/描述/选项使用中文。
  - 同步清理现有设置页字段元数据中的英文标题/描述，至少覆盖 `TRADING_DAY_CHECK_ENABLED` 等系统设置字段。
- `apps/dsa-web/src/types/systemConfig.ts`
  - `SystemConfigCategory` 新增 `debate`。
- `apps/dsa-web/src/utils/systemConfigI18n.ts`
  - 新增「多智能体辩论」分类中文名和说明。
  - 新增 `DEBATE_*` 字段中文标题/描述。
  - 补齐现有字段中文翻译，至少把 `TRADING_DAY_CHECK_ENABLED` 的英文描述改为中文展示。
- `apps/dsa-web/src/pages/SettingsPage.tsx`
  - 确保新增分类作为独立 tab 显示在系统设置与 Agent 设置之间。
  - 如需要，增加该 tab 的说明卡片，解释模型继承和辩论成本。
- `apps/dsa-web/src/pages/DebateAnalysisPage.tsx`
  - 新增多智能体辩论页面，作为侧边栏独立入口，位置在「分析/首页」下面、「问股」上面。
- `apps/dsa-web/src/App.tsx`
  - 新增 `/debate` 路由。
- `apps/dsa-web/src/components/layout/SidebarNav.tsx`
  - 新增「辩论」或「多智辩论」导航项，排列在首页/分析入口之后、问股之前。
- `apps/dsa-web/src/pages/BacktestPage.tsx`
  - 修复回测结果表格错位问题：长预测文本不能覆盖后续列；表格应横向滚动且列宽稳定。
- `apps/dsa-web/src/index.css`
  - 调整 `.backtest-table-wrapper`、`.backtest-table`、`.backtest-table-cell` 等样式，修复表格布局错位和文本溢出。
- `api/v1/endpoints/analysis.py`
  - 新增 `POST /debate` endpoint。
  - 第一阶段可放在同一 router 下，路径为 `/api/v1/analysis/debate`。
- `src/services/task_queue.py`
  - 增加可复用的自定义后台任务进度更新方式，或复用现有 `submit_background_task()` 并扩展 progress callback 支持。
  - 新增辩论任务队列/提交入口，支持批量提交但执行并发限制为 1。
- `src/notification.py`
  - 增加 `generate_debate_report()` / `send_debate_notification()` 或等价入口，让辩论结果和普通分析一样可推送。
- `src/services/report_renderer.py`
  - 支持 `debate` report family 或新增专用 render 方法，按平台选择 `report_debate_markdown.j2`、`report_debate_telegram.j2`、`report_debate_feishu.j2`。
- `src/notification_sender/telegram_sender.py`
  - 优化 Telegram 内容渲染/分片：优先使用 TG 专用模板，减少表格、裸 `---`、长段落；必要时考虑 HTML parse mode 或更严格的 Markdown 转义。
- `src/storage.py`
  - 第一阶段至少把辩论结果作为 `raw_result`/独立历史记录保存。
  - 若不想改表结构，第一阶段可以先复用 `analysis_history`，`report_type='debate'`，`raw_result` 保存完整 `DebateResult`。
- `.env.example`
  - 增加辩论相关配置示例。
- `docs/LLM_CONFIG_GUIDE.md` 或相关配置文档
  - 说明 `DEBATE_AGENT_MODEL` / `DEBATE_JUDGE_MODEL` 的继承关系和示例。

## Reuse

### 当前项目可复用

- `data_provider.DataFetcherManager`
  - `get_daily_data()`：日线数据。
  - `get_realtime_quote()`：实时行情。
  - `get_fundamental_context()`：基本面、估值、资金流等结构化上下文。
  - `get_chip_distribution()`：筹码分布。
- `src.storage.get_db()`
  - `get_data_range()`：读取历史 K 线。
  - `save_daily_data()`：保存补齐历史数据。
  - `save_analysis_history()`：第一阶段可临时保存 `report_type='debate'` 的辩论记录。
- `src.search_service.SearchService`
  - `search_comprehensive_intel()`：搜索新闻、风险、业绩预期等情报。
  - `format_intel_report()`：格式化新闻上下文。
- `src.stock_analyzer.StockTrendAnalyzer`
  - 技术指标与趋势分析，可作为 Agent 输入之一。
- `src.analyzer.GeminiAnalyzer`
  - 可复用 LiteLLM 初始化、Router、fallback、usage 记录的部分逻辑。
  - 但第一阶段更建议抽出或新增 `DebateLLMClient`，避免调用私有方法太深。
- `src.storage.persist_llm_usage`
  - 记录每次辩论/裁判 LLM 使用量，`call_type` 可用 `debate_agent`、`debate_bull`、`debate_bear`、`debate_judge`。
- `src.services.task_queue.AnalysisTaskQueue`
  - 复用现有后台任务、状态、SSE 事件机制；辩论任务单独使用并发 1 的执行约束。
- `src.core.config_registry` + Web 设置页
  - 复用现有系统设置 schema 驱动 UI；新增 `debate` 分类后，设置页会自动形成独立 tab。
  - 复用 `SettingsField` 通用字段组件，但新增字段必须提供中文元数据，不能依赖英文 fallback。
- `src.notification.NotificationService` / `src.services.report_renderer`
  - 复用普通分析的报告生成和多渠道推送机制，新增辩论报告模板。
- `src.notification_sender.telegram_sender.TelegramSender`
  - 复用现有 Telegram 发送、分片、图片发送能力；计划中只优化文本格式，不引入 Playwright 图片渲染。

### AstrBot 插件可迁移/参考

- `/Users/heybox/astrbot_plugin_fund_analyzer/stock/agent_prompts.py`
  - 6 Agent、多方、空方、裁判 prompts。
- `/Users/heybox/astrbot_plugin_fund_analyzer/stock/debate_engine.py`
  - `AgentReport`、`DebateResult`、`DebateEngine.run_debate()`、方向/信心度解析、摘要格式化。
- `/Users/heybox/astrbot_plugin_fund_analyzer/stock/data_collector.py`
  - Agent 数据包组织思路。
- `/Users/heybox/astrbot_plugin_fund_analyzer/ai_analyzer/quant.py`
  - 技术指标、绩效、回测能力；第一阶段可以先不完整迁移，优先使用当前项目 `StockTrendAnalyzer`，后续再补。

## Steps

- [ ] Step 1：确认第一阶段边界
  - 独立接口 `/api/v1/analysis/debate`。
  - 不改变 `/api/v1/analysis/analyze` 默认行为。
  - 第一阶段默认异步执行，避免阻塞 HTTP。
  - 支持和普通分析类似的报告生成与通知推送，由请求参数 `notify` 控制，默认建议 `true` 或与普通分析保持一致。
  - 支持单股和批量提交；批量参考普通分析的 `stock_codes` 入参，但辩论任务执行并发限制为 1。

- [ ] Step 2：新增后端配置项和中文 schema
  - 在 `Config` 中加入：
    - `enable_debate_analysis: bool = True`
    - `debate_agent_model: str = ""`
    - `debate_judge_model: str = ""`
    - `debate_agent_parallelism: int = 3`
    - `debate_task_concurrency: int = 1`
    - `debate_batch_max_size: int = 10`
    - `debate_timeout_seconds: int = 300`
  - 新增 helper：
    - `get_effective_debate_agent_model(config)`
    - `get_effective_debate_judge_model(config)`
  - 模型继承规则：
    - agent model 空 -> `config.litellm_model`
    - judge model 空 -> effective agent model
    - fallback 复用 `config.litellm_fallback_models`
  - 在 `src/core/config_registry.py` 注册独立分类：
    - `category="debate"`
    - `title="多智能体辩论"`
    - `description="管理股票多智能体辩论、模型分工、并发与通知参数。"`
    - `display_order` 放在 `system` 后、`agent` 前。
  - 第一阶段默认开启：`ENABLE_DEBATE_ANALYSIS=true`。
  - 注册 `DEBATE_*` 字段，所有 title/description/options 使用中文：
    - `ENABLE_DEBATE_ANALYSIS`：启用多智能体辩论分析，默认开启。
    - `DEBATE_AGENT_MODEL`：辩论模型，留空继承主模型。
    - `DEBATE_JUDGE_MODEL`：裁判模型，留空继承辩论模型。
    - `DEBATE_AGENT_PARALLELISM`：单个辩论内部 Agent 并行数。
    - `DEBATE_TASK_CONCURRENCY`：辩论任务执行并发，第一阶段固定/默认 1。
    - `DEBATE_BATCH_MAX_SIZE`：单次批量提交上限。
    - `DEBATE_TIMEOUT_SECONDS`：单只股票辩论超时秒数。

- [ ] Step 3：设置页可视化管理
  - `apps/dsa-web/src/types/systemConfig.ts` 增加 `debate` 分类类型。
  - `apps/dsa-web/src/utils/systemConfigI18n.ts` 增加：
    - 分类名：`多智能体辩论`
    - 分类说明：`配置股票多智能体辩论的启用状态、模型分工、并发限制和通知行为。`
    - 所有 `DEBATE_*` 字段中文标题/说明。
  - 确认 `SettingsCategoryNav` 按后端 `display_order` 展示，使「多智能体辩论」位于「系统设置」与「Agent 设置」之间。
  - 在 `SettingsPage.tsx` 中可选增加该 tab 的说明卡片：说明“辩论模型”和“裁判模型”可分别选择；留空时继承主模型；每次约 9 次 LLM 调用。
  - 设置页新增字段不进入 AI 模型 tab，也不进入 Agent 设置 tab，避免和现有 Agent 模式混淆。

- [ ] Step 4：设置页现有文案中文化
  - 清理 `src/core/config_registry.py` 和 `apps/dsa-web/src/utils/systemConfigI18n.ts` 中用户可见的英文标题/描述。
  - 至少将 `TRADING_DAY_CHECK_ENABLED`：
    - title 改为 `交易日检查`
    - description 改为 `非交易日自动跳过分析；如需强制执行，可关闭此项或使用 --force-run。`
  - 新增 `DEBATE_*` 配置项也全部使用中文标题、中文描述和中文选项说明。
  - 优先覆盖系统设置、Agent 设置、多智能体辩论相关字段。
  - 对没有 i18n 映射的字段，尽量在后端 schema 中直接提供中文，避免 UI fallback 显示英文。

- [ ] Step 5：实现 `src/debate/models.py`
  - 定义结构化 dataclass。
  - `DebateResult.to_dict()` 方便 API 返回和历史保存。
  - 字段包括：
    - `agent_reports`
    - `bull_argument`
    - `bear_argument`
    - `judge_verdict`
    - `final_direction`
    - `confidence`
    - `bull_win_rate`
    - `bear_win_rate`
    - `total_llm_calls`
    - `total_time_seconds`
    - `models_used`

- [ ] Step 6：迁移 prompts 到 `src/debate/prompts.py`
  - 从 AstrBot 插件拷贝并清理 prompt。
  - 保留输出格式中用于解析的关键字段：
    - `方向判断：看涨/看跌/中性`
    - `信心度：X/100`
    - 裁判中的 `方向`、`信心度`、`多方胜率`、`空方胜率`。

- [ ] Step 7：实现 `src/debate/llm_client.py`
  - 支持 `generate(system_prompt, user_content, model, max_tokens, temperature)`。
  - 使用当前项目 LiteLLM/Router 配置。
  - 能按调用传入不同模型：agent/bull/bear 使用 `DEBATE_AGENT_MODEL`，judge 使用 `DEBATE_JUDGE_MODEL`。
  - usage 记录写入 `persist_llm_usage()`，区分 call_type。
  - 注意支持 LLM_CHANNELS/YAML Router alias 和 legacy env key。

- [ ] Step 8：实现 `src/debate/engine.py`
  - 迁移 `DebateEngine.run_debate()`。
  - Phase 1 使用 `asyncio.gather()`，但通过 semaphore 限制 `DEBATE_AGENT_PARALLELISM`。
  - Phase 2/3 串行执行。
  - Phase 4 使用裁判模型执行。
  - 加入超时控制。
  - 任一 Agent 失败时记录 error，不中断整体辩论。
  - 裁判失败时任务标记失败，或返回 partial result；第一阶段建议标记失败但保留 partial 到日志。

- [ ] Step 9：实现 `src/debate/data_adapter.py`
  - 输入股票代码。
  - 标准化代码。
  - 获取/补齐最近 60~90 天日线数据。
  - 获取实时行情。
  - 获取趋势分析、筹码、基本面、新闻情报。
  - 输出每个 Agent 需要的文本数据包。
  - 第一阶段不重复实现 AstrBot 的 EastMoney/AkShare 数据抓取。
  - 对 Tushare/TickFlow/当前 fallback 的数据覆盖做显式标记：有则使用，缺失则在 Agent 数据包中写明“数据缺失/不可用”，并要求 Agent 降权判断。
  - 资金流、筹码、龙虎榜、板块等增强字段缺失时不能阻断辩论，只影响对应 Agent 的置信度。

- [ ] Step 10：实现 `src/services/debate_analysis_service.py`
  - 提供 `run_debate_analysis(stock_code, query_id, progress_callback, notify=True)`。
  - 内部调用 data adapter + debate engine。
  - 构建 API 返回结构。
  - 生成辩论 Markdown 报告和渠道专用报告内容。
  - 保存历史。
  - 按 `notify` 调用通知服务推送，行为和普通分析保持一致。
  - `progress_callback` 映射进度：
    - 10% 准备数据
    - 25% 数据采集完成
    - 35% Phase 1 开始
    - 60% Phase 1 完成
    - 72% 多方完成
    - 84% 空方完成
    - 95% 裁判完成
    - 100% 保存完成

- [ ] Step 11：扩展 task queue 支持辩论任务
  - 方案 A：复用 `submit_background_task()`，新增 progress callback 参数。
  - 方案 B：新增 `submit_debate_task()`，复用同一 `_tasks` / SSE 机制。
  - 建议第一阶段选 B，便于股票分析任务和辩论任务区分。
  - 防重 key 可以用 `debate:{stock_code}`，避免普通分析和辩论互相阻塞。
  - 支持 `stock_codes` 批量提交，返回 accepted/duplicates 汇总，行为参考普通分析批量任务。
  - 辩论任务执行并发固定/默认 1：同一时间只跑一只股票的完整辩论，其他排队，防止 9 次 LLM 调用叠加导致限流。

- [ ] Step 12：新增 API schema 和 endpoint
  - 新增 `api/v1/schemas/debate.py`：
    - `DebateAnalyzeRequest`，支持 `stock_code` / `stock_codes`、`notify`、`force_refresh`。
    - `DebateTaskAccepted`
    - `DebateBatchTaskAcceptedResponse`
    - `DebateResultResponse`
  - 在 `api/v1/endpoints/analysis.py` 新增：
    - `POST /debate`
  - 第一阶段返回 202 task id。
  - 如果 `ENABLE_DEBATE_ANALYSIS=false`，返回 403 或 400，并提示需要开启配置。

- [ ] Step 13：保存历史结果
  - 第一阶段建议最小改动：使用 `save_analysis_history()` 存 `report_type='debate'`。
  - `raw_result` 包含完整 `DebateResult.to_dict()`。
  - `analysis_summary` 使用 `format_debate_summary()` 的简短结论。
  - 后续阶段再考虑单独 `debate_history` 表。

- [ ] Step 14：生成报告、推送通知和页面查看
  - 新增辩论报告模板：通用 Markdown、Telegram、飞书。
  - 报告内容至少包含：日期、股票、六 Agent 投票、多方胜率/空方胜率、裁判方向、核心摘要、Agent 分歧、风险点、操作关注位、模型使用信息、生成时间、免责声明。
  - API/history 返回中保留可展示的辩论报告内容，让用户能在 Web 页面中查看辩论报告。
  - 第一阶段页面查看可采用“历史详情/报告 Markdown 展示”方式，不要求复杂交互图表，但必须能打开并阅读完整辩论报告。
  - Telegram 模板避免使用 Markdown 表格，改用：
    - 短标题 + 空行分段
    - `•` 项目符号
    - 简短横线分隔，如 `────────`
    - 关键字段一行一个，避免 image-1 那种 raw table 和拥挤长段落
  - 飞书模板保持 lark_md 友好，参考 image-2 的卡片感：标题、段落、项目符号、适度留白。
  - `NotificationService` 增加辩论报告推送入口，复用已有渠道路由。

- [ ] Step 15：新增 Web 页面入口和辩论页面
  - 新增 `DebateAnalysisPage.tsx`，提供股票输入、提交辩论任务、任务进度、完成后报告展示。
  - 在 `App.tsx` 注册 `/debate` 路由。
  - 在 `SidebarNav.tsx` 新增导航项，显示在「首页/分析」下面、「问股」上面；用户要求页面入口放在分析下面、问股上面。
  - 页面第一阶段可复用历史/Markdown 组件展示完整报告，不要求复杂图表。

- [ ] Step 16：修复回测页面列表错位
  - 现象：回测结果表格中 `AI 预测` 文本过长时覆盖 `实际`、`准确性`、`结果`、`状态` 等列，小屏幕和大屏幕都可能错位。
  - 调整 `BacktestPage.tsx`：为关键列设置稳定宽度；长文本使用 `line-clamp`/截断 + Tooltip；数值和状态列保持 `whitespace-nowrap`。
  - 调整 `index.css`：表格使用 `table-layout: fixed` 或明确列宽；wrapper 保持横向滚动；单元格增加 `overflow-hidden`、`text-overflow`、`max-width`/`min-width` 约束。
  - 验证大数据列表、次日验证模式和普通窗口模式下均不发生列覆盖。

- [ ] Step 17：基础测试
  - 单测配置 schema：`debate` 分类存在，排序在 `system` 和 `agent` 之间，`DEBATE_*` 字段中文标题/描述存在。
  - 前端测试：设置页能显示「多智能体辩论」tab，字段说明中文展示，`TRADING_DAY_CHECK_ENABLED` 不再显示英文描述。
  - 单测 prompt/解析：方向、信心度、多空胜率提取。
  - 单测模型继承：
    - agent/judge 全空 -> 均继承 `LITELLM_MODEL`
    - 仅 agent 配置 -> judge 继承 agent
    - agent + judge 都配置 -> 分别使用
  - mock LLM 跑完整 engine，不真实请求模型。
  - mock data adapter 跑 service。

- [ ] Step 18：文档和配置说明
  - 更新 `.env.example`。
  - 更新 LLM 配置文档，说明默认 `DEBATE_AGENT_MODEL` / `DEBATE_JUDGE_MODEL` 留空并继承主模型；可选示例：DeepSeek 做 Agent，GPT 做 Judge。
  - 明确提示：辩论分析约 9 次 LLM 调用，耗时更长、成本更高。

- [ ] Step 19：生成后续阶段计划文件
  - 第一阶段开发完成并验收后，新增 `plans/debate-analysis-phase2.md`。
  - 第一阶段开发完成并验收后，新增 `plans/debate-analysis-phase3.md`。
  - Phase 2 计划重点：与普通分析更深度联动、前端专门展示页/详情页、历史查询优化、报告对比。
  - Phase 3 计划重点：高级能力，如策略/Agent 可配置、辩论质量评估、批量报告聚合、可选混合分析模式。

## Verification

- [ ] 默认配置下 `ENABLE_DEBATE_ANALYSIS=true`，不需要用户手动开启即可提交辩论任务。
- [ ] 如果用户在设置页主动关闭 `ENABLE_DEBATE_ANALYSIS`，调用 `POST /api/v1/analysis/debate` 返回明确错误，不影响普通分析。
- [ ] 配置开启但不配置辩论模型时：agent 和 judge 都使用主模型。
- [ ] Web 设置页出现独立「多智能体辩论」tab，位置在「系统设置」和「Agent 设置」之间。
- [ ] Web 设置页可直接编辑 `ENABLE_DEBATE_ANALYSIS`、`DEBATE_AGENT_MODEL`、`DEBATE_JUDGE_MODEL`、并发、批量上限和超时配置。
- [ ] 新增配置项在页面中全部显示中文标题和中文描述，模型字段说明清楚标注继承关系。
- [ ] `TRADING_DAY_CHECK_ENABLED` 及其描述在设置页显示中文，不再出现 `Skip analysis on non-trading days...`。
- [ ] 可选示例配置 `DEBATE_AGENT_MODEL=deepseek/deepseek-chat` 且不配 judge 时：agent/bull/bear/judge 都使用 DeepSeek。
- [ ] 可选示例配置 `DEBATE_AGENT_MODEL=deepseek/deepseek-chat`、`DEBATE_JUDGE_MODEL=openai/gpt-4.1` 时：Phase 1~3 使用 DeepSeek，Phase 4 使用 GPT；这只是示例，实际可填任意已配置 LiteLLM 模型或渠道别名。
- [ ] 异步提交后返回 202 和 task_id；批量提交时返回 accepted/duplicates 汇总。
- [ ] 辩论队列并发为 1：提交多只股票时任务按队列串行执行，不并发跑多个完整辩论。
- [ ] SSE/任务状态能看到阶段性进度。
- [ ] 某个 Agent 失败时整体还能进入多空和裁判阶段，并在对应 Agent report 中记录 error。
- [ ] 裁判失败时任务失败信息清晰，日志保留多空和 Agent partial。
- [ ] 成功结果中包含：
  - 六 Agent 报告
  - 多方论证
  - 空方论证
  - 裁判结论
  - final_direction
  - confidence
  - bull_win_rate / bear_win_rate
  - models_used
- [ ] 成功完成后能生成辩论报告，并在 `notify=true` 时通过已有通知渠道推送。
- [ ] Web 侧边栏新增多智能体辩论入口，位置在「首页/分析」下面、「问股」上面。
- [ ] 打开 `/debate` 页面可提交辩论任务、查看进度，并在完成后查看完整辩论报告。
- [ ] 成功完成后能在 Web 页面中查看完整辩论报告；至少能通过辩论页或历史/报告详情打开 Markdown 报告内容。
- [ ] Telegram 推送使用专用格式，不出现大段 Markdown 表格、裸 `|---|` 表格或过度拥挤的长段落；观感接近飞书卡片的分段效果。
- [ ] 飞书推送仍使用交互卡片/lark_md，能正常展示标题、分段、项目符号。
- [ ] 普通 `/api/v1/analysis/analyze` 行为和耗时不受影响。
- [ ] 历史记录中能查询到 `report_type='debate'` 的记录，至少 raw_result 可恢复完整辩论结果。
- [ ] 回测页面结果列表不再错位：长 `AI 预测` 文本不会覆盖后续列，横向滚动和 Tooltip 正常。
- [ ] 第一阶段完成后已创建 `plans/debate-analysis-phase2.md` 和 `plans/debate-analysis-phase3.md` 两个后续计划文件。

## 第一阶段不做
- 不把辩论默认合并进普通分析报告；但辩论自己的报告生成、页面查看、历史保存和通知推送必须完成。
- 不做复杂的 Web 前端可视化图表；但必须提供独立页面入口和基础页面查看完整辩论报告。
- 不迁移 Playwright 图片报告。
- 不复制 AstrBot 插件的 EastMoney/AkShare 数据源体系；先复用当前项目数据源，Tushare/TickFlow 不足的字段降级处理。
- 不新增复杂的独立 fallback 配置，先复用全局 fallback。
- 不做多个辩论任务并发执行；批量提交只负责入队，实际执行并发限制为 1。
