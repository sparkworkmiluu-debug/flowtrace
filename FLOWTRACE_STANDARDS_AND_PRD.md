# FlowTrace — Bộ Tiêu chuẩn Kỹ thuật & Yêu cầu Dự án (Project Standards & PRD)

Tài liệu này quy định các **tiêu chuẩn bắt buộc (Standard Rules)** và **yêu cầu kỹ thuật (Project Requirements)** nhằm đảm bảo dự án **FlowTrace** đạt chất lượng sản phẩm thương mại (production-grade), đủ sức thuyết phục hội đồng tuyển sinh **Georgia Tech MS QCF** và nhà tuyển dụng **Quant / FinTech**.

## 1. Mục tiêu Sản phẩm & Phạm vi (Product Scope)

| Lớp sản phẩm | Đối tượng mục tiêu | Chức năng cốt lõi | Thước đo thành công |
| :--- | :--- | :--- | :--- |
| **Lớp Public (B2C)** | Người dùng phổ thông, trader, sinh viên | Dán địa chỉ ví công khai hoặc chọn kịch bản mẫu để xem đồ thị dòng tiền & **Risk Score (0–100)** | Phản hồi dưới 3 giây; có sẵn 3 kịch bản bấm là chạy |
| **Lớp Doanh nghiệp (B2B)** | Ngân hàng, Fintech, Tuyển dụng Quant | So sánh **Rule-Based Baseline** vs. **FlowTrace Graph Model** và bộ tính **ROI tiết kiệm ($)** | Giảm **≥50% cảnh báo giả** tại ngưỡng **Recall ≥90%** |

## 2. Quy tắc Dữ liệu & Mô hình Toán học (Quant & Data Science Rules)

1. **Chống rò rỉ dữ liệu tuyệt đối (Zero Data Leakage)**:
   - Bắt buộc chia tập dữ liệu **IBM AML (LI-Small / LI-Medium)** theo đúng trục thời gian: **60% Train — 20% Validation — 20% Test**.
   - Nghiêm cấm chia ngẫu nhiên (random split) vì sẽ làm lộ cấu trúc đồ thị tương lai vào quá khứ.
2. **Xử lý dữ liệu ngoài bộ nhớ (Out-of-Core Processing)**:
   - Sử dụng **DuckDB** để truy vấn SQL, lọc nhiễu và tổng hợp đặc trưng theo cửa sổ thời gian (24h, 72h, 7 ngày) trước khi nạp vào **NetworkX**.
3. **Thước đo đánh giá chuẩn mực (Không dùng Accuracy)**:
   - Với tỷ lệ mất cân bằng cực đoan (~1 : 1,750), **không** báo cáo Accuracy.
   - Bắt buộc báo cáo **PR-AUC**, **False Positive Reduction Rate (%) tại Recall = 90%**, và **Số giờ phân tích viên tiết kiệm được trên mỗi 1 triệu giao dịch**.
4. **Bộ đặc trưng Đồ thị tối thiểu**:
   - **In/Out Degree & Net-Flow Ratio**, **Temporal Burstiness**, **Motif/Cycle counts** (*Cycle* 3–5 bước, *Fan-in / Fan-out / Gather-Scatter*), và **Weighted PageRank**.
5. **Tính giải thích được (XAI)**:
   - Mô hình Python tính toán toàn bộ rủi ro; **Google AI Studio (`google-genai`)** dịch SHAP values và thông số đồ thị con sang giải thích tiếng Anh tự nhiên (Structured Output JSON).

## 3. Quy tắc Kỹ thuật & Bảo mật (Solo Builder + FastAPI)

1. **Tái lập 100%**: Khóa `random_state` cố định; ghim phiên bản trong `requirements.txt` và `package.json`.
2. **An toàn API Public**: Áp dụng **Rate Limiting (`slowapi`)**, kiểm tra đầu vào (**`Pydantic`**), ẩn danh thông tin (**PII Masking**) trước khi log hoặc gọi Gemini API, và lưu toàn bộ API key trong `.env` (`.gitignore`).
3. **Quy tắc học & kiểm soát code**: Mọi file code do AI tạo ra đều phải được giải thích lại bằng tiếng Việt theo 3 câu: *(1) Nhận vào gì? (2) Biến đổi toán/dữ liệu ra sao? (3) Trả ra kết quả gì?*

## 4. Tiêu chuẩn Nghiệm thu (Definition of Done)

- [ ] Pipeline Python Benchmark chạy sạch, chứng minh giảm ≥50% cảnh báo giả ở Recall ≥ 90%.
- [ ] Có mục **Failure Analysis** phân tích trung thực các điểm mù của mô hình.
- [ ] Web App chạy Live công khai (<3s phản hồi, 3 kịch bản Zero-Friction Demo).
- [ ] Research Memo (3–4 trang PDF) và `README.md` hoàn chỉnh gắn trên thanh điều hướng.
