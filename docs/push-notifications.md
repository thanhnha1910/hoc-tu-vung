# Cấu hình thông báo nhắc học

## 1. Tạo bảng subscription

Chạy migration `supabase/migrations/20260830000200_create_push_subscriptions.sql`
trên Supabase trước khi bật tính năng ở giao diện.

## 2. Tạo khóa VAPID

Chạy một lần:

```bash
npm run push:keys
```

Điền khóa vào môi trường deploy theo mẫu `.env.local.example`:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: public key, được phép gửi xuống trình duyệt.
- `VAPID_PRIVATE_KEY`: private key, chỉ lưu trên server.
- `VAPID_SUBJECT`: email quản trị dạng `mailto:admin@example.com`.
- `SUPABASE_SECRET_KEY`: secret key Supabase, chỉ dùng ở cron route.
- `CRON_SECRET`: chuỗi bí mật dài dùng để bảo vệ cron route.

Không tạo bộ VAPID mới sau khi đã có người đăng ký vì subscription cũ sẽ không
còn nhận được thông báo.

## 3. Gọi cron mỗi giờ

Scheduler gọi route sau một lần mỗi giờ:

```text
GET /api/push/send-due
Authorization: Bearer <CRON_SECRET>
```

Route tự đổi giờ theo timezone của từng thiết bị và chỉ gửi tối đa một lần mỗi
ngày vào giờ người dùng đã chọn.

Web Push trên môi trường production yêu cầu HTTPS. Trên iPhone/iPad, người dùng
cần thêm web app vào Màn hình chính rồi mở từ biểu tượng đó trước khi cấp quyền
thông báo.
