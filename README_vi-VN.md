[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md) | [Español](README_es-ES.md) | [한국어](README_ko-KR.md) | [Tiếng Việt](README_vi-VN.md)

# DocWen Assistant - Plugin cho Obsidian

Plugin Obsidian dành cho ứng dụng desktop [DocWen](https://github.com/ZHYX91/docwen).

## ✨ Tính năng

### Tính năng chính
- ✅ **Khởi chạy nhanh từ thanh bên**: thêm biểu tượng ở sidebar để khởi chạy một chạm
- ✅ **Tự động truyền tệp**: tự động gửi đường dẫn tệp đang mở sang DocWen
- ✅ **Tích hợp Command Palette**: truy cập nhanh bằng Ctrl/Cmd + P
- ✅ **Xuất nền (CLI)**: xuất sang Word/Excel/Markdown bằng DocWenCLI.exe mà không mở GUI (có thể hiển thị hộp chọn khi cần)
- ✅ **Đánh số tiêu đề (CLI)**: thêm/xóa đánh số tiêu đề Markdown bằng DocWenCLI.exe
- ✅ **Kiểm tra doctor (CLI)**: kiểm tra môi trường/chẩn đoán một chạm
- ✅ **Xác thực đường dẫn**: kiểm tra đường dẫn tệp thực thi theo thời gian thực
- ✅ **Chọn tệp**: chọn tệp thực thi qua hộp thoại duyệt
- ✅ **Phản hồi thành công**: thông báo thân thiện khi khởi chạy
- ✅ **Menu chuột phải**: Nhấp chuột phải vào tệp trong trình duyệt → menu con DocWen (chuyển đổi định dạng, đánh số tiêu đề, mở trong DocWen)
- ✅ **Quản lý một phiên bản**: tự động gửi tệp cho phiên bản đang chạy
- ✅ **Hỗ trợ đa ngôn ngữ**: 11 ngôn ngữ (zh-CN, zh-TW, en, de, fr, ru, pt-BR, ja, ko, es, vi)

---

## 📦 Bắt đầu nhanh

### Chuẩn bị

1. **Cài Node.js**
   - Truy cập [Node.js](https://nodejs.org/)
   - Tải và cài bản LTS
   - Kiểm tra: `node -v` và `npm -v`

2. **Cài dependencies**
   ```bash
   npm install
   ```

### Chế độ phát triển

```bash
npm run dev
```

### Build plugin

#### Build nhanh (không kiểm tra type)
```bash
npm run build:quick
```

#### Build đầy đủ (kiểm tra type + nén)
```bash
npm run build
```

#### Build release (đóng gói tự động)
```bash
npm run release
# Hoặc chạy trực tiếp: node scripts/build.js
```

---

## 🚀 Cài đặt vào Obsidian

### Cách 1: Tải bản phát hành (Khuyến nghị)

1. Truy cập trang [GitHub Releases](https://github.com/ZHYX91/docwen-obsidian/releases)
2. Tải xuống và giải nén phiên bản mới nhất
3. Sao chép thư mục `docwen-assistant` vào `<Vault của bạn>/.obsidian/plugins/`
4. Trong Obsidian: `Cài đặt` → `Plugin cộng đồng` → `Tải lại plugin` → Bật `DocWen Assistant`

### Cách 2: Biên dịch từ mã nguồn

1. Cài đặt phụ thuộc và biên dịch:
   ```bash
   npm install
   npm run release
   ```
2. Sao chép thư mục `release/docwen-assistant` vào `<Vault của bạn>/.obsidian/plugins/`
3. Tải lại và bật plugin trong Obsidian

---

## ⚙️ Cấu hình

1. Mở Obsidian `Settings` → `Community plugins` → `DocWen Assistant`

2. Thiết lập đường dẫn tệp thực thi GUI hoặc CLI (chỉ cần một):
   - Đường dẫn đầy đủ đến `DocWen.exe` hoặc `DocWenCLI.exe`
   - Nếu chỉ đặt một, plugin sẽ tự dò cái còn lại trong cùng thư mục

3. Xác thực đường dẫn:
   - ✓ Màu xanh: đường dẫn hợp lệ
   - ✗ Màu đỏ: đường dẫn không hợp lệ hoặc không tìm thấy tệp

---

## 📖 Cách dùng

### Khởi chạy DocWen

3 cách:

1. **Biểu tượng sidebar**
   - Bấm biểu tượng tài liệu ở thanh bên trái

2. **Command Palette**
   - Nhấn `Ctrl/Cmd + P` và tìm “Khởi chạy DocWen”

3. **Khởi chạy với tệp hiện tại**
   - Tìm “Khởi chạy DocWen với tệp hiện tại”
   - Chỉ hiện khi đang mở một tệp

### Xuất nền (CLI, không mở GUI)

Tìm trong Command Palette:
- “Xuất Word (Docx) chạy nền” — với tệp `.md`/`.markdown`/`.txt`, chọn một template
- “Xuất Excel (XLSX) chạy nền” — với tệp `.md`/`.markdown`/`.txt`, chọn một template
- “Xuất Markdown (MD) chạy nền” — nếu có loại tối ưu phù hợp với loại tệp và ngôn ngữ, hãy chọn một (hoặc bỏ qua)

Cần `DocWenCLI.exe`.

### Menu chuột phải

Nhấp chuột phải vào tệp trong trình duyệt tệp để xem menu con **DocWen**. Các thao tác khả dụng phụ thuộc vào loại tệp:

- **Chuyển đổi sang Markdown** — cho tệp docx, xlsx, pdf, hình ảnh, v.v.
- **Chuyển đổi sang Word (Docx)** / **Chuyển đổi sang Excel (XLSX)** — cho tệp `.md`/`.markdown`/`.txt`
- **Thêm/Xóa đánh số tiêu đề** — chỉ cho tệp `.md`
- **Mở trong DocWen** — khả dụng cho tất cả tệp

### Đánh số tiêu đề (CLI)

Tìm:
- “Thêm đánh số vào tiêu đề Markdown” — chọn một kiểu đánh số
- “Xóa đánh số tiêu đề Markdown”

Chỉ khả dụng khi đang mở tệp `.md`. Cần `DocWenCLI.exe`.

### Kiểm tra doctor (CLI)

Tìm:
- “Kiểm tra doctor của DocWen”

Cần `DocWenCLI.exe`.

### Tự động truyền tệp

- Nếu đang mở một tệp, plugin sẽ tự động gửi đường dẫn đầy đủ sang DocWen
- Nếu không có tệp mở, chỉ khởi chạy DocWen

### Quản lý một phiên bản

- **Lần bấm đầu** → Khởi chạy DocWen và gửi tệp hiện tại
- **Bấm lại (có tệp)** → Thay bằng tệp mới (chế độ một tệp)
- **Bấm lại (không có tệp)** → Kích hoạt cửa sổ DocWen

---

## 🛠️ Script phát triển

| Lệnh | Mô tả |
|------|------|
| `npm run dev` | Phát triển (watch) |
| `npm run build` | Build đầy đủ (type + nén) |
| `npm run build:quick` | Build nhanh (không type) |
| `npm run lint` | Kiểm tra ESLint |
| `npm run lint:fix` | Tự động sửa ESLint |
| `node version-bump.js [patch\|minor\|major]` | Tăng phiên bản |
| `npm run release` | Tạo gói release |

---

## 📁 Cấu trúc dự án

```
docwen-obsidian/
├── src/
│   ├── main.ts
│   ├── settings.ts
│   ├── i18n.ts
│   └── utils/
│       └── suggest-modal.ts
├── dist/
│   └── main.js
├── docs/
│   └── plugin-readme/
├── scripts/
│   ├── build.bat
│   ├── build.js
│   └── README.md
├── release/
├── manifest.json
├── package.json
├── tsconfig.json
├── eslint.config.cjs
├── .gitignore
├── version-bump.js
└── README*.md
```

---

## 🐛 Khắc phục sự cố

### Plugin không tải
1. Kiểm tra đã copy đúng `main.js` và `manifest.json`
2. Bấm `Reload plugins` trong Obsidian
3. Xem console (`Ctrl/Cmd + Shift + I`)

### Không khởi chạy được DocWen
1. Kiểm tra đường dẫn tệp thực thi
2. Xác nhận trạng thái đường dẫn màu xanh ✓
3. Kiểm tra quyền chạy

### Không gửi được đường dẫn tệp
1. Đảm bảo đang có tệp mở
2. Kiểm tra ký tự đặc biệt trong đường dẫn
3. Kiểm tra log/console để xem tham số

---

## 📜 Giấy phép

Dự án này được cấp phép theo MIT License.

### Liên hệ

- **GitHub**: https://github.com/ZHYX91/docwen-obsidian
- **DocWen**: https://github.com/ZHYX91/docwen
- **Tác giả**: zhengyx91@hotmail.com
