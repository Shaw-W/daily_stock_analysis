# -*- coding: utf-8 -*-
"""Schemas for independent debate analysis API."""
from __future__ import annotations

from typing import Any, List, Optional

from pydantic import BaseModel, Field


class DebateAnalyzeRequest(BaseModel):
    """Debate analysis request; first phase is always asynchronous."""

    stock_code: Optional[str] = Field(None, description="单只股票代码", example="600519")
    stock_codes: Optional[List[str]] = Field(None, description="批量股票代码", example=["600519", "000858"])
    notify: bool = Field(True, description="是否发送辩论报告通知")
    force_refresh: bool = Field(False, description="是否强制刷新数据")


class DebateTaskAccepted(BaseModel):
    task_id: str = Field(..., description="任务 ID")
    status: str = Field(..., description="任务状态", pattern="^(pending|processing)$")
    message: Optional[str] = Field(None, description="提示信息")


class DebateBatchTaskAcceptedItem(BaseModel):
    task_id: str = Field(..., description="任务 ID")
    stock_code: str = Field(..., description="股票代码")
    status: str = Field(..., description="任务状态", pattern="^(pending|processing)$")
    message: Optional[str] = Field(None, description="提示信息")


class DebateDuplicateTaskItem(BaseModel):
    stock_code: str = Field(..., description="股票代码")
    existing_task_id: str = Field(..., description="已存在的任务 ID")
    message: str = Field(..., description="重复提交说明")


class DebateBatchTaskAcceptedResponse(BaseModel):
    accepted: List[DebateBatchTaskAcceptedItem] = Field(default_factory=list, description="成功提交的任务")
    duplicates: List[DebateDuplicateTaskItem] = Field(default_factory=list, description="重复跳过的任务")
    message: str = Field(..., description="汇总信息")


class DebateResultResponse(BaseModel):
    query_id: str = Field(..., description="查询 ID")
    stock_code: str = Field(..., description="股票代码")
    stock_name: Optional[str] = Field(None, description="股票名称")
    report: Optional[Any] = Field(None, description="辩论报告")
    created_at: str = Field(..., description="创建时间")
