# DocWen Assistant

[English](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/README.md) · [简体中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-CN.md) · [繁體中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-TW.md) · [Deutsch](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.de-DE.md) · [Français](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.fr-FR.md) · [Русский](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ru-RU.md) · [Português](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.pt-BR.md) · [日本語](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ja-JP.md) · [Español](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.es-ES.md) · [한국어](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ko-KR.md) · [Tiếng Việt](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.vi-VN.md)

DocWen Assistant kết nối Obsidian với bản [DocWen](https://github.com/ZHYX91/docwen) cục bộ. Yêu cầu Windows, Obsidian 1.12.7 trở lên và một bản DocWen 0.9.x ổn định.

> **Bắt buộc có DocWen.** Cài bản tương thích từ [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97), hoặc giải nén hoàn toàn bản ZIP di động trong [DocWen Releases](https://github.com/ZHYX91/docwen/releases).

## Ảnh chụp màn hình

Các ảnh sau cho thấy plugin đã đóng gói cùng DocWen CLI chạy trong Obsidian trên máy tính.

### Thanh bên soát lỗi

Xem vấn đề theo dòng hoặc quy tắc và quay lại đúng vùng nguồn mà không ghi lại ghi chú.

![Thanh bên soát lỗi DocWen](../assets/docwen-assistant-proofread-en.png)

### Cài đặt bằng thẻ trên cùng và khả năng CLI

Dùng năm thẻ trên cùng để chọn đúng môi trường DocWen, điều chỉnh chuyển đổi và soát lỗi, rồi xác minh khả năng Machine.

![Cài đặt DocWen Assistant](../assets/docwen-assistant-settings-en.png)

### Xuất theo khả năng

Chọn một lộ trình chuyển đổi khả dụng và vị trí đầu ra rõ ràng trong khi giữ nguyên ghi chú nguồn.

![Xuất theo khả năng của DocWen Assistant](../assets/docwen-assistant-export-en.png)

## Tính năng

Plugin mở tệp trong DocWen, xuất Word/Excel/Markdown đến tệp đích đã chọn, thêm hoặc xóa số thứ tự tiêu đề Markdown, soát lỗi Markdown và chạy chẩn đoán doctor.

## Yêu cầu và khả năng tương thích

- Windows và Obsidian 1.12.7 trở lên; plugin chỉ dành cho máy tính để bàn.
- Gói Windows đầy đủ của một bản DocWen 0.9.x ổn định đã được giải nén hoàn toàn; plugin không tự động tải DocWen.
- Plugin yêu cầu `docwen.machine.v1` và `docwen.artifact_bundle.v2`; phiên bản DocWen không tương thích sẽ bị từ chối thay vì dùng giao thức khác.

Tự động phát hiện dùng bí danh `docwen.exe` đã đăng ký theo mặc định và vẫn hoạt động sau khi Microsoft Store cập nhật. Với ZIP di động, hãy chọn cài đặt thủ công và thư mục DocWen đã giải nén. Plugin không quét `WindowsApps` hay thư mục tùy ý và không tự động tải phần mềm.

## Cài đặt

### Cài DocWen và plugin

Cài DocWen từ [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97) hoặc giải nén ZIP di động từ [DocWen Releases](https://github.com/ZHYX91/docwen/releases). Cài DocWen Assistant từ Community Plugins; nếu cài thủ công, sao chép `main.js`, `manifest.json` và `styles.css` vào `<Vault>/.obsidian/plugins/docwen-assistant/`. Tự động phát hiện không cần chọn tệp; với bản di động, chọn cài đặt thủ công và thư mục DocWen trong phần cài đặt.

### An toàn khi cài đặt

Gói phát hành chỉ chứa `main.js`, `manifest.json` và `styles.css`; gói này không bao giờ chứa, thay thế hoặc xóa `data.json`. Chỉ xóa `data.json` khi chủ động đặt lại toàn bộ tùy chọn.

## Cách sử dụng

Biểu tượng, menu con **DocWen** và bảng lệnh cho phép khởi chạy DocWen, xuất Word/Excel/Markdown, thay đổi số thứ tự tiêu đề, soát lỗi Markdown và chạy doctor. Xuất nền luôn yêu cầu chọn rõ tệp đầu ra.

Khi xuất Markdown sang DOCX, một thư mục `<tài-liệu>.docwen` chứa dữ liệu khứ hồi đã xác thực cũng được tạo bên cạnh tài liệu. Hãy giữ thư mục này cùng với DOCX để khôi phục ảnh chụp Markdown đã xác thực khi tài liệu chưa thay đổi. Nếu thư mục bị thiếu hoặc không hợp lệ, DocWen sẽ dùng Markdown chuẩn hóa và thông báo việc hạ cấp.

Khi bật phiên bản [Number Suite](https://github.com/ZHYX91/obsidian-number-suite) tương thích, xuất Word sẽ giữ các số tiêu đề và chú thích ảo đã xác thực cùng tham chiếu trong cùng ghi chú mà không thêm các số đó vào Markdown.

## Cài đặt plugin

Obsidian 1.12.7 trở lên dùng năm thẻ trên cùng có thể cuộn ngang: Chung, Xuất sang Markdown, Xuất sang Word, Hiệu đính và Cách dùng. Các thẻ hỗ trợ phím mũi tên kể cả RTL, Home/End, chữ giao diện 20 px và vùng bấm lớn cho con trỏ thô. Ngôn ngữ mặc định theo Obsidian và có thể đổi sang một trong 11 ngôn ngữ được hỗ trợ.

## Giới hạn

- Chỉ hỗ trợ máy tính để bàn Windows có bản DocWen cục bộ tương thích.
- Không tìm kiếm đệ quy bên ngoài thư mục hoặc chương trình DocWen đã chọn.
- Thao tác bị từ chối nếu không thể xác minh an toàn phản hồi CLI, ảnh chụp nguồn, trạng thái trình soạn thảo hoặc đích.

## Quyền riêng tư và bảo mật

Plugin chỉ chuyển ảnh chụp cô lập của trình soạn thảo hiện tại hoặc tệp Vault cho DocWen. Quyền truy cập ngoài Vault chỉ dùng để chạy bí danh DocWen đã đăng ký hoặc ứng dụng di động được chọn thủ công, quản lý đầu vào tạm thời và tạo phẩm đã xác thực, rồi ghi vào đích đã chọn. Plugin không mở hay lưu đường dẫn gói Microsoft Store có phiên bản, không tải tài liệu lên và không liệt kê toàn bộ Vault. Chi tiết: [CLI integration contract](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/cli-integration.md)

## Phát triển

Sử dụng Node.js 24.19.0 và npm 11.17.0. Chạy `npm ci`, `npm run check` và `npm run release`. Mã nguồn nằm trong `src/`, kiểm thử trong `tests/`; các tệp tạo ra trong `dist/` và `release/` không phải mã nguồn.

Tài liệu ổn định: [Yêu cầu sản phẩm](../product-requirements.en.md) · [Đặc tả UX](../ux-spec.en.md) · [Kiến trúc](../architecture.en.md) · [Chiến lược kiểm thử](../testing-strategy.en.md) · [Quy trình phát hành](../release.en.md)

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
