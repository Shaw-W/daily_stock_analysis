"""Debate report rendering helpers."""
from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from src.config import get_config
from src.debate.models import DebateResult

logger = logging.getLogger(__name__)


def _templates_dir() -> Path:
    config = get_config()
    base = Path(__file__).resolve().parent.parent.parent
    path = Path(getattr(config, "report_templates_dir", "templates"))
    return path if path.is_absolute() else base / path


def render_debate_report(result: DebateResult, platform: str = "markdown", extra_context: Optional[Dict[str, Any]] = None) -> str:
    """Render debate report from Jinja2 template; fallback to simple markdown."""
    template_map = {
        "markdown": "report_debate_markdown.j2",
        "telegram": "report_debate_telegram.j2",
        "feishu": "report_debate_feishu.j2",
    }
    template_name = template_map.get(platform, template_map["markdown"])
    try:
        from jinja2 import Environment, FileSystemLoader, select_autoescape

        env = Environment(loader=FileSystemLoader(str(_templates_dir())), autoescape=select_autoescape(default=False))
        template = env.get_template(template_name)
        return template.render(
            result=result,
            agent_reports=result.agent_reports,
            generated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            **(extra_context or {}),
        )
    except Exception as exc:
        logger.warning("辩论报告模板渲染失败 %s: %s", template_name, exc)
        return format_debate_summary_markdown(result)


def format_debate_summary_markdown(result: DebateResult) -> str:
    lines = [
        f"# ⚖️ {result.stock_name}（{result.stock_code}）多智能体辩论报告",
        "",
        f"> 结论：**{result.final_direction}**｜信心度：**{result.confidence:.0f}/100**｜多方胜率：**{result.bull_win_rate:.0f}%**｜空方胜率：**{result.bear_win_rate:.0f}%**",
        "",
        "## 六 Agent 投票",
    ]
    for report in result.agent_reports:
        suffix = f"（失败：{report.error}）" if report.error else ""
        lines.append(f"- {report.agent_emoji} **{report.agent_name}**：{report.direction} / {report.confidence:.0f}{suffix}")
    lines.extend([
        "",
        "## 🟢 多方论证",
        result.bull_argument or "暂无",
        "",
        "## 🔴 空方论证",
        result.bear_argument or "暂无",
        "",
        "## ⚖️ 裁判裁定",
        result.judge_verdict or "暂无",
        "",
        "## 模型与数据覆盖",
        f"- 模型：`{result.models_used}`",
        f"- 数据覆盖：`{result.data_coverage}`",
        f"- LLM 调用次数：{result.total_llm_calls}",
        f"- 耗时：{result.total_time_seconds:.1f}s",
        "",
        "> 免责声明：以上分析由 AI 多智能体辩论生成，仅供参考，不构成投资建议。",
    ])
    return "\n".join(lines)
