"""Dependency-free PDF generator for the AI mental health report.

Produces valid multi-page PDFs with bold section headings and plain text
(WinAnsi-safe). No external dependencies.
"""

PAGE_W, PAGE_H = 612, 792
MARGIN = 50
LINE_H = 16
TITLE_H = 30

REGULAR = "F1"
BOLD = "F2"


def _safe_text(text: str) -> str:
    out = []
    for ch in str(text):
        if ch in "()\\":
            out.append("\\" + ch)
        elif ord(ch) < 128:
            out.append(ch)
        elif 160 <= ord(ch) <= 255:
            out.append(ch)
        else:
            out.append("?")
    return "".join(out)


def _normalize(lines: list) -> list[tuple[str, str]]:
    """Convert mixed line input into (font, text) tuples.

    Plain strings are regular text. Tuples:
      ("H", text)  -> bold section heading
      ("T", text)  -> regular text
      ("E", text)  -> empty/spacer line
      ("F1"/"F2", text) -> passed through as-is (already-resolved font)
    """
    out: list[tuple[str, str]] = []
    for line in lines:
        if isinstance(line, tuple) and len(line) == 2 and isinstance(line[0], str):
            kind, text = line
            if kind == "H":
                out.append((REGULAR, ""))
                out.append((BOLD, str(text)))
                out.append((REGULAR, ""))
            elif kind == "E":
                out.append((REGULAR, str(text)))
            elif kind in (REGULAR, BOLD):
                out.append((kind, str(text)))
            else:
                out.append((REGULAR, str(text)))
        else:
            out.append((REGULAR, str(line)))
    return out


def _content_stream(items: list[tuple[str, str]]) -> bytes:
    y = PAGE_H - MARGIN - TITLE_H
    parts = ["BT", "/F1 11 Tf", f"{MARGIN} {y} Td"]
    for font, text in items:
        parts.append(f"/{font} 11 Tf")
        parts.append(f"({_safe_text(text)}) Tj")
        y -= LINE_H
        parts.append(f"0 {-LINE_H} Td")
    parts.append("ET")
    return ("\n".join(parts) + "\n").encode("latin-1", "replace")


def build_pdf(title: str, lines: list, subtitle: str = "") -> bytes:
    """Build a multi-page PDF report.

    `title` and optional `subtitle` render as the document header on the first
    page. `lines` accepts plain strings plus ("H", text) / ("T", text) tuples.
    """
    items: list[tuple[str, str]] = [(BOLD, str(title))]
    if subtitle:
        items.append((REGULAR, str(subtitle)))
    items.append(("E", ""))
    items = _normalize(items + list(lines))

    max_lines = (PAGE_H - 2 * MARGIN - TITLE_H - 10) // LINE_H
    pages_items = [items[i:i + max_lines] for i in range(0, len(items), max_lines)]
    if not pages_items:
        pages_items = [items]

    objects = []
    # 1: Catalog, 2: Pages, 3: Helvetica (F1), 4: Helvetica-Bold (F2)
    # then interleaved page/content pairs (5: page1, 6: content1, 7: page2, ...)
    page_ids = []
    content_objs = []
    next_obj = 5
    for _pl in pages_items:
        page_ids.append(next_obj)
        content_objs.append(next_obj + 1)
        next_obj += 2
    kids = " ".join(f"{p} 0 R" for p in page_ids)
    objects.append("<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>")
    objects.append("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    objects.append("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")

    streams = [_content_stream(pl) for pl in pages_items]

    for i in range(len(pages_items)):
        objects.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_W} {PAGE_H}] "
            f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {content_objs[i]} 0 R >>"
        )
        objects.append(f"<< /Length {len(streams[i])} >>\nstream\n".encode("latin-1") + streams[i] + b"\nendstream")

    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    offset = len(out)
    for i, o in enumerate(objects):
        offsets.append(offset)
        if isinstance(o, str):
            obj_body = f"{i + 1} 0 obj\n{o}\nendobj\n"
            out += obj_body.encode("latin-1")
        else:
            out += f"{i + 1} 0 obj\n".encode("latin-1")
            out += o
            out += b"\nendobj\n"
        offset = len(out)

    xref_pos = len(out)
    out += b"xref\n0 " + str(len(objects) + 1).encode() + b"\n"
    out += b"0000000000 65535 f \n"
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += (f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n").encode("latin-1")
    return bytes(out)
