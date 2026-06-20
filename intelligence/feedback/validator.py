from __future__ import annotations

from typing import List, Optional


class FeedbackValidator:
    """Strict validation for feedback records.

    Rejects:
    - invalid ratings (not in ``[1, 5]``)
    - malformed records (wrong types)
    - missing query IDs
    """

    @staticmethod
    def validate_rating(rating: Optional[int]) -> Optional[str]:
        """Return an error message if *rating* is invalid, or ``None``."""
        if rating is None:
            return None
        if not isinstance(rating, int):
            return "rating must be an integer"
        if rating < 1 or rating > 5:
            return "rating must be in [1, 5]"
        return None

    @staticmethod
    def validate_record(data: dict) -> Optional[str]:
        """Validate a raw dict as a potential FeedbackRecord.

        Returns ``None`` on success, or an error message string on failure.
        """
        if not isinstance(data, dict):
            return "record must be a dict"

        qid = data.get("query_id")
        if not qid or not isinstance(qid, str):
            return "missing or invalid query_id"

        query = data.get("query")
        if not query or not isinstance(query, str):
            return "missing or invalid query"

        qt = data.get("query_type")
        if qt not in ("SIMPLE", "COMPLEX", "MULTI_HOP", "UNKNOWN"):
            return f"invalid query_type: {qt}"

        rt = data.get("retrieval_type")
        if not rt or not isinstance(rt, str):
            return "missing or invalid retrieval_type"

        conf = data.get("confidence")
        if not isinstance(conf, (int, float)) or not (0.0 <= conf <= 1.0):
            return "confidence must be a float in [0.0, 1.0]"

        cal = data.get("calibrated_confidence")
        if not isinstance(cal, (int, float)) or not (0.0 <= cal <= 1.0):
            return "calibrated_confidence must be a float in [0.0, 1.0]"

        top_k = data.get("top_k")
        if not isinstance(top_k, int) or top_k < 1:
            return "top_k must be a positive integer"

        accepted = data.get("answer_accepted")
        if not isinstance(accepted, bool):
            return "answer_accepted must be a boolean"

        rating = data.get("answer_rating")
        err = FeedbackValidator.validate_rating(rating)
        if err:
            return err

        return None

    @staticmethod
    def validate_batch(records: List[dict]) -> List[str]:
        """Validate multiple records, returning a list of error messages."""
        return [
            err for r in records
            for err in ([FeedbackValidator.validate_record(r)] if FeedbackValidator.validate_record(r) else [])
        ]
