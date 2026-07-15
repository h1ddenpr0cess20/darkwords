# Documents & Attachments

You can attach files to a message. What happens to them depends on the provider
and file type.

## On Anthropic

- **Images** and **PDFs** are sent as native content blocks — Claude reads them
  directly.
- **Text files** are inlined into the message.

Attachments are stored inline on the message as data URLs (`Attachment` in
`src/types/index.ts`), so a conversation carries its own files.

## On LM Studio (local RAG)

Local models don't get Anthropic's file blocks, so attached documents are
**indexed and searched locally** instead:

1. The file is parsed to text (`src/lib/rag/parsers/`).
2. Text is chunked and embedded with an LM Studio **embedding model**
   (`src/lib/rag/embeddings.ts`).
3. At query time, the most relevant chunks are retrieved and added to the
   prompt (`src/lib/rag/retrieval.ts`).

This is the **document search (RAG)** tool from [Tools](tools.md). It needs an
embedding model loaded in LM Studio — pin one in **Settings → Model** or let
Darkwords auto-detect. See [LM Studio](lm-studio.md).

## Supported document types

The parser set (`src/lib/rag/parsers/`) covers common document formats:

- PDF (`pdf`)
- Word (`doc`, `docx`)
- OpenDocument (`odf`)
- Rich Text (`rtf`)
- PowerPoint (`pptx`)
- Excel (`xlsx`)
- EPUB (`epub`) and MOBI (`mobi`)
- ZIP archives (`zip`), unpacked and parsed within

Plain text and Markdown are handled directly.

## Generated files

When code execution writes files out, they surface on the message as downloadable
attachments (`generatedFiles`), rendered with a download affordance in
`MessageRow`.
