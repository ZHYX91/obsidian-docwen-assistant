[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md) | [Español](README_es-ES.md) | [한국어](README_ko-KR.md) | [Tiếng Việt](README_vi-VN.md)

# DocWen Assistant - Plugin Obsidian

Một plugin Obsidian dành cho ứng dụng máy tính [DocWen](https://github.com/ZHYX91/docwen).

## ✨ Tính năng

### Tính năng cốt lõi
- ✅ **Khởi chạy nhanh ở thanh bên**: Thêm biểu tượng vào thanh bên của Obsidian để mở DocWen chỉ với 1 lần nhấp
- ✅ **Tự động truyền tệp**: Tự động truyền đường dẫn tệp đang mở sang DocWen
- ✅ **Tích hợp Command Palette**: Truy cập nhanh qua Ctrl/Cmd + P
- ✅ **Xác thực đường dẫn**: Kiểm tra đường dẫn file thực thi theo thời gian thực
- ✅ **Trình chọn tệp**: Dễ dàng chọn file thực thi bằng hộp thoại duyệt
- ✅ **Phản hồi thành công**: Thông báo thân thiện khi khởi chạy
- ✅ **Quản lý một phiên chạy**: Tự động gửi tệp tới phiên đang chạy
- ✅ **Hỗ trợ đa ngôn ngữ**: Hỗ trợ 11 ngôn ngữ (zh-CN, zh-TW, en, de, fr, ru, pt, ja, es-ES, ko-KR, vi-VN)

---

## 📦 Bắt đầu nhanh

### Yêu cầu trước

1. **Cài đặt Node.js**
   - Truy cập [Trang chính thức Node.js](https://nodejs.org/)
   - Tải và cài bản LTS
   - Kiểm tra cài đặt: `node -v` và `npm -v`

2. **Cài đặt phụ thuộc**
   ```bash
   npm install
   ```

### Chế độ phát triển

Dùng chế độ watch trong quá trình phát triển để tự động biên dịch lại khi có thay đổi:

```bash
npm run dev
```

### Build plugin

#### Build nhanh (không kiểm tra kiểu)
```bash
npm run build:quick
```

#### Build đầy đủ (có kiểm tra kiểu và nén/minify)
```bash
npm run build
```

#### Build phát hành (tự đóng gói)
```bash
npm run release
# Hoặc chạy trực tiếp: node scripts/build.js
```

Lệnh này sẽ:
1. Biên dịch mã TypeScript
2. Tạo thư mục release
3. Sao chép các tệp cần thiết
4. Tạo hướng dẫn sử dụng

---

## 🚀 Cài vào Obsidian

### Cách 1: Dùng script phát hành (khuyến nghị)

1. Chạy build phát hành:
   ```bash
   npm run release
   ```

2. Sao chép thư mục `release/docwen-assistant` vào:
   ```
   <Your Vault>/.obsidian/plugins/
   ```

3. Trong Obsidian:
   - Mở `Settings` → `Community plugins`
   - Nhấn `Reload plugins`
   - Bật `DocWen Assistant`

### Cách 2: Cài thủ công

1. Build plugin:
   ```bash
   npm run build
   ```

2. Tạo thư mục plugin:
   ```
   <Your Vault>/.obsidian/plugins/docwen-assistant/
   ```

3. Sao chép các tệp sau vào thư mục:
   - `main.js`
   - `manifest.json`

4. Tải lại và bật plugin trong Obsidian

---

## ⚙️ Cấu hình

1. Mở `Settings` → `Community plugins` → `DocWen Assistant` trong Obsidian

2. Cấu hình đường dẫn file thực thi:
   - **Tuỳ chọn 1**: Nhập trực tiếp đường dẫn
   - **Tuỳ chọn 2**: Nhấn nút `Browse...` để chọn tệp

3. Trạng thái xác thực:
   - ✓ Màu xanh nghĩa là đường dẫn hợp lệ
   - ✗ Màu đỏ nghĩa là đường dẫn không hợp lệ hoặc không tìm thấy tệp

---

## 📖 Cách dùng

### Khởi chạy DocWen

Có 3 cách để khởi chạy:

1. **Biểu tượng ở thanh bên**
   - Nhấn biểu tượng tài liệu ở thanh bên trái

2. **Command Palette**
   - Nhấn `Ctrl/Cmd + P` để mở command palette
   - Tìm \"DocWen\" và chọn \"Khởi chạy DocWen\"

3. **Khởi chạy với tệp hiện tại**
   - Tìm \"DocWen\" trong command palette và chọn \"Khởi chạy DocWen với tệp hiện tại\"
   - Chỉ khả dụng khi đang mở một tệp

### Tự động truyền đường dẫn tệp

- Nếu đang mở tệp Markdown, plugin sẽ tự động truyền đường dẫn đầy đủ sang DocWen
- Nếu không có tệp đang mở, plugin chỉ khởi chạy chương trình DocWen

### Quản lý một phiên chạy

- **Nhấn lần đầu** → Mở DocWen và truyền tệp hiện tại
- **Nhấn lại (có tệp)** → Thay thế bằng tệp mới (chế độ một tệp)
- **Nhấn lại (không có tệp)** → Kích hoạt cửa sổ DocWen

---

## 🛠️ Script phát triển

### Các lệnh có sẵn

| Lệnh | Mô tả |
|---------|-------------|
| `npm run dev` | Chế độ phát triển (watch) |
| `npm run build` | Build đầy đủ (type check + minify) |
| `npm run build:quick` | Build nhanh (không type check) |
| `node version-bump.js [patch\|minor\|major]` | Cập nhật số phiên bản |
| `npm run release` | Build gói phát hành |

### Quản lý phiên bản

Cập nhật số phiên bản:

```bash
# Patch (1.0.0 → 1.0.1)
node version-bump.js patch

# Minor (1.0.0 → 1.1.0)
node version-bump.js minor

# Major (1.0.0 → 2.0.0)
node version-bump.js major
```

---

## 📁 Cấu trúc dự án

```
docwen-obsidian/
├── src/                 # 📁 Thư mục mã nguồn
│   ├── main.ts          # Logic chính của plugin
│   ├── settings.ts      # Trang cài đặt
│   ├── i18n.ts          # Mô-đun đa ngôn ngữ
│   ├── utils/           # Tiện ích (tương lai)
│   ├── types/           # Định nghĩa kiểu (tương lai)
│   └── commands/        # Mô-đun lệnh (tương lai)
├── dist/                # 🔨 Thư mục đầu ra build
│   └── main.js          # Mã đã biên dịch
├── scripts/             # 📜 Script build
│   ├── build.bat        # Build một chạm cho Windows
│   ├── build.js         # Script build đa nền tảng
│   └── README.md        # Hướng dẫn dùng script
├── release/             # 📦 Sản phẩm phát hành
├── .vscode/             # 🛠️ Cấu hình editor
│   └── settings.json    # Cài đặt VS Code
├── manifest.json        # Manifest plugin
├── package.json         # Cấu hình dự án
├── tsconfig.json        # Cấu hình TypeScript
├── .eslintrc.json       # Cấu hình ESLint
├── .gitignore          # Git ignore
├── version-bump.js     # Script quản lý phiên bản
├── README.md           # Tài liệu này (tiếng Anh)
└── README_zh-CN.md     # Tài liệu tiếng Trung
```

---

## 🐛 Khắc phục sự cố

### Plugin không tải được

1. Kiểm tra `main.js` và `manifest.json` đã được sao chép đúng chưa
2. Nhấn `Reload plugins` trong Obsidian
3. Mở Developer Console (`Ctrl/Cmd + Shift + I`) để xem lỗi

### Không khởi chạy được DocWen

1. Kiểm tra đường dẫn file thực thi có đúng không
2. Xác nhận trạng thái đường dẫn hiển thị màu xanh ✓
3. Xác nhận file thực thi có quyền phù hợp

### Không truyền được đường dẫn tệp

1. Xác nhận đang mở một tệp
2. Kiểm tra đường dẫn có ký tự đặc biệt không
3. Kiểm tra log console về các tham số đã truyền

---

## 📜 Giấy phép

Dự án này được phát hành theo giấy phép MIT.

### Liên hệ

- **GitHub**: https://github.com/ZHYX91/docwen-obsidian
- **Dự án DocWen chính**: https://github.com/ZHYX91/docwen
- **Liên hệ tác giả**: zhengyx91@hotmail.com

---

**Tác giả**: ZhengYX
