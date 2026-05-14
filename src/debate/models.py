"""Data models for multi-agent debate analysis."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional


@dataclass
class DebateStockInfo:
    """Basic stock snapshot consumed by the debate engine."""

    code: str
    name: str
    latest_price: float = 0.0
    change_amount: float = 0.0
    change_rate: float = 0.0
    open_price: float = 0.0
    high_price: float = 0.0
    low_price: float = 0.0
    prev_close: float = 0.0
    volume: float = 0.0
    amount: float = 0.0
    turnover_rate: float = 0.0
    pe_ratio: Optional[float] = None
    pb_ratio: Optional[float] = None
    total_market_cap: Optional[float] = None
    circulating_market_cap: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class DebateAgentReport:
    """Single specialist agent report."""

    agent_id: str
    agent_name: str
    agent_emoji: str
    analysis: str
    direction: str = "中性"
    confidence: float = 50.0
    error: str = ""
    model_used: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class DebateResult:
    """Complete multi-phase debate result."""

    agent_reports: List[DebateAgentReport] = field(default_factory=list)
    bull_argument: str = ""
    bear_argument: str = ""
    judge_verdict: str = ""
    final_direction: str = "中性"
    confidence: float = 50.0
    bull_win_rate: float = 50.0
    bear_win_rate: float = 50.0
    stock_name: str = ""
    stock_code: str = ""
    stock_price: float = 0.0
    stock_change_rate: float = 0.0
    total_llm_calls: int = 0
    total_time_seconds: float = 0.0
    completed_at: Optional[datetime] = None
    models_used: Dict[str, Any] = field(default_factory=dict)
    report_markdown: str = ""
    telegram_report: str = ""
    feishu_report: str = ""
    data_coverage: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["agent_reports"] = [report.to_dict() for report in self.agent_reports]
        data["completed_at"] = self.completed_at.isoformat() if self.completed_at else None
        return data

    def get_summary_text(self) -> str:
        direction_map = {
            "看涨": "📈 看涨",
            "看跌": "📉 看跌",
            "中性": "↔️ 中性",
        }
        direction = direction_map.get(self.final_direction, self.final_direction or "未知")
        return (
            f"{self.stock_name}({self.stock_code}) 多智能体辩论结论：{direction}，"
            f"信心度 {self.confidence:.0f}/100，多方胜率 {self.bull_win_rate:.0f}%，"
            f"空方胜率 {self.bear_win_rate:.0f}%"
        )
