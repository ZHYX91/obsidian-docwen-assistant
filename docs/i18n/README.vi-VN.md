# DocWen Assistant

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md)

DocWen Assistant kết nối Obsidian với bản [DocWen](https://github.com/ZHYX91/docwen) cục bộ. Yêu cầu Windows hoặc Linux, Obsidian 1.12.7 trở lên và một bản DocWen từ 0.17.0 trở lên ổn định.

> **Bắt buộc có DocWen.** Cài bản tương thích từ [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97), hoặc giải nén hoàn toàn bản ZIP portable trong [DocWen Releases](https://github.com/ZHYX91/docwen/releases).

Ngôn ngữ giao diện chỉ thay đổi văn bản và bố cục của Assistant. Ngôn ngữ chuyển đổi, mẫu và OCR được điều khiển bằng tùy chọn tác vụ và cài đặt DocWen.

## Ảnh chụp màn hình

Ví dụ giao diện trên máy tính. Ví dụ soát lỗi dùng ghi chú thử nghiệm.

### Thanh bên soát lỗi

Xem vấn đề theo dòng hoặc quy tắc và quay lại đúng vùng nguồn mà không ghi lại ghi chú.

![Thanh bên soát lỗi DocWen](../assets/docwen-assistant-proofread-en.png)

### Cài đặt và kết nối DocWen

Kiểm tra kết nối DocWen và chọn tùy chọn chuyển đổi, soát lỗi trong bốn thẻ cài đặt.

![Cài đặt DocWen Assistant](../assets/docwen-assistant-settings-en.png)

### Xuất tệp

Chọn định dạng đầu ra, kiểm tra tùy chọn và chọn nơi lưu kết quả.

![Xuất theo khả năng của DocWen Assistant](../assets/docwen-assistant-export-en.png)

## Tính năng

Plugin mở tệp trong DocWen, xuất Word/Excel/Markdown vào thư mục đích đã chọn, thêm hoặc xóa số thứ tự tiêu đề Markdown, soát lỗi Markdown và chạy lệnh **Kiểm tra kết nối DocWen**.

## Yêu cầu và khả năng tương thích

- Windows hoặc Linux và Obsidian 1.12.7 trở lên; plugin chỉ dành cho máy tính để bàn.
- Trên Windows, dùng DocWen 0.17.0 trở lên tương thích từ Store hoặc gói portable đã giải nén hoàn toàn; trên Linux, dùng gói đã giải nén hoàn toàn và chọn thủ công. Xuất trên Linux yêu cầu x64 và hệ thống tệp có thể lưu kết quả mới mà không ghi đè dữ liệu hiện có; plugin không tự động tải DocWen.
- Plugin yêu cầu `docwen.machine.v2` và `docwen.artifact_bundle.v3`; phiên bản DocWen không tương thích sẽ bị từ chối thay vì dùng giao thức khác.
- Ngay cả khi kết nối chuyển đổi nền không tương thích, bạn vẫn có thể thử mở riêng ứng dụng DocWen.

Nếu bản cài đặt từ Store không đáp ứng các yêu cầu này, hãy dùng gói portable tương thích và chọn gói đó trong chế độ cài đặt thủ công.

Tự động phát hiện chỉ có trên Windows và dùng bí danh `docwen.exe` đã đăng ký. Trên Linux bắt buộc dùng cài đặt thủ công; có thể chọn thư mục đã giải nén, `DocWen` hoặc `DocWenCLI`. Plugin không tìm chương trình trong các thư mục tùy ý và không tự động tải phần mềm.

## Cài đặt

### Cài DocWen và plugin

1. Trên Windows, cài DocWen 0.17.0 trở lên tương thích từ [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97), hoặc giải nén gói Windows từ [DocWen Releases](https://github.com/ZHYX91/docwen/releases). Trên Linux x64, giải nén hoàn toàn gói Linux từ cùng trang.
2. Cài DocWen Assistant từ Community Plugins. Nếu cài thủ công, tải `docwen-assistant-x.y.z.zip` từ [trang phát hành plugin](https://github.com/ZHYX91/obsidian-docwen-assistant/releases) rồi sao chép `main.js`, `manifest.json` và `styles.css` vào `<Vault>/.obsidian/plugins/docwen-assistant/`.
3. Tải lại Community Plugins rồi bật DocWen Assistant.
4. Bản Windows từ Store có thể được nhận diện tự động. Với Windows portable hoặc Linux, mở **Cài đặt → DocWen Assistant → Chung**, chọn kết nối thủ công rồi chọn thư mục đã giải nén hoặc tệp thực thi.

### Giữ thiết lập khi cập nhật

Khi cập nhật thủ công, chỉ thay `main.js`, `manifest.json` và `styles.css`. Giữ `data.json` để giữ thiết lập; chỉ xóa khi muốn đặt lại. Giữ tên thư mục là `docwen-assistant`.

## Cách sử dụng

**Lệnh khả dụng phụ thuộc vào tệp đang mở.** Chức năng chuyển đổi chỉ xuất hiện nếu DocWen được kết nối hỗ trợ thao tác đó cho nội dung tệp. Xuất tạo thư mục kết quả riêng; soát lỗi không sửa ghi chú. **Thêm hoặc xóa số thứ tự tiêu đề sẽ sửa Markdown.** Trước khi ghi, plugin kiểm tra nội dung trình soạn thảo (kể cả thay đổi chưa lưu) hoặc tệp đã lưu; nếu có nhiều trình soạn thảo cùng đường dẫn mà không xác định được nguồn, thao tác dừng lại.

Biểu tượng, menu con **DocWen** và bảng lệnh cho phép khởi chạy DocWen, xuất Word/Excel/Markdown, thay đổi số thứ tự tiêu đề, soát lỗi Markdown và chạy lệnh **Kiểm tra kết nối DocWen**.

Chọn mẫu hoặc thiết lập chuyển đổi nếu được cung cấp, rồi chọn thư mục đầu ra. Kiểm tra tệp nguồn, định dạng, nơi lưu và các tùy chọn trước khi bấm **Xuất**. Cửa sổ dùng thiết lập đã lấy cho tác vụ này; hủy sẽ không bắt đầu chuyển đổi. Mỗi lần chuyển đổi tạo thư mục mới chứa kết quả và ảnh liên kết. Sau khi hoàn tất, chọn **Mở thư mục kết quả** trong thông báo. Thư mục kết quả có sẵn không bị ghi đè.

## Cài đặt plugin

Trước khi xuất Word, bật **phần mở rộng đầu vào** cần thiết tại **DocWen → Cài đặt → Cú pháp Markdown**. Chúng mặc định tắt khi cài mới; cấu hình đầu vào Obsidian bật nhóm phần mở rộng liên quan.

| Nội dung hoặc tác vụ | Thiết lập DocWen |
| --- | --- |
| Ô gộp Structural Tables | Phần mở rộng đầu vào Structural Tables |
| Chú thích và tham chiếu Number Suite | Phần mở rộng đầu vào chú thích và tham chiếu |
| Tiêu đề H7–H9 / chú thích cuối có kiểu | Phần mở rộng đầu vào tương ứng |
| Word về Markdown mở rộng | Phần mở rộng đầu ra tương ứng |

Xuất Word đọc cú pháp Number Suite ngay cả khi không cài plugin này. Số trong kết quả theo tùy chọn DocWen, không theo số chỉ hiển thị của Number Suite. Lệnh thêm hoặc xóa số thứ tự tiêu đề riêng sẽ sửa ghi chú nguồn; xuất tệp thì không.

Cài đặt được chia thành bốn thẻ: Chung, Xuất sang Markdown, Xuất sang Word và Hiệu đính. Mỗi thẻ có hướng dẫn cho các tùy chọn liên quan. Ngôn ngữ mặc định theo Obsidian và có thể đổi trong phần Chung. Bạn có thể dùng phím mũi tên hoặc Home/End để chuyển thẻ.

## Giới hạn

- Hỗ trợ máy tính để bàn Windows hoặc Linux có bản DocWen cục bộ tương thích; xuất trên Linux yêu cầu x64 và hệ thống tệp có thể lưu kết quả mà không ghi đè dữ liệu hiện có.
- Không tìm kiếm đệ quy bên ngoài thư mục hoặc chương trình DocWen đã chọn.
- Nếu ghi chú thay đổi trong khi xử lý hoặc không thể lưu kết quả an toàn, thao tác sẽ dừng và yêu cầu bạn kiểm tra.

Chuyển sang Word rồi chuyển lại không thay thế bản sao lưu Markdown gốc. Nội dung hiển thị được hỗ trợ có thể chuyển lại, nhưng cú pháp chưa hỗ trợ, ghi chú nhúng và một số chi tiết bố cục có thể không được giữ. Hãy giữ ghi chú gốc và kiểm tra tài liệu sau khi chuyển lại.

## Quyền riêng tư và bảo mật

Tài liệu ở lại trên máy tính của bạn. Plugin gửi bản sao tạm của tệp đã chọn cho DocWen cục bộ, gồm cả nội dung chưa lưu nếu chỉ có một trình soạn thảo tương ứng. Chỉ ảnh được ghi chú tham chiếu rõ ràng mới được đưa vào; plugin không tìm tệp không liên quan trong toàn bộ Vault hay tải tài liệu lên mạng.

Xuất ghi kết quả vào thư mục bạn chọn; soát lỗi không sửa ghi chú. Số thứ tự tiêu đề chỉ được ghi khi ghi chú gốc vẫn ở cùng đường dẫn và nội dung chưa thay đổi. Nếu đổi tên hoặc thay tệp trong lúc xử lý, hãy chạy lại trên ghi chú hiện tại. Đường dẫn cài đặt Store không được lưu trong thiết lập plugin. Xem [đặc tả tích hợp](../cli-integration.md) để biết chi tiết kỹ thuật.

## Phát triển

Sử dụng Node.js 24.19.0 và npm 11.17.0. Chạy `npm ci`, `npm run check` và `npm run release`. Mã nguồn nằm trong `src/`, kiểm thử trong `tests/`; các tệp tạo ra trong `dist/` và `release/` không phải mã nguồn.

Tài liệu ổn định: [Yêu cầu sản phẩm](../product-requirements.en.md) · [Đặc tả UX](../ux-spec.en.md) · [Kiến trúc](../architecture.en.md) · [Chiến lược kiểm thử](../testing-strategy.en.md)

Quản trị kho mã: [Nhật ký thay đổi](../../CHANGELOG.md) · [Hướng dẫn đóng góp](../../CONTRIBUTING.md) · [Bảo mật](../../SECURITY.md)

## Hỗ trợ

Trong Obsidian, mở **Chung → Trợ giúp**, rồi chọn **Hướng dẫn sử dụng** hoặc **Báo cáo sự cố**.

- [Q&A](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/q-a): Câu hỏi về cách sử dụng và cấu hình.
- [Ideas](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/ideas): Ý tưởng ban đầu về tính năng và quy trình làm việc.
- [Show and tell](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/show-and-tell): Mẹo, quy trình làm việc và bản triển khai tham khảo.
- Gửi lỗi tích hợp Obsidian có thể tái hiện và đề xuất tính năng cụ thể qua [biểu mẫu issue của DocWen Assistant](https://github.com/ZHYX91/obsidian-docwen-assistant/issues/new/choose).
- Với chuyển đổi, OCR, soát lỗi hoặc hành vi CLI ngoài Obsidian, hãy dùng [DocWen Core Issues](https://github.com/ZHYX91/docwen/issues).
- Báo cáo lỗ hổng theo cách riêng tư theo [chính sách bảo mật](https://github.com/ZHYX91/obsidian-docwen-assistant/security/policy).

Trước khi đăng công khai, hãy xóa nội dung tài liệu riêng tư, đường dẫn tệp và Vault, nhật ký CLI, vị trí tệp thực thi và thông tin xác thực.

## Giấy phép

MIT © ZhengYX
