from pypdf import PdfReader
from pypdf.errors import PdfReadError
import io


def load_document(content: bytes, mime_type: str) -> str:

    if mime_type == "application/pdf":
        try:
            pdf_reader = PdfReader(io.BytesIO(content))
        except (PdfReadError, ValueError, TypeError) as e:
            raise ValueError(
                f"Couldn't read content from the bytes. ERROR : {e}"
            ) from e

        num_pages = len(pdf_reader.pages)
        pages = []
        for i in range(num_pages):
            try:
                page = pdf_reader.pages[i]
                pages.append(page.extract_text())
            except (PdfReadError, IndexError, TypeError) as e:
                raise ValueError(f"Couldn't extract text. ERROR : {e}") from e
        return "".join(pages)

    elif mime_type == "text/plain":
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError as e:
            raise ValueError(
                f"Couldn't convert the text file content. ERROR : {e} "
            ) from e

        return text
    else:
        raise ValueError("Unsupported File")
