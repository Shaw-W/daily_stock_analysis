"""Debate data adapter that reuses the project's existing data providers."""
from __future__ import annotations

import json
import logging
from dataclasses import asdict, is_dataclass
from datetime import datetime
from typing import Any, Dict, Optional

import pandas as pd

from data_provider.base import DataFetcherManager, canonical_stock_code, normalize_stock_code
from src.debate.models import DebateStockInfo
from src.search_service import SearchService
from src.stock_analyzer import StockTrendAnalyzer

logger = logging.getLogger(__name__)


def _to_plain(value: Any) -> Any:
    """Convert common project objects into JSON-ish values for prompts."""
    if value is None:
        return None
    if is_dataclass(value):
        return asdict(value)
    if hasattr(value, "to_dict"):
        try:
            return value.to_dict()
        except Exception:
            pass
    if isinstance(value, dict):
        return {k: _to_plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_to_plain(v) for v in value]
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def _get_attr(obj: Any, *names: str, default: Any = None) -> Any:
    if obj is None:
        return default
    if isinstance(obj, dict):
        for name in names:
            if name in obj and obj[name] is not None:
                return obj[name]
        return default
    for name in names:
        val = getattr(obj, name, None)
        if val is not None:
            return val
    return default


def _safe_json(data: Any, max_chars: int = 6000) -> str:
    text = json.dumps(_to_plain(data), ensure_ascii=False, default=str, indent=2)
    if len(text) > max_chars:
        return text[:max_chars] + "\n...（已截断）"
    return text


class DebateDataAdapter:
    """Collect and format stock data for multi-agent debate prompts."""

    def __init__(self, manager: Optional[DataFetcherManager] = None):
        self.manager = manager or DataFetcherManager()
        self.trend_analyzer = StockTrendAnalyzer()
        self.search_service = SearchService()

    def build_context(self, stock_code: str, force_refresh: bool = False) -> Dict[str, Any]:
        """Build normalized debate context with explicit data coverage markers."""
        code = canonical_stock_code(stock_code)
        normalized = normalize_stock_code(code)
        coverage: Dict[str, str] = {}
        errors: Dict[str, str] = {}

        daily_df = pd.DataFrame()
        daily_source = ""
        try:
            daily_df, daily_source = self.manager.get_daily_data(normalized, days=90)
            coverage["daily_data"] = f"available:{daily_source}" if daily_df is not None and not daily_df.empty else "missing"
        except Exception as exc:
            coverage["daily_data"] = "missing"
            errors["daily_data"] = str(exc)
            logger.warning("辩论日线数据获取失败 %s: %s", code, exc)

        quote = None
        try:
            quote = self.manager.get_realtime_quote(normalized, log_final_failure=False)
            coverage["realtime_quote"] = "available" if quote is not None else "missing"
        except Exception as exc:
            coverage["realtime_quote"] = "missing"
            errors["realtime_quote"] = str(exc)
            logger.warning("辩论实时行情获取失败 %s: %s", code, exc)

        stock_name = (
            _get_attr(quote, "name", "stock_name")
            or self.manager.get_stock_name(normalized, allow_realtime=False)
            or code
        )

        trend = None
        if daily_df is not None and not daily_df.empty:
            try:
                trend = self.trend_analyzer.analyze(daily_df.copy(), normalized).to_dict()
                coverage["technical_indicators"] = "available"
            except Exception as exc:
                coverage["technical_indicators"] = "missing"
                errors["technical_indicators"] = str(exc)
                logger.warning("辩论技术分析失败 %s: %s", code, exc)
        else:
            coverage["technical_indicators"] = "missing"

        fundamental = {}
        try:
            fundamental = self.manager.get_fundamental_context(normalized)
            cov = fundamental.get("coverage") if isinstance(fundamental, dict) else None
            coverage["fundamental_context"] = "available" if cov else "partial_or_missing"
        except Exception as exc:
            coverage["fundamental_context"] = "missing"
            errors["fundamental_context"] = str(exc)
            logger.warning("辩论基本面上下文获取失败 %s: %s", code, exc)

        chip = None
        try:
            chip = self.manager.get_chip_distribution(normalized)
            coverage["chip_distribution"] = "available" if chip is not None else "missing"
        except Exception as exc:
            coverage["chip_distribution"] = "missing"
            errors["chip_distribution"] = str(exc)
            logger.warning("辩论筹码数据获取失败 %s: %s", code, exc)

        intel_text = "新闻/情报数据未获取或不可用。"
        try:
            intel = self.search_service.search_comprehensive_intel(normalized, stock_name, max_searches=3)
            intel_text = self.search_service.format_intel_report(intel, stock_name)
            coverage["news_intel"] = "available" if intel_text else "missing"
        except Exception as exc:
            coverage["news_intel"] = "missing"
            errors["news_intel"] = str(exc)
            logger.warning("辩论新闻情报获取失败 %s: %s", code, exc)

        stock_info = DebateStockInfo(
            code=code,
            name=str(stock_name),
            latest_price=float(_get_attr(quote, "price", "current_price", default=0) or 0),
            change_amount=float(_get_attr(quote, "change", "change_amount", default=0) or 0),
            change_rate=float(_get_attr(quote, "change_pct", "pct_chg", "change_rate", default=0) or 0),
            open_price=float(_get_attr(quote, "open", "open_price", default=0) or 0),
            high_price=float(_get_attr(quote, "high", "high_price", default=0) or 0),
            low_price=float(_get_attr(quote, "low", "low_price", default=0) or 0),
            prev_close=float(_get_attr(quote, "prev_close", "pre_close", default=0) or 0),
            volume=float(_get_attr(quote, "volume", default=0) or 0),
            amount=float(_get_attr(quote, "amount", "turnover", default=0) or 0),
            turnover_rate=float(_get_attr(quote, "turnover_rate", default=0) or 0),
            pe_ratio=_get_attr(quote, "pe_ratio"),
            pb_ratio=_get_attr(quote, "pb_ratio"),
            total_market_cap=_get_attr(quote, "total_mv", "total_market_cap"),
            circulating_market_cap=_get_attr(quote, "circ_mv", "circulating_market_cap"),
        )

        recent_daily = []
        if daily_df is not None and not daily_df.empty:
            cols = [c for c in ["date", "open", "high", "low", "close", "volume", "amount", "pct_chg"] if c in daily_df.columns]
            recent_daily = daily_df.tail(30)[cols].to_dict("records") if cols else daily_df.tail(30).to_dict("records")

        context = {
            "stock_info": stock_info,
            "coverage": coverage,
            "errors": errors,
            "daily_source": daily_source,
            "recent_daily": recent_daily,
            "realtime_quote": _to_plain(quote),
            "trend": trend,
            "fundamental": fundamental,
            "chip_distribution": _to_plain(chip),
            "news_intel_text": intel_text,
            "generated_at": datetime.now().isoformat(),
            "force_refresh": force_refresh,
        }
        context["agent_input"] = self.format_agent_input(context)
        return context

    def format_agent_input(self, context: Dict[str, Any]) -> str:
        stock: DebateStockInfo = context["stock_info"]
        coverage = context.get("coverage") or {}
        missing = [k for k, v in coverage.items() if "missing" in str(v) or "not_supported" in str(v)]
        return "\n".join([
            f"# {stock.name}（{stock.code}）多智能体辩论数据包",
            "",
            "## 使用原则",
            "- 必须基于下列数据判断；缺失字段已显式标注，不能编造。",
            "- 对缺失/不可用数据对应维度降权，必要时降低信心度。",
            "",
            "## 数据覆盖率",
            _safe_json(coverage, 2000),
            f"缺失或不可用维度：{', '.join(missing) if missing else '暂无明显缺失'}",
            "",
            "## 实时行情",
            _safe_json(stock.to_dict(), 3000),
            "",
            "## 最近日线（最多 30 条）",
            _safe_json(context.get("recent_daily"), 5000),
            "",
            "## 技术趋势分析",
            _safe_json(context.get("trend"), 4000),
            "",
            "## 基本面/估值/资金流/龙虎榜/板块上下文",
            _safe_json(context.get("fundamental"), 6000),
            "",
            "## 筹码分布",
            _safe_json(context.get("chip_distribution"), 3000),
            "",
            "## 新闻与事件情报",
            str(context.get("news_intel_text") or "新闻/情报数据不足。")[:6000],
        ])
