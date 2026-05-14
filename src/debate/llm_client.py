"""LiteLLM client for debate analysis with per-phase model selection."""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional, Tuple

import litellm
from litellm import Router

from src.agent.llm_adapter import get_thinking_extra_body
from src.config import (
    Config,
    extra_litellm_params,
    get_api_keys_for_model,
    get_config,
    get_configured_llm_models,
    normalize_litellm_temperature,
)
from src.storage import persist_llm_usage

logger = logging.getLogger(__name__)


class DebateLLMClient:
    """Small LiteLLM wrapper that can call a caller-specified model."""

    def __init__(self, config: Optional[Config] = None):
        self.config = config or get_config()
        self._router: Optional[Router] = None
        if self._has_channel_config():
            self._router = Router(
                model_list=self.config.llm_model_list,
                routing_strategy="simple-shuffle",
                num_retries=2,
            )

    def _has_channel_config(self) -> bool:
        return bool(self.config.llm_model_list) and not all(
            str(e.get("model_name", "")).startswith("__legacy_")
            for e in self.config.llm_model_list
        )

    def _dispatch(self, model: str, call_kwargs: Dict[str, Any]) -> Any:
        router_model_names = set(get_configured_llm_models(self.config.llm_model_list))
        if self._router and model in router_model_names:
            return self._router.completion(**call_kwargs)

        effective_kwargs = dict(call_kwargs)
        keys = get_api_keys_for_model(model, self.config)
        if keys:
            effective_kwargs["api_key"] = keys[0]
        effective_kwargs.update(extra_litellm_params(model, self.config))
        return litellm.completion(**effective_kwargs)

    @staticmethod
    def _normalize_usage(usage_obj: Any) -> Dict[str, int]:
        if not usage_obj:
            return {}

        def _get(key: str) -> int:
            if isinstance(usage_obj, dict):
                return int(usage_obj.get(key) or 0)
            return int(getattr(usage_obj, key, 0) or 0)

        return {
            "prompt_tokens": _get("prompt_tokens"),
            "completion_tokens": _get("completion_tokens"),
            "total_tokens": _get("total_tokens"),
        }

    def generate(
        self,
        *,
        system_prompt: str,
        user_content: str,
        model: str,
        call_type: str,
        stock_code: Optional[str] = None,
        max_tokens: int = 4096,
        temperature: Optional[float] = None,
    ) -> Tuple[str, str, Dict[str, Any]]:
        """Generate one LLM response with a concrete model."""
        if not model:
            raise ValueError("未配置可用 LLM 模型")

        model_short = model.split("/")[-1] if "/" in model else model
        extra = get_thinking_extra_body(model_short)
        call_kwargs: Dict[str, Any] = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            "temperature": normalize_litellm_temperature(
                model,
                self.config.llm_temperature if temperature is None else temperature,
                model_list=self.config.llm_model_list,
                request_overrides={"extra_body": extra} if extra else None,
            ),
            "max_tokens": max_tokens,
        }
        if extra:
            call_kwargs["extra_body"] = extra

        response = self._dispatch(model, call_kwargs)
        if not response or not response.choices or not response.choices[0].message.content:
            raise RuntimeError("LLM returned empty response")

        content = response.choices[0].message.content
        usage = self._normalize_usage(getattr(response, "usage", None))
        persist_llm_usage(usage, model, call_type=call_type, stock_code=stock_code)
        return content, model, usage
