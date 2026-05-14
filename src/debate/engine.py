"""Multi-phase debate engine without AstrBot dependencies."""
from __future__ import annotations

import asyncio
import logging
import re
import time
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Tuple

from src.config import Config, get_config, get_effective_debate_agent_model, get_effective_debate_judge_model
from src.debate.llm_client import DebateLLMClient
from src.debate.models import DebateAgentReport, DebateResult, DebateStockInfo
from src.debate.prompts import AGENT_CONFIGS, BEAR_DEBATER_PROMPT, BULL_DEBATER_PROMPT, JUDGE_PROMPT

logger = logging.getLogger(__name__)

ProgressCallback = Optional[Callable[[int, str], None]]


_DIRECTION_RE = re.compile(r"(?:方向判断|方向)\s*[：:]\s*(看涨|看跌|中性)")
_CONFIDENCE_RE = re.compile(r"(?:信心度|看涨信心度|看跌信心度)\s*[：:]\s*(\d+(?:\.\d+)?)\s*/?\s*100?")
_BULL_RATE_RE = re.compile(r"多方胜率\s*[：:]\s*(\d+(?:\.\d+)?)\s*%?")
_BEAR_RATE_RE = re.compile(r"空方胜率\s*[：:]\s*(\d+(?:\.\d+)?)\s*%?")


def _parse_direction(text: str, default: str = "中性") -> str:
    match = _DIRECTION_RE.search(text or "")
    return match.group(1) if match else default


def _parse_number(regex: re.Pattern[str], text: str, default: float) -> float:
    match = regex.search(text or "")
    if not match:
        return default
    try:
        return max(0.0, min(100.0, float(match.group(1))))
    except Exception:
        return default


def _format_agent_reports(reports: List[DebateAgentReport]) -> str:
    blocks = []
    for report in reports:
        blocks.append(
            f"## {report.agent_emoji} {report.agent_name}\n"
            f"方向：{report.direction}｜信心度：{report.confidence:.0f}/100\n"
            f"{('错误：' + report.error) if report.error else report.analysis}"
        )
    return "\n\n".join(blocks)


class DebateEngine:
    """Run six-agent analysis, bull/bear debate, and judge verdict."""

    def __init__(self, config: Optional[Config] = None, llm_client: Optional[DebateLLMClient] = None):
        self.config = config or get_config()
        self.llm_client = llm_client or DebateLLMClient(self.config)

    async def _generate_async(self, **kwargs: Any) -> Tuple[str, str, Dict[str, Any]]:
        return await asyncio.to_thread(self.llm_client.generate, **kwargs)

    async def _run_agent(
        self,
        agent_id: str,
        agent_cfg: Dict[str, Any],
        agent_input: str,
        stock_code: str,
        model: str,
        semaphore: asyncio.Semaphore,
    ) -> DebateAgentReport:
        async with semaphore:
            try:
                content, used_model, _usage = await self._generate_async(
                    system_prompt=agent_cfg["prompt"],
                    user_content=agent_input,
                    model=model,
                    call_type=f"debate_agent_{agent_id}",
                    stock_code=stock_code,
                    max_tokens=4096,
                    temperature=0.4,
                )
                return DebateAgentReport(
                    agent_id=agent_id,
                    agent_name=agent_cfg["name"],
                    agent_emoji=agent_cfg["emoji"],
                    analysis=content,
                    direction=_parse_direction(content),
                    confidence=_parse_number(_CONFIDENCE_RE, content, 50.0),
                    model_used=used_model,
                )
            except Exception as exc:
                logger.warning("辩论 Agent 失败 %s/%s: %s", stock_code, agent_id, exc, exc_info=True)
                return DebateAgentReport(
                    agent_id=agent_id,
                    agent_name=agent_cfg["name"],
                    agent_emoji=agent_cfg["emoji"],
                    analysis="",
                    direction="中性",
                    confidence=0.0,
                    error=str(exc),
                    model_used=model,
                )

    async def _run_debate_async(
        self,
        *,
        stock_info: DebateStockInfo,
        agent_input: str,
        data_coverage: Optional[Dict[str, Any]] = None,
        progress_callback: ProgressCallback = None,
    ) -> DebateResult:
        start = time.monotonic()
        agent_model = get_effective_debate_agent_model(self.config)
        judge_model = get_effective_debate_judge_model(self.config)
        parallelism = max(1, min(6, int(getattr(self.config, "debate_agent_parallelism", 3) or 3)))
        timeout = max(30, int(getattr(self.config, "debate_timeout_seconds", 300) or 300))

        async def _core() -> DebateResult:
            if progress_callback:
                progress_callback(35, "Phase 1：六个 Agent 开始并行分析")
            semaphore = asyncio.Semaphore(parallelism)
            agent_tasks = [
                self._run_agent(agent_id, cfg, agent_input, stock_info.code, agent_model, semaphore)
                for agent_id, cfg in AGENT_CONFIGS.items()
            ]
            agent_reports = await asyncio.gather(*agent_tasks)
            if progress_callback:
                progress_callback(60, "Phase 1：Agent 分析完成")

            agent_text = _format_agent_reports(agent_reports)
            common_context = (
                f"股票：{stock_info.name}（{stock_info.code}）\n"
                f"当前价：{stock_info.latest_price}，涨跌幅：{stock_info.change_rate}%\n\n"
                f"数据覆盖：{data_coverage or {}}\n\n"
                f"六位 Agent 独立报告：\n{agent_text}"
            )

            bull_argument, bull_used_model, _ = await self._generate_async(
                system_prompt=BULL_DEBATER_PROMPT,
                user_content=common_context,
                model=agent_model,
                call_type="debate_bull",
                stock_code=stock_info.code,
                max_tokens=4096,
                temperature=0.45,
            )
            if progress_callback:
                progress_callback(72, "Phase 2：多方论证完成")

            bear_context = common_context + "\n\n多方论证：\n" + bull_argument
            bear_argument, bear_used_model, _ = await self._generate_async(
                system_prompt=BEAR_DEBATER_PROMPT,
                user_content=bear_context,
                model=agent_model,
                call_type="debate_bear",
                stock_code=stock_info.code,
                max_tokens=4096,
                temperature=0.45,
            )
            if progress_callback:
                progress_callback(84, "Phase 3：空方论证完成")

            judge_context = (
                common_context
                + "\n\n### 🟢 多方论证\n"
                + bull_argument
                + "\n\n### 🔴 空方论证\n"
                + bear_argument
            )
            judge_verdict, judge_used_model, _ = await self._generate_async(
                system_prompt=JUDGE_PROMPT,
                user_content=judge_context,
                model=judge_model,
                call_type="debate_judge",
                stock_code=stock_info.code,
                max_tokens=4096,
                temperature=0.25,
            )
            if progress_callback:
                progress_callback(95, "Phase 4：裁判裁定完成")

            final_direction = _parse_direction(judge_verdict)
            confidence = _parse_number(_CONFIDENCE_RE, judge_verdict, 50.0)
            bull_win_rate = _parse_number(_BULL_RATE_RE, judge_verdict, 50.0)
            bear_win_rate = _parse_number(_BEAR_RATE_RE, judge_verdict, max(0.0, 100.0 - bull_win_rate))

            elapsed = time.monotonic() - start
            return DebateResult(
                agent_reports=agent_reports,
                bull_argument=bull_argument,
                bear_argument=bear_argument,
                judge_verdict=judge_verdict,
                final_direction=final_direction,
                confidence=confidence,
                bull_win_rate=bull_win_rate,
                bear_win_rate=bear_win_rate,
                stock_name=stock_info.name,
                stock_code=stock_info.code,
                stock_price=stock_info.latest_price,
                stock_change_rate=stock_info.change_rate,
                total_llm_calls=6 + 1 + 1 + 1,
                total_time_seconds=elapsed,
                completed_at=datetime.now(),
                models_used={
                    "agent_model": agent_model,
                    "judge_model": judge_model,
                    "bull_model": bull_used_model,
                    "bear_model": bear_used_model,
                    "judge_used_model": judge_used_model,
                    "agent_reports": {r.agent_id: r.model_used for r in agent_reports},
                },
                data_coverage=data_coverage or {},
            )

        return await asyncio.wait_for(_core(), timeout=timeout)

    def run_debate(
        self,
        *,
        stock_info: DebateStockInfo,
        agent_input: str,
        data_coverage: Optional[Dict[str, Any]] = None,
        progress_callback: ProgressCallback = None,
    ) -> DebateResult:
        """Run the full debate synchronously for thread-pool task workers."""
        try:
            return asyncio.run(
                self._run_debate_async(
                    stock_info=stock_info,
                    agent_input=agent_input,
                    data_coverage=data_coverage,
                    progress_callback=progress_callback,
                )
            )
        except asyncio.TimeoutError as exc:
            raise TimeoutError("多智能体辩论超时") from exc


__all__ = ["DebateEngine", "_parse_direction", "_parse_number"]
