import type { SystemConfigDocLink } from '../types/systemConfig';

export interface SettingsHelpContent {
  title: string;
  summary?: string;
  usage?: string;
  valueNotes?: string[];
  impact?: string[];
  notes?: string[];
  docs?: SystemConfigDocLink[];
}

type SettingsHelpMap = Record<string, SettingsHelpContent>;

const settingsHelpZhCN: SettingsHelpMap = {
  'settings.base.STOCK_LIST': {
    title: '自选股列表',
    summary: '配置需要分析的股票代码列表，是手动分析、定时任务和通知报告的基础输入。',
    usage: '多个股票代码使用英文逗号分隔。A 股可直接填写 6 位代码，港股可使用 hk 前缀，美股可填写 ticker。',
    valueNotes: [
      '定时模式每次触发前会重新读取当前保存的 STOCK_LIST。',
      '如果命令行临时传入 --stocks，只影响本次手动运行，不会锁定后续计划任务。',
      '邮件分组里的 STOCK_GROUP_N 应写成 STOCK_LIST 的子集，只影响邮件收件人，不改变分析范围。',
    ],
    impact: [
      '影响主分析任务、市场报告中的个股范围、通知推送内容和历史报告记录。',
    ],
    notes: [
      '股票代码之间不要使用中文逗号。',
      '修改后保存配置即可供后续任务读取。',
    ],
  },
  'settings.ai_model.LITELLM_MODEL': {
    title: '主模型',
    summary: '指定普通分析流程默认使用的 LLM 模型。',
    usage: '推荐使用 provider/model 格式，例如 deepseek/deepseek-v4-flash、gemini/gemini-3.1-pro-preview 或 ollama/qwen3:8b。',
    valueNotes: [
      '系统配置优先级为 LITELLM_CONFIG > LLM_CHANNELS > legacy provider keys。',
      '如果留空，系统会尝试根据已配置的 API Key 或渠道声明自动推断。',
      'Agent 可通过 AGENT_LITELLM_MODEL 单独指定模型；留空时继承主模型。',
    ],
    impact: [
      '影响普通个股分析、大盘复盘、报告生成，以及未单独覆盖模型的 Agent 调用。',
    ],
    notes: [
      '无 provider 前缀时，LiteLLM 可能无法判断应该使用哪组 API Key。',
      'Ollama 本地模型应配合 OLLAMA_API_BASE 或 Ollama 渠道使用，不要误用 OPENAI_BASE_URL。',
    ],
  },
  'settings.ai_model.LLM_CHANNELS': {
    title: 'LLM 渠道列表',
    summary: '声明多个模型渠道，用于多 provider、多 Key、备用模型和可视化渠道管理。',
    usage: '填写逗号分隔的渠道名，例如 deepseek,aihubmix；每个渠道再配置 LLM_<NAME>_BASE_URL、LLM_<NAME>_API_KEY(S)、LLM_<NAME>_MODELS 等字段。',
    valueNotes: [
      '启用渠道模式后，同层运行时优先读取渠道配置。',
      '在 Docker 或 GitHub Actions 中显式注入的环境变量会覆盖 Web 设置页写入的 .env。',
      '渠道编辑器保存时只更新本次提交的 key，不会静默迁移整个旧配置。',
    ],
    impact: [
      '影响主模型、Agent 模型、fallback 模型和 Vision 模型的可选来源。',
    ],
    notes: [
      '不要把极简 legacy key 和 Channels 混用后期待两边同时生效。',
      '自定义渠道名在 GitHub Actions 中通常还需要 workflow 显式映射对应环境变量。',
    ],
  },
  'settings.notification.FEISHU_WEBHOOK_URL': {
    title: '飞书群机器人 Webhook',
    summary: '配置飞书自定义群机器人，用于把分析报告推送到指定飞书群。',
    usage: '在飞书群中添加自定义机器人后，复制 open-apis/bot/v2/hook 开头的 Webhook URL 到这里。',
    valueNotes: [
      '如果机器人开启“签名校验”，还需要填写 FEISHU_WEBHOOK_SECRET。',
      '如果机器人开启“关键词”，还需要填写 FEISHU_WEBHOOK_KEYWORD，系统会自动补到消息前。',
      'FEISHU_APP_ID / FEISHU_APP_SECRET 用于飞书应用、云文档或 Stream Bot，不会直接启用群 Webhook 推送。',
    ],
    impact: [
      '影响飞书通知渠道；失败时不应拖垮主分析流程，只影响该渠道送达。',
    ],
    notes: [
      '不要把 FEISHU_APP_SECRET 当作 FEISHU_WEBHOOK_SECRET 使用。',
      '如果飞书侧配置 IP 白名单，需要确认当前运行环境出口 IP 已加入白名单。',
    ],
  },
  'settings.notification.CUSTOM_WEBHOOK_URLS': {
    title: '自定义 Webhook',
    summary: '配置任意支持 POST JSON 的通知端点，可用于钉钉、Bark、Slack、Discord 或自建服务。',
    usage: '多个 URL 使用英文逗号分隔。Bark 可直接填写 https://api.day.app/YOUR_BARK_KEY。',
    valueNotes: [
      '未配置 CUSTOM_WEBHOOK_BODY_TEMPLATE 时，系统会按 URL 类型自动生成常见 payload。',
      '配置全局 Body 模板后，会覆盖 Bark、Slack、Discord 等自动 payload。',
      '需要认证的通用 webhook 可搭配 CUSTOM_WEBHOOK_BEARER_TOKEN。',
    ],
    impact: [
      '影响 custom 通知渠道；单个 URL 失败不会阻断其他 URL 或主分析流程。',
    ],
    notes: [
      'Bark 仍作为 custom webhook 使用，不需要新增 BARK_* 配置。',
      '自签名内网端点可评估 WEBHOOK_VERIFY_SSL=false，但不要用于公网链路。',
    ],
  },
  'settings.system.WEBUI_HOST': {
    title: 'WebUI 监听地址',
    summary: '控制 WebUI 服务绑定在哪个网络地址上。',
    usage: '本机访问通常使用 127.0.0.1；云服务器、Docker 或需要外部访问时通常使用 0.0.0.0。',
    valueNotes: [
      '.env 里的 WEBUI_HOST 在进程启动读取时优先级高于命令行 --host 参数。',
      '在设置页保存后，只会写入 .env 并重载运行时配置对象，不会让当前 WebUI/API 进程重新绑定监听地址。',
      'Docker Compose 中通常会在容器内使用 0.0.0.0，宿主机访问还取决于端口映射。',
    ],
    impact: [
      '影响重启后浏览器能否从本机、局域网或公网访问 WebUI。',
    ],
    notes: [
      '修改 WEBUI_HOST 后需要重启当前进程、Docker 容器或服务管理器才会生效。',
      '直连公网时建议同时启用 ADMIN_AUTH_ENABLED。',
      '如果部署在反向代理后面，登录限流与真实 IP 识别还需要评估 TRUST_X_FORWARDED_FOR。',
    ],
  },
};

const settingsHelpEnUS: SettingsHelpMap = settingsHelpZhCN;

function getPreferredHelpMap(locale?: string | null): SettingsHelpMap {
  if (locale?.toLowerCase().startsWith('en')) {
    return settingsHelpEnUS;
  }
  return settingsHelpZhCN;
}

export function getSettingsHelpContent(
  helpKey?: string | null,
  fallbackDescription?: string,
  locale?: string | null,
): SettingsHelpContent | null {
  if (!helpKey) {
    return null;
  }

  const localized = getPreferredHelpMap(locale)[helpKey] ?? settingsHelpZhCN[helpKey];
  if (localized) {
    return localized;
  }

  if (fallbackDescription) {
    return {
      title: '配置说明',
      summary: fallbackDescription,
    };
  }

  return null;
}
