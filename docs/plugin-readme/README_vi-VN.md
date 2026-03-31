[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md) | [Español](README_es-ES.md) | [한국어](README_ko-KR.md) | [Tiếng Việt](README_vi-VN.md)

# DocWen Assistant

Plugin Obsidian để khởi chạy bộ chuyển đổi DocWen.

## Cài đặt

1. Sao chép thư mục này vào `.obsidian/plugins/` trong vault Obsidian của bạn
2. Tải lại plugin trong phần cài đặt Obsidian
3. Bật plugin “DocWen Assistant”
4. Cấu hình đường dẫn `DocWen.exe` hoặc `DocWenCLI.exe` trong phần cài đặt plugin (chỉ cần một)

## Cách dùng

- Nhấn icon tài liệu ở thanh bên để khởi chạy DocWen
- Mở Command Palette (Ctrl/Cmd + P) và tìm “DocWen”
- Nếu có file đang mở, đường dẫn sẽ được tự động gửi sang DocWen

### Xuất nền (cần DocWenCLI.exe)

- “Xuất Word (Docx) chạy nền” — với file `.md`/`.markdown`/`.txt`, chọn template
- “Xuất Excel (XLSX) chạy nền” — với file `.md`/`.markdown`/`.txt`, chọn template
- “Xuất Markdown (MD) chạy nền” — chọn loại tối ưu nếu có (hoặc bỏ qua)

### Đánh số tiêu đề (cần DocWenCLI.exe)

- “Thêm đánh số vào tiêu đề Markdown” — chọn kiểu đánh số
- “Xóa đánh số tiêu đề Markdown”

Chỉ áp dụng cho file `.md`.

### Menu chuột phải

Nhấp chuột phải vào tệp trong trình duyệt tệp để xem menu con **DocWen**:

- **Chuyển đổi sang Markdown** — cho tệp docx, xlsx, pdf, hình ảnh, v.v.
- **Chuyển đổi sang Word (Docx)** / **Chuyển đổi sang Excel (XLSX)** — cho tệp `.md`/`.markdown`/`.txt`
- **Thêm/Xóa đánh số tiêu đề** — chỉ cho tệp `.md`
- **Mở trong DocWen** — khả dụng cho tất cả tệp

### Chẩn đoán (cần DocWenCLI.exe)

- “Kiểm tra doctor của DocWen” — kiểm tra môi trường và phụ thuộc

## Các file bao gồm

- `main.js` - Mã chính của plugin
- `manifest.json` - Manifest plugin
- `styles.css` - CSS (nếu có)
- `README*.md` - Tài liệu

Xem thêm ở trang cài đặt của plugin.

## Liên kết

- Repo plugin: https://github.com/ZHYX91/docwen-obsidian
- Repo DocWen: https://github.com/ZHYX91/docwen
