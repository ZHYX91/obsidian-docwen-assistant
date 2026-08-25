# DocWen Assistant

[English](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/README.md) · [简体中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-CN.md) · [繁體中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-TW.md) · [Deutsch](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.de-DE.md) · [Français](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.fr-FR.md) · [Русский](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ru-RU.md) · [Português](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.pt-BR.md) · [日本語](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ja-JP.md) · [Español](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.es-ES.md) · [한국어](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ko-KR.md) · [Tiếng Việt](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.vi-VN.md)

DocWen Assistant kết nối Obsidian với bản [DocWen](https://github.com/ZHYX91/docwen) cục bộ qua giao thức công khai `DocWenCLI.exe`. Yêu cầu Windows, Obsidian 1.12.7 trở lên và một bản DocWen 0.9.x ổn định.

> **Bắt buộc có DocWen.** Mã nguồn này nhắm đến DocWen 0.9.0 và DocWen Assistant 2.0.0; phiên bản mã nguồn không chứng minh rằng GitHub Release đã tồn tại. Chỉ cài đặt sau khi cả hai phiên bản chỉ gồm chữ số và các tệp quy định đã được phát hành trên [DocWen Releases](https://github.com/ZHYX91/docwen/releases) và trang phát hành Assistant.

## Tính năng

Plugin mở tệp trong DocWen, xuất Word/Excel/Markdown đến tệp đích đã chọn, thêm hoặc xóa số thứ tự tiêu đề Markdown, soát lỗi Markdown và chạy chẩn đoán doctor.

## Yêu cầu và khả năng tương thích

- Windows và Obsidian 1.12.7 trở lên; plugin chỉ dành cho máy tính để bàn.
- Gói Windows đầy đủ của một bản DocWen 0.9.x ổn định đã được giải nén hoàn toàn; plugin không tự động tải DocWen.
- DocWen Assistant 2.0 yêu cầu `docwen.machine.v1` và `docwen.artifact_bundle.v2`, không dự phòng sang lệnh argv hoặc phong bì JSON cũ.

Bạn có thể chọn thư mục DocWen đã giải nén đầy đủ, `DocWen.exe` hoặc `DocWenCLI.exe`. Plugin phân giải lựa chọn thành `DocWenCLI.exe` trong cùng thư mục và chỉ lưu, gọi đường dẫn CLI tuyệt đối đã xác thực đó. Plugin không chạy GUI như CLI, không tìm kiếm đệ quy và không tự động tải phần mềm.

## Cài đặt

Trước hết hãy xác nhận tại [DocWen Releases](https://github.com/ZHYX91/docwen/releases) và [DocWen Assistant Releases](https://github.com/ZHYX91/obsidian-docwen-assistant/releases) rằng các phiên bản số tương ứng đã được phát hành. Sau đó tải `DocWen-windows-x64.zip` và gói plugin tương ứng. Sao chép `main.js`, `manifest.json` và `styles.css` vào `<Vault>/.obsidian/plugins/docwen-assistant/`, bật plugin rồi chọn thư mục DocWen, `DocWen.exe` hoặc `DocWenCLI.exe`.

Gói phát hành chỉ chứa `main.js`, `manifest.json` và `styles.css`; gói này không bao giờ chứa, thay thế hoặc xóa `data.json`. Chỉ xóa `data.json` khi chủ động đặt lại toàn bộ tùy chọn.

## Cách sử dụng

Biểu tượng, menu con **DocWen** và bảng lệnh cho phép khởi chạy DocWen, xuất Word/Excel/Markdown, thay đổi số thứ tự tiêu đề, soát lỗi Markdown và chạy doctor. Xuất nền luôn yêu cầu chọn rõ tệp đầu ra.

## Cài đặt plugin

Obsidian 1.12.7 trở lên dùng năm thẻ trên cùng có thể cuộn ngang: Chung, Xuất sang Markdown, Xuất sang Word, Hiệu đính và Cách dùng. Các thẻ hỗ trợ phím mũi tên kể cả RTL, Home/End, chữ giao diện 20 px và vùng bấm lớn cho con trỏ thô. Ngôn ngữ mặc định theo Obsidian và có thể đổi sang một trong 11 ngôn ngữ được hỗ trợ.

## Giới hạn

- Chỉ hỗ trợ máy tính để bàn Windows có bản DocWen cục bộ tương thích.
- Không tìm kiếm đệ quy bên ngoài thư mục hoặc chương trình DocWen đã chọn.
- Thao tác bị từ chối nếu không thể xác minh an toàn phản hồi CLI, ảnh chụp nguồn, trạng thái trình soạn thảo hoặc đích.

## Quyền riêng tư và bảo mật

Plugin chỉ chuyển ảnh chụp cô lập của trình soạn thảo hiện tại hoặc tệp Vault cho tiến trình CLI cục bộ. Plugin không tải tài liệu lên hoặc liệt kê toàn bộ Vault. Chi tiết: [CLI integration contract](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/cli-integration.md)

## Phát triển

Sử dụng Node.js 24.19.0 và npm 11.17.0. Chạy `npm ci`, `npm run check` và `npm run release`. Mã nguồn nằm trong `src/`, kiểm thử trong `tests/`; các tệp tạo ra trong `dist/` và `release/` không phải mã nguồn.

Hợp đồng ổn định: [Yêu cầu sản phẩm](../product-requirements.en.md) · [Đặc tả UX](../ux-spec.en.md) · [Kiến trúc](../architecture.en.md) · [Chiến lược kiểm thử](../testing-strategy.en.md) · [Hợp đồng phát hành](../release.en.md)

Quản trị kho mã: [Nhật ký thay đổi](../../CHANGELOG.md) · [Hướng dẫn đóng góp](../../CONTRIBUTING.md) · [Bảo mật](../../SECURITY.md)

## Hỗ trợ

- Dùng [General](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/general) cho ý tưởng quy trình làm việc và phản hồi chung.
- Dùng [Q&A](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/q-a) cho câu hỏi về cách sử dụng và cấu hình.
- Gửi lỗi tích hợp Obsidian có thể tái hiện và đề xuất tính năng cụ thể qua [biểu mẫu issue của DocWen Assistant](https://github.com/ZHYX91/obsidian-docwen-assistant/issues/new/choose).
- Với chuyển đổi, OCR, soát lỗi hoặc hành vi CLI ngoài Obsidian, hãy dùng [DocWen Core Issues](https://github.com/ZHYX91/docwen/issues).
- Báo cáo lỗ hổng theo cách riêng tư theo [chính sách bảo mật](https://github.com/ZHYX91/obsidian-docwen-assistant/security/policy).

Trước khi đăng công khai, hãy xóa nội dung tài liệu riêng tư, đường dẫn tệp và Vault, nhật ký CLI, vị trí tệp thực thi và thông tin xác thực.

## Giấy phép

MIT © ZhengYX
