# Format examples

These synthetic documents exercise file admission and the open-in-DocWen workflow.
They contain a short paragraph, a two-column table, a title slide, a simple image,
or a one-page vector drawing. They contain no user documents or Vault data.

Office XML files were created with python-docx, openpyxl, and python-pptx. Legacy
Office, RTF, ODT, and ODS examples were exported with LibreOffice. WPS and ET files
reuse the corresponding legacy Office containers; they test extension admission,
not documents produced by WPS. Images were created with Pillow and pillow-heif;
PDF with PyMuPDF. Markup, EPUB, ENEX, XPS, and OFD containers were authored directly.

The files are provided under this repository's MIT license. Their identities are
listed in `acceptance/format-fixtures.json`. Enable Obsidian's detection of all
file extensions when inspecting the non-Markdown examples in the file explorer.
