"""Business service for independent multi-agent debate analysis."""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional

from src.config import Config, get_config
from src.debate.data_adapter import DebateDataAdapter
from src.debate.engine import DebateEngine
from src.debate.models import DebateResult
from src.debate.reporting import render_debate_report

logger = logging.getLogger(__name__)

ProgressCallback = Optional[Callable[[int, str], None]]


@dataclass
class _HistoryDebateRecord:
    code: str
    name: str
    sentiment_score: int
    operation_advice: str
    trend_prediction: str
    analysis_summary: str
    raw_response: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {}


def _direction_to_advice(direction: str) -> str:
    if direction == "看涨":
        return "关注/持有"
    if direction == "看跌":
        return "减仓/观望"
    return "观望"


def _direction_to_prediction(direction: str) -> str:
    if direction == "看涨":
        return "偏多"
    if direction == "看跌":
        return "偏空"
    return "震荡"


class DebateAnalysisService:
    """Prepare data, run debate, persist report, and optionally notify."""

    def __init__(self, config: Optional[Config] = None):
        self.config = config or get_config()
        self.last_error: Optional[str] = None

    def run_debate_analysis(
        self,
        stock_code: str,
        query_id: Optional[str] = None,
        progress_callback: ProgressCallback = None,
        notify: bool = True,
        force_refresh: bool = False,
    ) -> Optional[Dict[str, Any]]:
        self.last_error = None
        query_id = query_id or uuid.uuid4().hex
        try:
            if not getattr(self.config, "enable_debate_analysis", True):
                raise RuntimeError("多智能体辩论分析未启用，请在设置页开启 ENABLE_DEBATE_ANALYSIS")

            if progress_callback:
                progress_callback(10, "准备辩论数据")
            adapter = DebateDataAdapter()
            context = adapter.build_context(stock_code, force_refresh=force_refresh)
            if progress_callback:
                progress_callback(25, "数据采集完成")

            engine = DebateEngine(config=self.config)
            result = engine.run_debate(
                stock_info=context["stock_info"],
                agent_input=context["agent_input"],
                data_coverage=context.get("coverage"),
                progress_callback=progress_callback,
            )

            result.report_markdown = render_debate_report(result, "markdown")
            result.telegram_report = render_debate_report(result, "telegram")
            result.feishu_report = render_debate_report(result, "feishu")

            self._save_history(result, query_id, context)
            if notify:
                self._send_notification(result)
            if progress_callback:
                progress_callback(100, "辩论分析保存完成")
            return self._build_response(result, query_id)
        except Exception as exc:
            self.last_error = str(exc)
            logger.error("辩论分析失败 %s: %s", stock_code, exc, exc_info=True)
            return None

    def _save_history(self, result: DebateResult, query_id: str, context: Dict[str, Any]) -> None:
        try:
            from src.storage import DatabaseManager

            record = _HistoryDebateRecord(
                code=result.stock_code,
                name=result.stock_name,
                sentiment_score=int(round(result.confidence)),
                operation_advice=_direction_to_advice(result.final_direction),
                trend_prediction=_direction_to_prediction(result.final_direction),
                analysis_summary=result.get_summary_text(),
                raw_response=result.report_markdown,
            )
            # Let storage build the standard row, then include full DebateResult in raw_result via to_dict.
            record.to_dict = lambda: {  # type: ignore[method-assign]
                **result.to_dict(),
                "model_used": result.models_used,
                "report_markdown": result.report_markdown,
            }
            DatabaseManager.get_instance().save_analysis_history(
                result=record,
                query_id=query_id,
                report_type="debate",
                news_content=result.report_markdown,
                context_snapshot={
                    "debate_context": {
                        "coverage": context.get("coverage"),
                        "errors": context.get("errors"),
                        "daily_source": context.get("daily_source"),
                    }
                },
                save_snapshot=True,
            )
        except Exception as exc:
            logger.warning("保存辩论历史失败 %s/%s: %s", result.stock_code, query_id, exc, exc_info=True)

    def _send_notification(self, result: DebateResult) -> None:
        try:
            from src.notification import NotificationService

            service = NotificationService()
            service.send(
                result.telegram_report or result.report_markdown,
                email_stock_codes=[result.stock_code],
                route_type="report",
                severity="info",
                dedup_key=f"debate:{result.stock_code}:{result.completed_at}",
            )
        except Exception as exc:
            logger.warning("辩论通知发送失败 %s: %s", result.stock_code, exc, exc_info=True)

    def _build_response(self, result: DebateResult, query_id: str) -> Dict[str, Any]:
        report = {
            "meta": {
                "query_id": query_id,
                "stock_code": result.stock_code,
                "stock_name": result.stock_name,
                "report_type": "debate",
                "report_language": "zh",
                "created_at": result.completed_at.isoformat() if result.completed_at else None,
                "current_price": result.stock_price,
                "change_pct": result.stock_change_rate,
                "model_used": result.models_used,
            },
            "summary": {
                "analysis_summary": result.get_summary_text(),
                "operation_advice": _direction_to_advice(result.final_direction),
                "trend_prediction": _direction_to_prediction(result.final_direction),
                "sentiment_score": int(round(result.confidence)),
                "sentiment_label": result.final_direction,
            },
            "strategy": {},
            "details": {
                "news_content": result.report_markdown,
                "raw_result": result.to_dict(),
                "context_snapshot": {"data_coverage": result.data_coverage},
            },
        }
        return {
            "query_id": query_id,
            "stock_code": result.stock_code,
            "stock_name": result.stock_name,
            "report": report,
            "created_at": result.completed_at.isoformat() if result.completed_at else "",
        }
