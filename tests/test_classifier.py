"""Unit tests for the confidence-aware query classifier.

Covers:
- ResponseSchema includes confidence_score with correct default.
- classify_with_confidence() extracts confidence from LLM response.
- Both Gemini and OpenAI provider paths.
- Parse and API failure paths default to confidence=0.5.
- Backward compatibility: classify() still returns ResponseSchema.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from intelligence.classifier.query_classifier import ClassifyQuery, ResponseSchema


# ======================================================================
# ResponseSchema
# ======================================================================


class TestResponseSchema:
    """confidence_score field behaviour."""

    def test_default_confidence_is_0_5(self) -> None:
        schema = ResponseSchema(query_type="simple", domain=None)
        assert schema.confidence_score == 0.5

    def test_confidence_can_be_set(self) -> None:
        schema = ResponseSchema(
            query_type="complex", domain="law", confidence_score=0.87
        )
        assert schema.confidence_score == 0.87

    def test_confidence_type_is_float(self) -> None:
        schema = ResponseSchema(query_type="multi_hop", domain=None)
        assert isinstance(schema.confidence_score, float)

    def test_json_deserialisation_includes_confidence(self) -> None:
        payload = (
            '{"query_type": "complex", "domain": "finance", '
            '"confidence_score": 0.72}'
        )
        schema = ResponseSchema.model_validate_json(payload)
        assert schema.query_type == "complex"
        assert schema.domain == "finance"
        assert schema.confidence_score == 0.72

    def test_json_without_confidence_uses_default(self) -> None:
        payload = '{"query_type": "simple", "domain": null}'
        schema = ResponseSchema.model_validate_json(payload)
        assert schema.confidence_score == 0.5


# ======================================================================
# ClassifyQuery — Gemini provider
# ======================================================================


class TestClassifyQueryGemini:
    """classify_with_confidence() via the Gemini provider path."""

    def _make_classifier(self, mock_client: MagicMock) -> ClassifyQuery:
        return ClassifyQuery(
            client=mock_client,
            model_name="gemini-2.0-flash",
            model_provider="gemini",
        )

    def test_confidence_extracted_from_llm_response(self) -> None:
        """Valid parsed response: confidence should match LLM output."""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.parsed = ResponseSchema(
            query_type="complex", domain="finance", confidence_score=0.72
        )
        mock_client.models.generate_content.return_value = mock_response

        classifier = self._make_classifier(mock_client)
        result = classifier.classify_with_confidence("test query")

        assert result.query_type == "complex"
        assert result.domain == "finance"
        assert result.confidence_score == 0.72

    def test_high_confidence_preserved(self) -> None:
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.parsed = ResponseSchema(
            query_type="simple", domain="geography", confidence_score=0.97
        )
        mock_client.models.generate_content.return_value = mock_response

        classifier = self._make_classifier(mock_client)
        result = classifier.classify_with_confidence("easy query")
        assert result.confidence_score == 0.97

    def test_low_confidence_preserved(self) -> None:
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.parsed = ResponseSchema(
            query_type="multi_hop", domain="it", confidence_score=0.32
        )
        mock_client.models.generate_content.return_value = mock_response

        classifier = self._make_classifier(mock_client)
        result = classifier.classify_with_confidence("hard query")
        assert result.confidence_score == 0.32

    def test_api_failure_defaults_to_0_5(self) -> None:
        """When the LLM call itself raises, fall back to confidence=0.5."""
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = Exception(
            "Gemini API error"
        )

        classifier = self._make_classifier(mock_client)
        result = classifier.classify_with_confidence("failing query")

        assert result.query_type == "simple"
        assert result.domain is None
        assert result.confidence_score == 0.5

    def test_parse_failure_defaults_to_0_5(self) -> None:
        """When the Gemini response lacks a 'parsed' attribute (e.g. API
        returned raw text instead of structured JSON), the fallback
        returns confidence=0.5."""
        mock_client = MagicMock()

        class _RawResponse:
            """Simulates a Gemini response that was not parsed into JSON."""
            text = "I am not JSON"

        mock_client.models.generate_content.return_value = _RawResponse()

        classifier = self._make_classifier(mock_client)
        result = classifier.classify_with_confidence("bad parse query")

        assert result.query_type == "simple"
        assert result.domain is None
        assert result.confidence_score == 0.5

    def test_classify_still_works(self) -> None:
        """Backward-compat: the original classify() method still returns."""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.parsed = ResponseSchema(
            query_type="complex", domain="law", confidence_score=0.88
        )
        mock_client.models.generate_content.return_value = mock_response

        classifier = self._make_classifier(mock_client)
        result = classifier.classify("legal query")

        assert isinstance(result, ResponseSchema)
        assert result.query_type == "complex"


# ======================================================================
# ClassifyQuery — OpenAI / Ollama provider
# ======================================================================


class TestClassifyQueryOpenAI:
    """classify_with_confidence() via the OpenAI / Ollama provider path."""

    def _make_classifier(self, mock_client: MagicMock) -> ClassifyQuery:
        return ClassifyQuery(
            client=mock_client,
            model_name="gpt-4o-mini",
            model_provider="openai",
        )

    def _build_mock_response(
        self, json_str: str
    ) -> MagicMock:
        choice = MagicMock()
        choice.message.content = json_str
        response = MagicMock()
        response.choices = [choice]
        return response

    def test_confidence_extracted_from_llm_response(self) -> None:
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = (
            self._build_mock_response(
                '{"query_type": "simple", "domain": "tech", '
                '"confidence_score": 0.89}'
            )
        )

        classifier = self._make_classifier(mock_client)
        result = classifier.classify_with_confidence("openai query")

        assert result.query_type == "simple"
        assert result.domain == "tech"
        assert result.confidence_score == 0.89

    def test_api_failure_defaults_to_0_5(self) -> None:
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = Exception(
            "OpenAI API error"
        )

        classifier = self._make_classifier(mock_client)
        result = classifier.classify_with_confidence("failing query")

        assert result.query_type == "simple"
        assert result.domain is None
        assert result.confidence_score == 0.5

    def test_invalid_json_defaults_to_0_5(self) -> None:
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = (
            self._build_mock_response("not valid json")
        )

        classifier = self._make_classifier(mock_client)
        result = classifier.classify_with_confidence("bad json")

        assert result.query_type == "simple"
        assert result.domain is None
        assert result.confidence_score == 0.5

    def test_missing_confidence_field_uses_default(self) -> None:
        """LLM returns JSON without confidence_score → default 0.5."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = (
            self._build_mock_response(
                '{"query_type": "complex", "domain": null}'
            )
        )

        classifier = self._make_classifier(mock_client)
        result = classifier.classify_with_confidence("no conf field")

        assert result.query_type == "complex"
        assert result.confidence_score == 0.5

    def test_ollama_provider_works_same_as_openai(self) -> None:
        """Ollama uses the exact same code path as OpenAI."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = (
            self._build_mock_response(
                '{"query_type": "multi_hop", "domain": "research", '
                '"confidence_score": 0.41}'
            )
        )

        classifier = ClassifyQuery(
            client=mock_client,
            model_name="llama3",
            model_provider="ollama",
        )
        result = classifier.classify_with_confidence("ollama query")

        assert result.query_type == "multi_hop"
        assert result.confidence_score == 0.41

    def test_classify_still_works(self) -> None:
        """Backward-compat: the original classify() method still returns."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = (
            self._build_mock_response(
                '{"query_type": "simple", "domain": null, '
                '"confidence_score": 0.95}'
            )
        )

        classifier = self._make_classifier(mock_client)
        result = classifier.classify("old style call")

        assert isinstance(result, ResponseSchema)
        assert result.query_type == "simple"


# ======================================================================
# Unknown provider
# ======================================================================


class TestClassifyQueryUnknownProvider:
    """When model_provider is unrecognised, a safe default is returned."""

    def test_unknown_provider_returns_default(self) -> None:
        mock_client = MagicMock()
        classifier = ClassifyQuery(
            client=mock_client,
            model_name="unknown",
            model_provider="anthropic",
        )
        result = classifier.classify_with_confidence("test query")

        assert result.query_type == "simple"
        assert result.domain is None
        assert result.confidence_score == 0.5
