# Supabase Database Setup for LoveChat 🌹

Để tính năng **Kho nhãn dán dùng chung** và các hiệu ứng Realtime hoạt động hoàn hảo, bạn hãy copy và chạy các lệnh SQL sau trong **SQL Editor** của trang quản trị Supabase nhé!

### 1. Tạo bảng lưu trữ Nhãn dán (Stickers)
Bảng này sẽ lưu trữ ảnh kỷ niệm dùng chung của hai bạn.

```sql
create table stickers (
  id uuid default uuid_generate_v4() primary key,
  name text,
  image_url text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Kích hoạt tính năng Realtime cho bảng nhãn dán
alter publication supabase_realtime add table stickers;
```

### 2. Kích hoạt Realtime cho tin nhắn (Nếu chưa)
Đảm bảo tin nhắn của hai bạn luôn đồng bộ tức thì.

```sql
alter publication supabase_realtime add table messages;
```

### 3. Thiết lập Storage cho Ảnh (Stickers)
Để có thể tải ảnh lên, bạn cần tạo một **Bucket** có tên là `stickers` trong mục **Storage** của Supabase:
1. Vào mục **Storage** -> **New Bucket**.
2. Đặt tên là `stickers`.
3. Gạt nút **Public** sang ON để hai bạn có thể xem ảnh của nhau.
4. Nhấn **Save**.

---
**Chúc hai bạn có những giây phút thật hạnh phúc bên nhau! 💖🥂**
