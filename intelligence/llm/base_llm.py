from abc import abstractmethod, ABC
from pathlib import Path


class BaseLLM(ABC):
    def __init__(self, client, model_name):
        self.client = client
        self.model = model_name

        prompt_path = Path(__file__).parent / "llm_prompt.txt"
        try:
            with open(prompt_path, mode="r") as f:
                self.raw_prompt = f.read()
        except (OSError, UnicodeDecodeError) as e:
            raise ValueError(f"Unable to open the prompt file. ERROR: {e}") from e

    @abstractmethod
    def get_response(self, query: str, chunks: list[str]):
        raise NotImplementedError

    @abstractmethod
    def complete(self, prompt: str) -> str:
        """Run a raw completion with a caller-supplied prompt.

        Unlike ``get_response`` this does not wrap the prompt in the QA
        template, so callers (e.g. LLM judges) control the full system
        instruction themselves.
        """
        raise NotImplementedError
