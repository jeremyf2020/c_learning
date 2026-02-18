# CM3035 進階網頁開發 — 期末專題報告

# eLearning 網頁應用程式

---

## 1. 引言

本報告描述了為 CM3035 進階網頁開發模組所開發的 eLearning 網頁應用程式的設計、實作與評估。該應用程式允許學生和教師透過課程管理、具備共享白板的即時聊天、AI 驅動的作業生成，以及整合電子郵件發送的通知系統進行互動。本專案採用解耦架構，後端為透過 Daphne（ASGI）提供服務的 Django 4.2 REST 後端，前端為使用 TypeScript 和 Vite 建構的 React 18 單頁應用程式（SPA）。即時功能由 Django Channels 4 搭配 Redis 通道層驅動，整個技術堆疊使用 Docker Compose 進行容器化，以實現可重現的部署。

本報告的其餘部分直接按照評估標準組織。第 2 節介紹應用程式架構。第 3 節涵蓋資料庫設計與正規化。第 4 節詳述後端實作，展示課堂中教授的 Django 功能（主題 1-10）。第 5 節描述 REST API。第 6 節涵蓋非同步 WebSocket 通訊。第 7 節描述前端設計。第 8 節說明身份驗證與安全性。第 9 節介紹測試策略。第 10 節將每個功能需求和技術需求對應到具體的程式碼。第 11 節涵蓋容器化。第 12 節提供與業界最新技術相關的批判性評估。第 13 節提供安裝、執行和測試應用程式所需的所有資訊。第 14 節描述超越課程大綱所使用的進階技術。

---

## 2. 應用程式架構

該應用程式遵循三層解耦的客戶端-伺服器架構：

1. **展示層** — React 18 SPA（TypeScript、Vite、Bootstrap 5），於埠 5173 提供服務。
2. **應用層** — Django 4.2 後端，透過 Django REST Framework 3.14 暴露 REST API，並透過 Django Channels 4 提供 WebSocket 端點，由 Daphne 於埠 8080 提供服務。
3. **資料層** — SQLite 資料庫（可透過環境變數配置為 PostgreSQL）以及用作 Channels 通道層的 Redis 7 實例。

Docker Compose 協調所有三個服務（backend、frontend、redis）。前端完全透過 HTTP REST 呼叫（透過 Axios）和 WebSocket 連線與後端通訊；使用者面向的頁面不使用伺服器端模板渲染。這種關注點分離使前端可以獨立於後端進行開發、測試和部署，並允許未來在不影響另一層的情況下替換任一層。

選擇 React 搭配 TypeScript 是經過深思熟慮的：TypeScript 提供編譯時的型別安全性，可在錯誤到達瀏覽器之前捕捉許多類別的 bug（例如傳遞錯誤的 prop 類型），而 React 的元件模型使構成應用程式的十四個頁面級元件之間能夠重用程式碼。選擇 Vite 而非 Create React App 是因為其在開發過程中顯著更快的熱模組替換（HMR）。

---

## 3. 資料庫設計與正規化

### 3.1 實體關聯概覽

資料模型由分布在四個 app 中的十二個 Django 模型組成：

| App | Models |
|-----|--------|
| accounts | User, StatusUpdate, Invitation |
| courses | Course, CourseMaterial, Enrollment, Feedback, Assignment, AssignmentSubmission |
| classroom | Classroom, ClassroomMessage |
| notifications | Notification |

主要關聯：

- **User → Course**（一對多，透過 `teacher` ForeignKey 搭配 `limit_choices_to={'user_type': 'teacher'}`）。
- **User ↔ Course**（多對多，透過 `Enrollment` 關聯表，附帶額外的元資料：`enrolled_at`、`is_active`、`completed`、`completion_date`）。
- **User → StatusUpdate**（一對多，級聯刪除）。
- **Course → CourseMaterial**（一對多）和 **Course → Feedback**（一對多）。
- **Course → Assignment**（一對多）和 **Assignment → AssignmentSubmission**（一對多）。
- **Classroom ↔ User**（多對多，透過 Django 內建的 `participants` M2M 欄位中介表）。
- **Classroom → ClassroomMessage**（一對多）。
- **User → Notification**（一對多，透過 `recipient` ForeignKey）。
- **User → Invitation**（一對多，透過 `invited_by` ForeignKey，加上 OneToOneField `created_user` 連結到最終從邀請建立的帳號）。

### 3.2 正規化至第三正規化形式

**第一正規化形式（1NF）：** 每個欄位儲存原子值。沒有重複群組或多值欄位。唯一儲存結構化資料的欄位是 `Classroom.whiteboard_data`（JSON 編碼的繪圖操作列表）和 `Assignment.content`（JSON 編碼的測驗題或閃卡）。這些是刻意為之的：資料總是作為一個完整單位載入和儲存，從不在子元素層級查詢，因此 JSON 文字欄位比建立一個包含數千列的獨立表格更為適當。

**第二正規化形式（2NF）：** 2NF 要求每個非鍵屬性都完全依賴於*整個*主鍵。在 Django 中，每個模型都有一個單欄的代理主鍵（`id`），因此在物理層級不存在複合鍵。然而，兩個模型具有透過 `unique_together` 強制的邏輯複合鍵：

- `Enrollment(student, course)` — 額外屬性（`enrolled_at`、`is_active`、`completed`）依賴於學生和課程的完整組合，而非單獨任一者。
- `Feedback(course, student)` — `rating` 和 `comment` 描述特定學生對特定課程的評估。

兩者都滿足 2NF，因為沒有非鍵屬性僅依賴於複合候選鍵的一部分。

**第三正規化形式（3NF）：** 3NF 要求沒有非鍵屬性透過傳遞依賴於主鍵。考慮 `Course` 模型：`teacher` 是指向 `User` 的 ForeignKey。教師的姓名不會冗餘地儲存在 Course 表中；它透過關聯來存取。同樣地，`Enrollment` 不會重複課程標題或學生姓名；這些透過 ForeignKey 連結解析。序列化器透過 `SerializerMethodField` 暴露反正規化欄位如 `teacher_name` 和 `student_name`，但這些是在序列化時計算的，並不儲存在資料庫中。這種方法在保持資料庫結構描述為 3NF 的同時，為 API 消費者提供方便的扁平 JSON 表示。

唯一刻意的反正規化是 `whiteboard_data` 和 `Assignment.content` JSON 欄位，理由如上所述。所有其他表格都符合 3NF。

### 3.3 參照完整性與約束

Django 的 ORM 透過外鍵約束強制參照完整性。專案對大多數關聯使用 `CASCADE`（例如刪除 User 會級聯刪除其 StatusUpdate、Enrollment、Feedback），而在父記錄應在相關記錄被移除後仍然保留的情況下使用 `SET_NULL`（例如 `Invitation.invited_by`）。欄位級別的驗證透過 Django 驗證器強制：

- `User.photo`（jpg、jpeg、png）和 `CourseMaterial.file`（pdf、doc、docx、ppt、pptx、jpg、jpeg、png、gif、mp4、avi）上的 `FileExtensionValidator`。
- `Feedback.rating` 上的 `MinValueValidator(1)` 和 `MaxValueValidator(5)`。
- `Course.code` 和 `Invitation.token` 上的 `unique=True`，搭配 `db_index=True` 以加速查找。

---

## 4. 後端實作（Django 功能 — 主題 1-10）

本節展示應用程式如何使用 CM3035 大綱中所有十個主題所描述的 Django 功能。

### 4.1 主題 1：網頁技術堆疊

應用程式使用 Django 4.2 建構為全端 MVC（Model-View-Controller）架構。後端組織為四個 Django app，每個負責一個不同的領域：

- **accounts** — 使用者管理、身份驗證、邀請、動態更新。
- **courses** — 課程 CRUD、教材上傳、選課、回饋、AI 生成的作業。
- **classroom** — 即時聊天室、白板、透過 WebSocket 的音訊串流。
- **notifications** — 通知建立、檢索和電子郵件發送。

這種模組化結構遵循 Django 最佳實踐：模型位於 `models.py`，業務邏輯位於 `views.py` 和 `api.py`，表單驗證位於 `forms.py`，序列化位於 `serializers.py`。URL 路由在每個 app 的 `urls.py` 中定義，並在專案級別透過 `include()` 匯總。應用程式在 `settings.py` 中配置，包含 `INSTALLED_APPS`、`MIDDLEWARE`、`DATABASES`、`TEMPLATES`，以及 CORS、電子郵件和 Channels 的自訂設定。

### 4.2 主題 2：資料庫結構描述與 ORM

應用程式在四個 app 中定義了 12 個模型，使用 Django 的 ORM 將 Python 類別對映到 SQL 表格：

- **自訂 User 模型** — 擴展 `AbstractUser`，新增額外欄位（`user_type`、`photo`、`bio`、`phone_number`、`date_of_birth`、`ai_api_key`），透過 `AUTH_USER_MODEL = 'accounts.User'` 設定，遵循 Django 文件的建議。`user_type` 欄位使用帶有 `'student'` 和 `'teacher'` 選項的 `choices` 參數，便利方法 `is_student()` 和 `is_teacher()` 封裝了檢查邏輯。
- **ForeignKey 關聯** — `Course.teacher → User`、`Enrollment.student → User`、`Enrollment.course → Course`、`ClassroomMessage.sender → User`、`Notification.recipient → User`、`Assignment.course → Course`、`AssignmentSubmission.assignment → Assignment`。
- **ManyToManyField** — `Classroom.participants` 建立使用者和聊天室之間的多對多關聯。
- **OneToOneField** — `Invitation.created_user → User` 將邀請連結到從中建立的帳號。
- **模型方法** — `Course.get_enrolled_students_count()`、`Course.get_average_rating()`、`Invitation.is_expired`、`Invitation.is_valid`。
- **Meta 選項** — 多個模型上的 `ordering`、`unique_together`、`verbose_name_plural`。
- **驗證器** — `FileExtensionValidator`、`MinValueValidator`、`MaxValueValidator`。
- **自動產生欄位** — 用於時間戳的 `auto_now_add`、用於邀請 token 的 `default=uuid.uuid4`。

所有模型都透過 `makemigrations` 產生遷移並透過 `migrate` 套用。ORM 將函式呼叫透明地對映到 SQL 查詢——例如，`Enrollment.objects.filter(course=course, is_active=True).select_related('student')` 產生一條 SQL JOIN 查詢。資料庫結構描述已正規化至第三正規化形式，詳見第 3 節。

### 4.3 主題 3：透過提供 HTML、CSS 和 JavaScript 進行互動

專案提供 Django 模板用於伺服器端渲染，使用 Django 的模板語言搭配表單和驗證器進行使用者輸入：

**模板**繼承 `base.html` 版面，並按 app 組織：
- `courses/templates/courses/` — `course_list.html`、`course_detail.html`、`course_form.html`、`course_confirm_delete.html`、`upload_material.html`、`unenroll_confirm.html`、`submit_feedback.html`、`block_student.html`。
- `accounts/templates/accounts/` — `login.html`、`register.html`。

模板使用 Django 模板標籤（`{% extends %}`、`{% block %}`、`{% for %}`、`{% if %}`、`{% url %}`）和模板過濾器。

**表單和驗證器** — 七個表單類別定義在兩個 app 中：
- **accounts/forms.py** — `UserRegistrationForm`（擴展 `UserCreationForm`，新增 `email`、`full_name`、`user_type`）、`UserProfileUpdateForm`、`StatusUpdateForm`、`UserSearchForm`。
- **courses/forms.py** — `CourseForm`（使用 `DateInput` 小工具處理日期）、`CourseMaterialForm`、`FeedbackForm`（使用 `RadioSelect` 小工具提供 1-5 星評分）。

表單透過自訂小工具配置提供伺服器端驗證：
```python
widgets = {
    'start_date': forms.DateInput(attrs={'type': 'date'}),
    'end_date': forms.DateInput(attrs={'type': 'date'}),
}
```

`courses/views.py` 中的函式視圖處理伺服器端渲染的頁面：
- `course_list`、`course_detail`、`course_create`、`course_update`、`course_delete` — 完整 CRUD，搭配 `@login_required` 裝飾器。
- `enroll_course`、`unenroll_course` — 選課管理，含角色檢查。
- `upload_material` — 檔案上傳處理，使用 `request.FILES`。
- `submit_feedback`、`block_student` — 額外的課程操作。

### 4.4 主題 4：建構 CRUD 和 RESTful API（第一部分）

API 層完全使用 Django REST Framework（DRF）3.14 建構，實作 RESTful CRUD 操作：

- **ModelViewSet** 用於完整 CRUD 操作（CourseViewSet、CourseMaterialViewSet、FeedbackViewSet、AssignmentViewSet、AssignmentSubmissionViewSet、StatusUpdateViewSet、ClassroomViewSet）。
- **ReadOnlyModelViewSet** 用於唯讀資源（UserViewSet、EnrollmentViewSet、NotificationViewSet）。
- **DefaultRouter** 用於從 ViewSet 自動產生 URL，將 HTTP 方法對映到 CRUD 操作（GET→Read、POST→Create、PUT/PATCH→Update、DELETE→Destroy）。
- **17 個序列化器**分布在所有 app 中，同時處理輸入驗證和輸出表示：
  - `SerializerMethodField` 用於計算的唯讀欄位（`teacher_name`、`enrolled_count`、`average_rating`、`participant_names`、`last_message`、`course_title`、`student_name`）。
  - `InvitationSerializer` 上的自訂 `validate_email` 檢查現有使用者和待處理邀請。
  - `AcceptInvitationSerializer` 驗證使用者名稱唯一性、透過 Django 的 `validate_password` 驗證密碼強度，以及密碼確認匹配。
- **自訂操作**透過 `@action` 裝飾器實現超越標準 CRUD 的操作：`enroll`、`unenroll`、`block_student`、`add_student`、`students`、`materials`、`search`、`mark_read`、`mark_all_read`、`bulk_upload`、`download_template`、`generate`、`join`、`messages`、`send`。
- **自訂權限類別** — `IsTeacher` 檢查 `request.user.is_teacher() or request.user.is_staff`。
- **物件級別權限** — CourseViewSet、CourseMaterialViewSet、FeedbackViewSet 和 AssignmentViewSet 上的 `perform_update` 和 `perform_destroy` 在允許修改前驗證擁有權。
- **解析器類別** — `MultiPartParser` 和 `JSONParser` 用於檔案上傳端點。
- **查詢集最佳化** — `select_related('teacher')`、`select_related('student')`、`select_related('sender')` 以防止 N+1 查詢問題。

**單元測試**（也在主題 4 中引入）— 專案包含 132 個測試方法，使用 Django 的 `TestCase` 和 DRF 的 `APITestCase`，涵蓋模型行為、API 端點、權限和邊界情況。詳見第 9 節。

### 4.5 主題 5：建構 CRUD 和 RESTful API（第二部分）— AJAX 和 SPA

前端建構為單頁應用程式（SPA），使用 React 18 搭配 TypeScript，完全透過 AJAX 呼叫（Axios）消費 REST API。使用者面向的頁面不使用伺服器端模板渲染——React SPA 完全透過 HTTP REST 呼叫和 WebSocket 連線與後端通訊。

已實作的關鍵 SPA 模式：

- **Axios 客戶端**，配置基礎 URL 和請求攔截器，自動將身份驗證 token 附加到每個請求。
- **React Router DOM 6** 透過 `BrowserRouter` 實現客戶端路由——頁面轉換無需完整頁面重新載入。
- **樂觀 UI 更新** — 在變更操作（POST/PATCH/DELETE）後，前端狀態立即更新而無需等待頁面重新整理。例如，提交回饋後，新的回饋會立即附加到本地狀態陣列中。
- **AJAX 資料擷取**透過 `useEffect` hook 在元件掛載時呼叫 REST API。
- **JavaScript API 消費** — 每個頁面元件使用 Axios 與伺服器端 API 互動進行 CRUD 操作（例如 `client.get('/courses/')`、`client.post('/courses/${id}/enroll/')`、`client.patch('/users/update_profile/', formData)`）。

### 4.6 主題 6：非同步網頁服務 — Django Channels 和 WebSocket

應用程式使用 Django Channels 4 在標準 HTTP 之外處理 WebSocket 連線，以 Redis 作為通道層。這在第 6 節中有詳細介紹。主要實作：

- **ASGI 配置**（`asgi.py`）— `ProtocolTypeRouter` 將 HTTP 路由到 Django 的 ASGI 處理器，將 WebSocket 路由到 Channels URL 路由器，外層包裝自訂的 `TokenAuthMiddleware`。
- **Daphne ASGI 伺服器** — 取代 Django 內建的 `runserver`，同時處理 HTTP 和 WebSocket 連線。
- **`AsyncWebsocketConsumer`**（`ClassroomConsumer`）— 透過 `receive()` 中的分發模式處理聊天訊息、白板繪圖和音訊串流。
- **`@database_sync_to_async`** — 橋接非同步 WebSocket 層與 Django 的同步 ORM 進行資料庫操作。
- **Redis 通道層**（`channels_redis.core.RedisChannelLayer`）— 透過 `group_send` 和 `group_add` 將訊息廣播給聊天室中的所有參與者。
- **WebSocket 路由** — `URLRouter` 搭配 `path('ws/classroom/<str:room_name>/', ClassroomConsumer.as_asgi())`。

注意：雖然課程教材涵蓋了 Celery，但專案使用 Django 的 `send_mail` 進行同步電子郵件發送，而非使用 Celery 進行背景任務，因為教室規模的工作量不需要非同步任務處理。這在第 12.3 節中作為未來改進方向討論。

### 4.7 主題 7：使用外部 API

應用程式整合 **OpenAI API** 進行 AI 驅動的測驗和閃卡生成：

- **API 消費** — `AssignmentViewSet` 上的 `generate` 操作使用 Python 的 `urllib.request` 模組呼叫 `https://api.openai.com/v1/chat/completions`，發送結構化提示詞並解析 JSON 回應。
- **PDF 文字擷取** — 使用 `pypdf` 函式庫從上傳的 PDF 教材中擷取文字，然後作為上下文發送到 OpenAI API。
- **每位使用者的 API 金鑰** — 教師將自己的 OpenAI API 金鑰儲存在使用者個人資料中（`User.ai_api_key`），用於驗證 API 呼叫。這避免了在伺服器上儲存共享金鑰。
- **結構化 JSON 回應** — 提示詞指示 AI 以特定 JSON 格式回傳回應（含選項和正確答案的測驗題，或含正面/背面配對的閃卡），這些被解析並儲存在 Django 的 `JSONField` 中。

邀請系統也展示了使用**電子郵件作為外部服務** — Django 的 `send_mail` 函式連接到 Gmail 的 SMTP 伺服器（`smtp.gmail.com:587`），使用 TLS 加密和 Google 應用程式密碼驗證。

### 4.8 主題 8：使用者身份驗證與安全性

身份驗證使用多種 Django 機制：

- **DRF Token 身份驗證** — 在登入/註冊時產生 token，透過 `Authorization: Token <key>` 標頭發送。SPA 使用基於 token 的驗證而非基於 session 的驗證。
- **Django 內建身份驗證** — 伺服器端視圖中的 `authenticate()` 和 `login()`。
- **`@login_required` 裝飾器** — 用於所有函式視圖。
- **自訂中介軟體** — `classroom/middleware.py` 中的 `TokenAuthMiddleware` 用於 WebSocket 身份驗證（從查詢字串擷取 token，將使用者附加到 scope）。
- **封鎖使用者檢查** — `is_blocked=True` 的使用者被拒絕登入。
- **自訂權限類別** — `IsTeacher` 限制邀請管理僅限教師帳號。

針對常見網頁應用程式漏洞的安全措施：

- **CORS** 透過 `django-cors-headers` 限制為前端來源，防止來自未授權網域的跨域請求偽造。
- **CSRF 保護**已啟用（依 DRF 慣例，token 身份驗證的 API 請求可豁免）。
- **密碼雜湊**透過 Django 預設的 PBKDF2 雜湊器——密碼絕不以明文儲存。
- **密碼驗證**使用 Django 內建的驗證器（MinimumLengthValidator、CommonPasswordValidator 等）。
- **輸入驗證**在序列化器和模型兩個層級進行，防止注入攻擊。
- **檔案上傳驗證**使用 `FileExtensionValidator` 限制上傳的檔案類型。
- **物件級別權限執行** — 每個 CRUD 端點在允許更新或刪除操作前驗證擁有權（見第 5.1 節）。
- **WebSocket 存取控制** — 如果使用者不是聊天室的已認證參與者，連線會被拒絕。
- **訊息長度限制** — 聊天訊息限制為 5000 字元以防止濫用。

### 4.9 主題 9：部署網站

應用程式使用 Docker Compose 進行容器化部署，包含三個服務：

- **backend** — Python 3.11-slim，執行 `daphne -b 0.0.0.0 -p 8080 elearning_project.asgi:application`。Daphne 是正式環境等級的 ASGI 伺服器（不同於 Django 內建的 `runserver`）。
- **frontend** — Node 20-alpine，執行 `npm run dev -- --host`。在正式環境中，Vite 的 `build` 命令會產生由 Nginx 提供服務的靜態資源。
- **redis** — Redis 7-alpine，用作 Channels 通道層。

已實作的正式環境配置考量：
- **環境變數**從 `.env` 檔案載入（`DEBUG`、`ALLOWED_HOSTS`、`SECRET_KEY`、`EMAIL_HOST_PASSWORD`），將機密資訊排除在原始碼之外。
- **`.dockerignore` 檔案**用於 backend 和 frontend，排除 `__pycache__`、`db.sqlite3`、`.env`、`node_modules` 和 `media/` 以縮小建置上下文並防止機密洩漏。
- **Volume 掛載**用於即時開發；媒體檔案儲存在具名的 Docker volume 中。
- **資料庫可配置性** — `DB_ENGINE` 和 `DB_NAME` 環境變數允許在不修改程式碼的情況下從 SQLite 切換到 PostgreSQL。

### 4.10 主題 10：負載平衡與可擴展性

雖然應用程式目前作為單實例部署運行，但數個設計決策支援未來的可擴展性：

- **無狀態 API** — 基於 token 的身份驗證（非基於 session）意味著任何後端實例都可以處理任何請求，使得在負載平衡器後方進行水平擴展成為可能。
- **Redis 通道層** — Django Channels 使用 Redis 進行程序間通訊，因此多個 Daphne worker 可以互相廣播 WebSocket 訊息。這對於在多個伺服器實例間擴展 WebSocket 連線至關重要。
- **查詢最佳化** — 整個專案使用 `select_related()` 以防止 N+1 查詢問題（例如聊天訊息的 `select_related('sender')`、課程的 `select_related('teacher')`、選課的 `select_related('student')`）。這些可透過 Django Debug Toolbar 或 `django-silk` 等分析工具識別。
- **資料庫可配置性** — SQLite 資料庫可替換為 PostgreSQL 以支援並行寫入，這在負載平衡器後方運行多個 Daphne worker 時是必要的。
- **白板操作上限** — 白板資料的 500 個操作限制防止 JSON 欄位無限增長，避免效能隨時間劣化。
- **批量電子郵件發送** — `send_mass_mail()` 對所有收件者使用單一 SMTP 連線，相比個別的 `send_mail()` 呼叫減少了開銷。

### 4.11 額外的 Django 功能

**Django Admin** — 所有 12 個模型都使用自訂 `ModelAdmin` 類別註冊到 Django Admin，包含 `list_display`、`list_filter`、`search_fields` 和 `readonly_fields`。Django admin 可在 `http://localhost:8080/admin/` 存取。

**通知系統與電子郵件發送** — 通知系統是事件驅動和雙通道的（應用程式內 + 電子郵件）。集中式工具模組（`notifications/utils.py`）提供兩個函式：

- **`create_notification()`** — 建立應用程式內的 `Notification` 記錄，並在收件者有電子郵件地址時透過 Django 的 `send_mail()` 發送電子郵件。使用 `fail_silently=True` 和 try/except 搭配日誌記錄，確保電子郵件發送失敗不會導致應用程式崩潰。
- **`create_bulk_notifications()`** — 為多個收件者建立通知，並使用 Django 的 `send_mass_mail()` 在單一 SMTP 連線中高效發送電子郵件。

這些工具函式從應用程式中九個不同的事件點呼叫：

| 事件 | 收件者 | 類型 |
|------|--------|------|
| 學生選課 | 教師 | enrollment |
| 學生退選 | 教師 | enrollment |
| 教師封鎖學生 | 學生 | enrollment |
| 教師新增學生 | 學生 | enrollment |
| 教師上傳新教材 | 所有已選課學生 | material |
| 學生提交回饋 | 教師 | feedback |
| 學生提交作業 | 教師 | general |
| 設定/修改作業截止日期 | 所有已選課學生 | deadline |
| 教師刪除課程 | 所有已選課學生 | general |

電子郵件在 `settings.py` 中透過 SMTP（Gmail）配置，使用 `EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'`、`EMAIL_HOST = 'smtp.gmail.com'` 和 `EMAIL_USE_TLS = True`。

### 4.12 架構模式：Model → Serializer → ViewSet

後端遵循分層架構模式，將資料儲存、資料轉換和請求處理分離為三個不同的層次。這個模式是 Django REST Framework 應用程式結構的核心，理解它是理解程式碼組織方式的關鍵。

**第一層：Models — 資料層**

Models 定義*存在哪些資料*以及*如何儲存*。每個 model 對映到一張資料庫表格，封裝欄位定義、關聯（ForeignKey、ManyToManyField）、約束（unique_together、validators）和領域特定方法（例如 `Course.get_average_rating()`）。Models 是資料結構描述的單一事實來源——它們不知道 HTTP、JSON 或 API 消費者的存在。

**為什麼要分離？** 透過隔離資料定義，相同的 models 可以被 REST API、Django Admin、管理命令、WebSocket 消費者和背景任務使用，無需重複。如果資料庫結構描述改變（例如新增欄位），只需更新 model——serialiser 和 view 可以獨立適應。

**第二層：Serializers — 轉換層**

Serializers 位於 model 和 API 消費者之間。它們控制*暴露哪些資料*以及*如何驗證*。`ModelSerializer` 自動將 model 欄位對映到 JSON，但真正的價值來自自訂：

- **控制輸出形狀** — `SerializerMethodField` 計算衍生欄位（`teacher_name`、`enrolled_count`、`average_rating`），無需將它們儲存在資料庫中，在提供扁平、方便的 JSON 回應的同時維持 3NF 正規化。
- **輸入驗證** — serializers 在資料到達資料庫之前進行驗證。例如，`AcceptInvitationSerializer` 驗證密碼強度、檢查使用者名稱唯一性，並確認密碼匹配——全部在 model 的 `save()` 被呼叫之前。
- **解耦內部和外部表示** — model 可能儲存指向 `User` 的 ForeignKey，但 serialiser 將 `teacher_name` 暴露為字串。這意味著即使內部 model 關聯改變，API 契約也可以保持穩定。

**為什麼不在 model 中驗證？** Models 強制資料庫級別的約束（unique、not null、validators）。Serializers 強制 API 級別的約束（密碼確認匹配、檢查電子郵件是否已有邀請、跨欄位驗證）。分離這些關注點意味著 models 在不同上下文中（admin、CLI、tests）保持可重用，而 serializers 處理 API 特定的邏輯。

**第三層：ViewSets — 請求處理層**

ViewSets 控制*誰可以做什麼*以及*請求如何被處理*。它們處理：

- **身份驗證與權限** — 確保使用者已登入且具有正確的角色。
- **業務邏輯** — `perform_create` 將課程教師設定為 `request.user`，檢查教師角色，驗證課程擁有權。這些不是純粹的資料操作——它們編碼了關於誰可以建立什麼的業務規則。
- **查詢集範圍限定** — `get_queryset` 根據請求使用者的角色和關聯過濾資料，確保學生只能看到已選課程，教師只能看到自己的課程。
- **自訂操作** — `@action` 方法如 `enroll`、`unenroll`、`generate` 實作不對映到標準 CRUD 但對領域至關重要的操作。

**為什麼不把業務邏輯放在 model 或 serializer 中？** Models 不應依賴 `request.user`——它們與請求無關。Serializers 不應處理權限檢查——它們驗證資料形狀和內容。ViewSets 是橋接 HTTP 請求上下文與資料層的層次，使它們成為存取控制和請求特定業務邏輯的正確位置。

**各層如何協同工作（範例：建立課程）：**

1. **ViewSet** 接收 POST 請求 → 檢查身份驗證 → 呼叫 `perform_create`。
2. **`perform_create`** 驗證 `request.user.is_teacher()` → 將 `teacher=request.user` 傳遞給 serialiser。
3. **Serializer** 驗證傳入的資料（標題、代碼、日期）→ 呼叫 `model.save()`。
4. **Model** 將資料列寫入資料庫，強制欄位約束並產生自動遞增的 ID。
5. **Serializer** 將儲存的 model 實例轉換回 JSON，計算 `teacher_name`、`enrolled_count` 等。
6. **ViewSet** 回傳序列化的 JSON，附帶 `201 Created` 狀態碼。

每一層都有單一職責且可以獨立測試。Model 測試驗證資料完整性，serialiser 測試驗證 JSON 形狀和驗證，ViewSet 測試驗證權限和 HTTP 行為。

---

## 5. REST API 設計

API 遵循 RESTful 慣例：資源使用名詞（`/api/courses/`、`/api/users/`），HTTP 方法表示操作（GET 用於讀取、POST 用於建立、PATCH 用於更新、DELETE 用於刪除），狀態碼傳達結果（200、201、400、403、404）。API 透過 11 個 ViewSet 加上額外的函式視圖，公開約 80 個端點。重點包括：

- `GET /api/users/search/?q=<query>&user_type=<type>` — 僅限教師使用，透過不分大小寫的 icontains 查詢在 username、full_name 和 email 之間搜尋。
- `POST /api/courses/{id}/enroll/` — 學生註冊選課；建立 Enrollment 和 Notification 並發送電子郵件。
- `POST /api/courses/{id}/unenroll/` — 學生退選；通知教師。
- `POST /api/courses/{id}/block/{student_id}/` — 教師停用學生的選課資格；通知學生。
- `POST /api/courses/{id}/add_student/` — 教師手動新增學生；通知學生。
- `GET /api/courses/{id}/students/` — 僅限教師；列出已選課的學生。
- `GET /api/courses/{id}/materials/` — 僅限已選課學生和課程教師存取。
- `POST /api/assignments/generate/` — 透過上傳 PDF 進行 AI 驅動的測驗/單字卡生成。
- `POST /api/invitations/bulk_upload/` — 接受 CSV 檔案，驗證標頭和資料，批量建立邀請，並回傳每列的錯誤詳情。
- `GET /api/invite/{token}/` 和 `POST /api/invite/{token}/accept/` — 用於邀請接受流程的公開端點。
- `POST /api/notifications/{id}/mark_read/` 和 `POST /api/notifications/mark_all_read/` — 通知管理。
- `POST /api/classrooms/{id}/send/` — 發送訊息，含長度驗證（最多 5000 字元）。
- `GET /api/classrooms/{id}/messages/` — 透過 `select_related('sender')` 優化來取得訊息。

CORS 透過 `django-cors-headers` 設定，允許位於 `localhost:5173` 的 React 開發伺服器向位於 `localhost:8080` 的 API 發送跨域請求。

### 5.1 API 文件（OpenAPI / Swagger）

API 使用 **drf-spectacular** 進行文件化，它會自動從 DRF ViewSet 和序列化器生成 OpenAPI 3.0 架構。該架構驅動兩個互動式文件介面：

- **Swagger UI** 位於 `/api/docs/` — 互動式 API 瀏覽器，開發者可以瀏覽端點、查看請求/回應架構，並直接從瀏覽器測試 API 呼叫。
- **ReDoc** 位於 `/api/redoc/` — 簡潔的三欄式文件版面，適合閱讀和參考。
- **原始架構** 位於 `/api/schema/` — OpenAPI 3.0 JSON 架構，可供程式碼產生器和 API 測試工具使用。

該架構會自動從現有的 ViewSet 定義、序列化器欄位和 URL 路由生成——不需要手動撰寫文件。這確保文件與實際的 API 行為保持同步。本專案記錄了跨所有 ViewSet 的約 47 個 API 端點。

### 5.2 存取控制

每個 API 端點在多個層級執行適當的存取控制：建立時的角色檢查、更新和刪除時的所有權驗證，以及查詢集範圍限定以防止資料洩漏。

**建立層級的權限檢查（`perform_create`）：**

- **課程建立** — 只有 `user_type='teacher'` 的使用者可以建立課程。`perform_create` 方法檢查 `request.user.is_teacher()`，如果學生嘗試透過直接 API 請求建立課程，則引發 `PermissionDenied`。教師會自動設定為課程擁有者。
- **作業建立** — 只有教師可以建立作業，且僅限於自己的課程。`perform_create` 方法同時驗證 `is_teacher()` 和 `course.teacher == request.user`，防止教師在其他教師的課程中建立作業。
- **回饋建立** — 只有已選課的學生可以提交回饋。`perform_create` 方法檢查 `is_student()` 並驗證該學生和目標課程存在有效的 `Enrollment`。
- **作業提交** — 學生必須已選課才能提交。`perform_create` 方法驗證 `request.user` 和 `assignment.course` 存在有效的 `Enrollment`。
- **註冊角色強制** — `RegisterSerializer` 在開放註冊時強制設定 `user_type='student'`，防止權限提升。教師帳號只能由現有教師透過邀請系統建立。

**更新/刪除所有權檢查（`perform_update`/`perform_destroy`）：**

- **課程 CRUD** — 只有課程教師可以更新或刪除自己的課程。
- **教材上傳** — 只有課程教師可以上傳教材到自己的課程；只有上傳者可以修改或刪除。
- **回饋** — 只有回饋作者可以編輯或刪除自己的回饋。
- **作業 CRUD** — 只有作業建立者可以修改或刪除作業。

**查詢集範圍限定（`get_queryset`）：**

- **回饋可見性** — 學生只能看到自己已選課程的回饋；教師只能看到自己課程的回饋。這防止任何使用者查看與自己無關課程的回饋。
- **作業可見性** — 學生只能看到已選課程的作業；教師只能看到自己教授課程的作業。
- **作業提交** — 學生只能看到自己的提交；教師只能看到自己課程的提交。
- **教室聊天室** — 使用者只能看到自己參與的聊天室；訊息和發送功能僅限聊天室參與者。

**端點層級限制：**

- **學生列表** — 只有課程教師可以透過 API 查看已選課學生。
- **教材列表** — 只有已選課學生或課程教師可以存取課程教材。
- **邀請** — 只有教師可以建立和管理邀請。
- **使用者搜尋** — 僅限教師帳號使用。

---

## 6. 使用 WebSocket 的即時通訊

### 6.1 Django Channels 與 ASGI

應用程式使用 Django Channels 4 在標準 HTTP 之外處理 WebSocket 連線。ASGI 入口點（`asgi.py`）使用 `ProtocolTypeRouter` 將 HTTP 請求路由到 Django 的標準 ASGI 處理器，並將 WebSocket 連線路由到 Channels URL 路由器，外層包裝自訂的 `TokenAuthMiddleware`。

Channels 層使用 Redis 作為後端儲存（`channels_redis.core.RedisChannelLayer`），這使得多個工作程序之間能夠傳遞訊息——這對於將訊息廣播給聊天室中的所有參與者至關重要。

### 6.2 Token 身份驗證中介軟體

WebSocket 連線在握手過程中無法發送自訂 HTTP 標頭，因此 token 身份驗證透過查詢字串參數實現。`classroom/middleware.py` 中的自訂 `TokenAuthMiddleware` 從 WebSocket URL 中提取 `token` 查詢參數，查找對應的 `Token` 物件，並將關聯的使用者附加到連線的 `scope`。如果 token 缺失或無效，則指派 `AnonymousUser`，消費者的 `connect()` 方法會透過 `await self.close()` 拒絕連線。

### 6.3 聊天消費者

`classroom/consumers.py` 中的 `ClassroomConsumer` 是一個 `AsyncWebsocketConsumer`，透過 `receive()` 方法中的分發模式處理多種訊息類型：

- **聊天訊息**（`type: 'chat'`）— 驗證長度（最多 5000 字元），透過 `@database_sync_to_async` 儲存到資料庫，並廣播給所有聊天室成員。
- **白板操作**（`type: 'draw' | 'line' | 'text' | 'erase' | 'move' | 'undo' | 'clear'`）— 僅限教師；持久化在 `whiteboard_data` JSON 欄位中（上限 500 個操作以防止無限增長），並廣播以在所有連線的客戶端上即時渲染。
- **音訊串流**（`type: 'audio_start' | 'audio_stop' | 'audio_data'`）— 僅限教師；將原始 PCM 音訊資料（base64 編碼的 16 kHz Int16 樣本）廣播給所有聊天室成員。`audio_data` 處理器會跳過回傳給教師，以防止回饋迴圈。

**存取控制：** 在 WebSocket 連線時，消費者驗證使用者已通過身份驗證且是所請求聊天室的參與者（透過 `is_participant()`）。未經身份驗證的使用者或非參與者的連線會立即被關閉。這防止透過 WebSocket 層未經授權存取聊天室。

在連線時，消費者會將完整的白板狀態發送給加入的客戶端，確保晚加入者能看到當前的白板內容。消費者也會加入每位使用者的群組（`classroom_{room}_user_{username}`），用於定向的信號訊息。

### 6.4 白板實作細節

白板使用 HTML5 Canvas，固定邏輯解析度為 1920x1080，透過 CSS `aspect-ratio: 16/9` 渲染，以在不同螢幕尺寸間維持一致的比例。所有繪圖座標在傳輸前都正規化到 0–1 的範圍，因此 (960, 540) 的點會以 (0.5, 0.5) 發送。這種正規化確保繪圖在任何客戶端的實際畫布尺寸上都呈現在相同的相對位置。

白板支援五種工具：畫筆（自由繪圖）、直線（兩點之間的直線）、文字（在點擊位置的行內文字輸入）、橡皮擦（可調寬度的白色覆蓋）、移動（將文字和直線元素拖曳到新位置）。每個工具操作以帶類型的 WebSocket 訊息發送（例如 `{type: 'draw', points: [[0.1, 0.2], ...], color: '#000', width: 3}`），儲存在伺服器端的 `whiteboard_data` JSON 欄位中，並廣播給所有聊天室成員以即時渲染。復原功能從伺服器端列表中移除最後一個操作並廣播 `wb_undo` 訊息；客戶端透過從本地陣列中彈出最後一個操作並重播所有剩餘操作來回應。

伺服器端白板資料上限為 500 個操作。當達到限制時，最舊的操作會被丟棄以為新操作騰出空間。這防止 `whiteboard_data` JSON 欄位在長時間的教室課程中無限增長。

`@database_sync_to_async` 裝飾器在消費者中用於所有資料庫操作，因為 Django 的 ORM 是同步的。每個白板變更（新增、彈出、移動、清除）讀取當前的 JSON，在 Python 中修改它，然後寫回。

### 6.5 前端音訊串流

音訊串流實作使用 Web Audio API 以實現最大的瀏覽器相容性：

- **教師端：** `getUserMedia()` 擷取麥克風，`AudioContext` 搭配 `ScriptProcessorNode` 擷取原始 PCM 樣本，從原生取樣率（通常 48 kHz）降頻至 16 kHz，編碼為 Int16 陣列，base64 編碼，並每約 85 毫秒（48 kHz 下 4096 個樣本）透過 WebSocket 發送。
- **學生端：** 收到 `audio_start` 後，學生建立一個 `AudioContext`。每個 `audio_data` 區塊從 base64 解碼為 Int16，轉換為 Float32，包裝在 `AudioBuffer` 中，並使用 `AudioBufferSourceNode.start()` 以精確的時序排程進行無縫播放。延遲上限為 1 秒，以防止緩衝區無限增長。

這種方法避免了 WebRTC 的複雜性（offer/answer/ICE 協商）和 MediaSource Extensions API 在純音訊 WebM 上的脆弱性，同時實現了低延遲的一對多廣播。

---

## 7. 前端實作

### 7.1 技術堆疊

前端使用 React 18 和 TypeScript 5.3 建構，以 Vite 5.1 進行打包。Bootstrap 5.3 提供 CSS 框架，並以自訂 CSS 屬性進行增強，打造品牌化主題（漸層強調色、卡片樣式、自訂導覽列）。React Router DOM 6 透過 `BrowserRouter` 處理客戶端路由。Axios 配置了基礎 URL 和一個攔截器，自動將身份驗證 token 附加到每個請求。

### 7.2 狀態管理

全域身份驗證狀態透過 React Context（`AuthContext`）管理，透過 `useAuth()` hook 向所有元件提供 `user`、`login`、`logout` 和 `refreshUser` 函式。各頁面狀態使用 React 內建的 `useState` 和 `useRef` hook。Classroom 頁面是最複雜的元件（約 900 行），管理 WebSocket 連線、畫布繪圖狀態、行內文字輸入、音訊串流和聊天訊息——全部透過本地狀態和 ref。WebSocket `useEffect` 中的自訂重連機制會在後端重啟時自動以 2 秒重試間隔重新建立連線。

### 7.3 主要頁面（14 個元件）

- **StudentHome** 和 **TeacherHome** — 依角色區分的儀表板，顯示已選/已教授的課程、動態更新訊息，以及（教師端）具有新增學生功能的即時使用者搜尋介面。
- **CourseDetail** — 顯示課程資訊、教材（含下載連結）、已選課學生列表（教師檢視）、回饋表單（學生檢視），以及作業管理。
- **CourseCreate** — 教師建立新課程的表單，包含課程代碼、標題、描述和日期。
- **AssignmentView** — 學生的測驗作答介面（含自動評分的選擇題）、單字卡複習（翻牌互動）、成績顯示和提交歷史。教師可查看所有學生的提交。
- **Classroom** — 即時功能中樞，包含共享白板（畫筆、直線、文字、橡皮擦、移動工具，可調整大小和顏色）、即時聊天和音訊串流。
- **Profile** — 顯示使用者資訊、動態更新、已教授/已選課程、即將到來的截止日期，以及 AI API 金鑰管理。擁有者可編輯並上傳照片。
- **InviteBulk** — 拖放式 CSV 上傳，用於批量學生邀請，提供每列驗證回饋和可下載的 CSV 範本。
- **InviteSingle** — 邀請個別學生的表單，包含電子郵件、姓名、使用者類型和選填的出生日期。
- **InvitationList** — 教師的儀表板，顯示所有已發送的邀請及其狀態（待處理/已接受/已過期）和重新發送功能。
- **AcceptInvitation** — 接受邀請連結的公開頁面，包含使用者名稱/密碼建立表單。
- **Login** 和 **Register** — 含表單驗證的身份驗證頁面。
- **Notifications** — 顯示所有應用程式內通知，具有標記為已讀和全部標記為已讀功能。

### 7.4 自訂主題

應用程式使用建構在 CSS 自訂屬性上的自訂 CSS 主題（`theme.css`），覆蓋 Bootstrap 的預設值。這提供了品牌化外觀，包含漸層強調色、自訂卡片樣式、導覽列樣式、頭像漸層和發光效果——全部無需修改 Bootstrap 的原始碼。此主題展示了 CSS 自訂屬性如何實現超越 Bootstrap 內建工具的主題化：

```css
:root {
  --el-green: #2ecc71;
  --el-blue: #3498db;
  --el-gradient: linear-gradient(135deg, var(--el-green), var(--el-blue));
}
```

---

## 8. 身份驗證與安全性

身份驗證使用 DRF 的 `TokenAuthentication`。登入或註冊時，伺服器產生並回傳一個 token。React 前端將此 token 儲存在 `localStorage` 中，並透過攔截器將其附加到每個 Axios 請求。WebSocket 身份驗證由第 6.2 節描述的自訂 `TokenAuthMiddleware` 處理。

安全措施包括：

- **CORS** 透過 `django-cors-headers` 限制為前端來源。
- **CSRF 保護**已啟用（但依 DRF 慣例，token 身份驗證的 API 請求可豁免）。
- **密碼雜湊**透過 Django 預設的 PBKDF2 雜湊器。
- **密碼驗證**使用 Django 內建的驗證器（MinimumLengthValidator 等）。
- **輸入驗證**在序列化器和模型兩個層級進行。
- **檔案上傳驗證**使用 `FileExtensionValidator` 限制上傳的檔案類型。
- **封鎖使用者處理** — 被封鎖的使用者無法登入（在 `auth_login` 時檢查），且從使用者列表中排除。
- **多層級權限執行：**
  - *建立檢查：* 課程建立僅限教師。作業建立僅限擁有該課程的教師。回饋僅限已選課學生。提交僅限已選課學生。註冊強制為學生角色（教師僅透過邀請建立）。
  - *所有權檢查：* CourseViewSet、CourseMaterialViewSet、FeedbackViewSet 和 AssignmentViewSet 在允許更新或刪除操作前驗證所有權。
  - *查詢集範圍限定：* 回饋、作業和提交依使用者角色過濾——學生只能看到已選課程的資料，教師只能看到自己課程的資料。
- **端點層級存取控制：**
  - 學生端點僅限課程教師。
  - 教材端點僅限已選課學生和課程教師。
  - 作業提交範圍限定為教師自己課程。
  - 教室聊天室過濾為僅限參與者；訊息/發送限制為參與者。
- **WebSocket 存取控制** — 如果使用者不是聊天室的已認證參與者，連線會被拒絕。
- **訊息長度限制** — 聊天訊息在 API 和 WebSocket 兩個層級都限制為 5000 字元。
- **白板操作限制** — 上限為 500 個操作，以防止記憶體耗盡。

---

## 9. 測試策略

### 9.1 後端測試

專案包含 132 個測試方法，分布在四個測試檔案中，使用 Django 的 `TestCase` 和 DRF 的 `APITestCase`：

- **accounts/tests.py** — 8 個測試類別中的 79 個測試方法，涵蓋：使用者模型方法（`is_student`、`is_teacher`、`str`）、動態更新 CRUD 和排序、邀請生命週期（建立、token 生成、過期、重新發送、含 CSV 驗證的批量上傳）、身份驗證 API（登入、註冊、token 管理、封鎖使用者拒絕）、使用者搜尋（依姓名、電子郵件、類型，含自我排除）、使用者封鎖/解除封鎖及權限檢查，以及個人資料更新。
- **courses/tests.py** — 6 個測試類別中的 31 個測試方法，涵蓋：課程模型方法（`get_enrolled_students_count`、`get_average_rating`）、選課唯一約束和字串表示、回饋唯一約束、課程 API 操作（CRUD、選課/退選、封鎖學生、學生列表、教材列表）、選課可見性過濾（學生看到自己的選課，教師看到課程選課），以及權限執行（回饋需要選課，未選課使用者被拒絕）。
- **classroom/tests.py** — 3 個測試類別中的 9 個測試方法，涵蓋：聊天室和訊息模型（字串表示、排序、參與者），以及聊天室 API（建立、列表、發送訊息、取得訊息、未認證存取拒絕）。
- **notifications/tests.py** — 4 個測試類別中的 13 個測試方法，涵蓋：通知模型屬性（字串表示、預設 is_read、排序）、通知 API（列表、標記已讀、全部標記已讀、跨使用者隔離、未認證存取），以及工具函式測試（含電子郵件的 create_notification、無地址時跳過電子郵件、含大量郵件的批量通知、使用 `unittest.mock.patch` 的電子郵件失敗韌性）。

### 9.2 測試覆蓋率與方法論

測試驗證正向路徑（正確建立、成功操作）和負向路徑（權限拒絕、重複條目、無效資料、過期 token）。每個測試類別中的 `setUp` 方法建立隔離的測試資料，確保測試獨立且可重現。

**權限測試**特別徹底：每個僅限教師的操作都使用教師帳號（預期成功）和學生帳號（預期 403 Forbidden）進行測試，確保基於角色的存取控制正確運作。涵蓋的邊界案例包括：

- 被封鎖後重新選課（重新啟用邏輯）。
- 接受過期的邀請 token。
- 上傳缺少標頭、重複電子郵件或無效資料的 CSV。
- 批量上傳含有效/無效混合列並回傳每列錯誤詳情。
- 電子郵件傳送失敗不會導致通知建立崩潰（mock `send_mail` 引發 `Exception`）。
- 全部標記已讀不會影響其他使用者的通知。

**Mock 測試：** 通知工具函式測試使用 `unittest.mock.patch` 來 mock `send_mail` 和 `send_mass_mail`，驗證電子郵件正確發送而無需在測試期間使用真實的 SMTP 伺服器。

### 9.3 前端測試

前端包含 12 個測試檔案，位於 `src/__tests__/` 下，使用 Jest 和 React Testing Library，涵蓋 Login、Register、AcceptInvitation、InvitationList、InviteSingle、InviteBulk、CourseCreate、Notifications、Navbar、ProtectedRoute 和 TeacherHome 元件的渲染和基本互動。

### 9.4 執行測試

```bash
# Run all 132 back-end tests
docker compose exec backend python manage.py test

# Run tests for a specific app
docker compose exec backend python manage.py test accounts    # 79 tests
docker compose exec backend python manage.py test courses     # 31 tests
docker compose exec backend python manage.py test classroom        # 9 tests
docker compose exec backend python manage.py test notifications  # 13 tests

# Run front-end tests
docker compose exec frontend npx jest --passWithNoTests
```

---

## 10. 滿足需求

### R1 — 功能需求

| Req | Description | Implementation |
|-----|-------------|----------------|
| a | Account creation | `RegisterSerializer` + `auth_register` API + `Register.tsx` |
| b | Login/Logout | `auth_login`/`user_logout` APIs + `Login.tsx` with token management |
| c | Teacher search | `UserViewSet.search` with icontains on username, full_name, email + filter by user_type |
| d | Add courses | `CourseViewSet.create` (teacher auto-set via `perform_create`) + `CourseCreate.tsx` |
| e | Student enrolment | `CourseViewSet.enroll`/`unenroll` actions + Enrollment model with unique constraint |
| f | Course feedback | `FeedbackViewSet` + Feedback model (rating 1–5 + comment, unique per student–course) |
| g | Real-time chat | `ClassroomConsumer` (Channels) + Redis + `Classroom.tsx` WebSocket client |
| h | Block students | `UserViewSet.block/unblock` (global) + `CourseViewSet.block_student` (per-course) + student notification |
| i | Status updates | `StatusUpdateViewSet` + `StudentHome.tsx`/`TeacherHome.tsx` post form |
| j | Upload materials | `CourseMaterialViewSet` + file validation + `CourseDetail.tsx` upload form |
| k | Enrollment notification | `create_notification()` called on enroll/unenroll/block — in-app + email to teacher or student |
| l | Material notification | `create_bulk_notifications()` in `upload_material` for all active enrollees — in-app + email |

### R2 — 技術需求

| Req | Description | Evidence |
|-----|-------------|----------|
| a | Models & migrations | 12 models, 4 migration directories, custom User with AUTH_USER_MODEL |
| b | Forms, validators, serialisation | 7 forms, 17 serialisers, FileExtensionValidator, MinValue/MaxValueValidator, custom validate methods |
| c | DRF | 11 ViewSets, DefaultRouter, TokenAuth, 20+ @action endpoints, custom permissions, SerializerMethodField |
| d | URL routing | App-level urlpatterns, DefaultRouter, named routes, WebSocket routing via URLRouter |
| e | Unit testing | 132 back-end test methods + 12 front-end test files |

### R3 — 資料庫模型

此結構描述了帳戶（User、Invitation、StatusUpdate）、學術資料（Course、CourseMaterial、Enrollment、Feedback、Assignment、AssignmentSubmission）、社交功能（Classroom、ClassroomMessage）以及系統資料（Notification）——共 12 個模型，包含適當的外鍵關聯、唯一約束和驗證器，詳見第 3 節。此結構描述已正規化至第三正規化形式（3NF）。

### R4 — REST 介面

提供了一套完整的 REST API，涵蓋所有資源，約有 80 個端點。API 使用標準的 HTTP 方法、有意義的狀態碼，以及一致的 JSON 回應格式。除了登入、註冊和邀請接受之外，所有端點均需要身份驗證。所有 CRUD 操作均強制執行物件級別的權限控制。

### R5 — 伺服器端測試

132 個測試方法分布在 15 個測試類別中，涵蓋模型行為、API 端點、權限、輸入驗證、電子郵件發送及邊界情況。可透過 `docker compose exec backend python manage.py test` 執行測試。

---

## 11. 容器化

Docker Compose 定義了三個服務：

1. **backend** — Python 3.11-slim，執行 `daphne -b 0.0.0.0 -p 8080 elearning_project.asgi:application`。原始碼透過 volume 掛載以支援即時開發；媒體檔案儲存在具名的 Docker volume 中。`.dockerignore` 檔案排除了 `__pycache__`、`*.pyc`、`.env`、`db.sqlite3` 和 `media/` 以縮小建置上下文。
2. **frontend** — Node 20-alpine，執行 `npm run dev -- --host`。原始碼透過 volume 掛載，`node_modules` 透過 `.dockerignore` 排除以避免平台不相容問題。
3. **redis** — Redis 7-alpine，作為 Channels 的通道層使用。

僅需一條 `docker compose up --build` 指令即可啟動整個技術堆疊。環境變數從專案根目錄的 `.env` 檔案載入。

---

## 12. 批判性評估

### 12.1 優勢

- **解耦架構：** React SPA 完全透過定義明確的 API 契約與 Django 後端通訊。這使得每一層都可以獨立測試和替換。
- **全面的即時功能：** 教室頁面結合了即時聊天、具備多種工具（畫筆、直線、文字、橡皮擦、移動、復原）的協作白板，以及音訊串流——全部透過單一 WebSocket 連線並具備適當的存取控制。
- **健全的邀請系統：** 批次 CSV 上傳搭配逐行驗證、基於 token 的接受連結以及過期處理，超越了基本需求。
- **雙通道通知：** 每個應用程式內通知也透過集中式工具模組以電子郵件發送，確保使用者即使未登入也能收到通知。
- **優良的測試覆蓋率：** 132 個後端測試涵蓋正向路徑、負向路徑、權限、電子郵件發送模擬及邊界情況，為應用程式提供了穩固的回歸防護網。
- **AI 驅動的作業：** 整合 OpenAI 的 API，可從 PDF 教材自動產生測驗和閃卡，增添了現代 AI 驅動的功能。
- **嚴謹的存取控制：** 多層權限執行——基於角色的建立檢查（`perform_create`）、更新/刪除時的擁有者驗證、查詢集範圍限定以防止資料外洩，以及 WebSocket 參與者驗證——確保所有資料存取路徑都能妥善防範繞過 UI 的直接 API 請求和跨使用者資料存取。
- **互動式 API 文件：** API 透過 drf-spectacular 實現自動文件化，提供從 DRF ViewSet 定義自動產生的 Swagger UI 和 ReDoc 介面。這改善了開發者體驗，並確保文件與實作保持同步。

### 12.2 弱點與改進方向

- **SQLite 的限制：** 預設的 SQLite 資料庫足以應付開發和展示，但缺乏並行寫入支援。在正式環境中，PostgreSQL 會是更好的選擇，且已透過環境變數支援。
- **ScriptProcessorNode 已棄用：** 音訊串流使用的 `ScriptProcessorNode` 已被棄用，建議改用 `AudioWorklet`。ScriptProcessorNode 在目前所有瀏覽器中仍可運作，但未來版本應遷移至 AudioWorklet 以獲得更好的效能和前瞻相容性。AudioWorklet API 需要一個獨立的 JavaScript 檔案作為處理器，增加了複雜度，但消除了主執行緒的音訊處理開銷。
- **缺少分頁：** API 目前回傳所有結果而未進行分頁。若在正式部署中有數百門課程或數千位使用者，應在 DRF 設定中配置 `PageNumberPagination` 或 `CursorPagination`。
- **缺少快取：** 經常存取但不常變更的資料（例如課程列表、使用者個人資料）將受益於 Django 的快取框架，可使用已有的 Redis 實例作為後端。
- **白板資料儲存：** 將白板歷史記錄以 JSON 字串儲存在文字欄位中雖然簡單，但對於非常長的工作階段擴展性不佳（已透過 500 個動作的上限加以緩解）。更具擴展性的方法是使用 Redis 儲存暫時性的工作階段資料，僅持久化最終快照。
- **前端狀態管理：** Classroom 元件約有 900 行程式碼，因為它在單一元件中管理 WebSocket 狀態、畫布繪圖、音訊串流和聊天。提取自訂 hooks（例如 `useWebSocket`、`useWhiteboard`、`useAudioStream`）將改善可讀性和可測試性。

### 12.3 我會做出的改變

如果重新開始這個專案，我會：

1. **從一開始就使用 PostgreSQL**，以支援並行存取和全文搜尋（以 `SearchVector`/`SearchRank` 取代目前的 icontains 搜尋）。
2. **實作 AudioWorklet** 進行音訊串流，避免使用已棄用的 ScriptProcessorNode。
3. **新增基於 WebSocket 的通知**，取代輪詢方式，讓學生能即時收到註冊和教材通知，無需重新整理頁面。
4. **使用 React 自訂 hooks** 將 Classroom 元件分解為更小、更專注的單元。
5. **新增 Celery 處理背景任務**，例如非同步發送電子郵件和處理大型 CSV 上傳，這些在課程教材中有涵蓋，也能展示任務佇列的使用。

### 12.4 與業界最新技術的關係

現代網頁應用程式越來越多地採用即時、事件驅動的架構。本專案展示了數項最新技術模式：

- **WebSocket 優先的即時功能** — 不同於長輪詢或 Server-Sent Events，本應用程式使用雙向 WebSocket 進行聊天、白板和音訊。這與 Slack、Discord 和其他現代即時應用程式所採用的方法相同。
- **基於 Token 的 API 身份驗證** — 遵循 SPA 後端的產業標準，避免在 API 呼叫中使用 session cookies 和 CSRF 的複雜性。此模式幾乎被所有現代單頁應用程式所採用。
- **AI 整合** — OpenAI API 整合用於從上傳的 PDF 教材自動產生測驗和閃卡，展示了現代應用程式如何結合大型語言模型來提升使用者生產力。這是當前的產業趨勢（例如 Notion AI、Google Workspace AI、Duolingo 的 AI 功能）。
- **基於容器的開發** — Docker Compose 確保開發環境的可重現性，反映了產業 CI/CD 管線中使用的正式部署實踐。
- **TypeScript** — 採用 TypeScript 反映了產業走向型別安全前端開發的趨勢，減少執行階段錯誤。TypeScript 現在被大多數專業 React 專案所使用。
- **基於元件的 UI** — React 的元件模型是現代前端開發的主流範式，被 Meta、Netflix、Airbnb 等公司所採用。
- **事件驅動通知** — 結合應用程式內通知與電子郵件的雙通道通知系統，搭配集中式工具函式，反映了 GitHub、Jira 和其他協作平台所使用的模式。

然而，本專案可以進一步與最新技術實踐對齊，例如採用伺服器端渲染（Next.js）以利於 SEO、實作 GraphQL 以實現更靈活的資料擷取、使用 WebAuthn 實現無密碼身份驗證，以及部署至雲端供應商並搭配 CI/CD 管線。

### 12.5 方法比較

數個設計決策涉及在競爭方案之間做出選擇：

**Token 與 JWT 身份驗證：** 本專案使用 DRF 基於資料庫的 token 身份驗證，而非 JSON Web Tokens（JWTs）。基於資料庫的 token 實作更簡單，且可透過刪除 token 記錄即時撤銷。JWTs 雖然無狀態且更具擴展性，但若不維護黑名單就無法撤銷，這抵消了其無狀態的優勢。對於教室規模的應用程式，基於資料庫的 token 是務實的選擇。

**WebSocket 音訊與 WebRTC：** 最初的設計使用 WebRTC 進行點對點音訊，這是即時媒體的標準方案。然而，WebRTC 需要複雜的信令（offer/answer/ICE 協商）以及每個聽眾一個獨立的對等連線。最終實作使用現有 WebSocket 連線傳輸原始 PCM，這更簡單，可在防火牆和 NAT 後方可靠運作而無需 TURN 伺服器，且利用了已建立的 WebSocket 基礎設施。代價是更高的頻寬（每個聽眾約 43 KB/s 的 base64 編碼音訊）以及伺服器端的處理開銷以廣播至所有客戶端，但對於教室規模的群組而言是可接受的。

**SQLite 與 PostgreSQL：** 選擇 SQLite 是為了開發的簡便性（無需額外服務，單一檔案資料庫）。專案基於環境變數的配置（`DB_ENGINE`、`DB_NAME`）允許在不修改程式碼的情況下切換至 PostgreSQL，這在任何正式部署中都是必要的，以支援來自多個 Daphne worker 的並行寫入。

**集中式通知工具函式與 Django signals：** 通知的建立可以透過 Django 的 signal 框架實作（例如在 Enrollment 上使用 `post_save`）。然而，本專案選擇了明確的工具函式呼叫，因為這使通知邏輯在呼叫處可見、更容易除錯，且允許傳遞上下文資訊（例如特定的訊息文字），這在通用的 signal 處理器中較難實現。這遵循了 Python 的原則「明確優於隱含」。

---

## 13. 設定與執行說明

### 13.1 開發環境

- **作業系統：** Windows 11 搭配 WSL2（Ubuntu），Linux 6.6.87.2-microsoft-standard-WSL2
- **Python 版本：** 3.11（Docker 容器內，python:3.11-slim）
- **Node.js 版本：** 20（Docker 容器內，node:20-alpine）
- **Docker：** Docker Desktop 搭配 Docker Compose v2

### 13.2 套件版本

**後端（requirements.txt）：**

| Package | Version |
|---------|---------|
| Django | 4.2.27 |
| djangorestframework | 3.14.0 |
| channels | 4.0.0 |
| channels-redis | 4.1.0 |
| daphne | 4.0.0 |
| Pillow | 10.2.0 |
| redis | 5.0.1 |
| django-cors-headers | 4.3.1 |
| pypdf | 4.1.0 |
| django-extensions | 4.1 |
| pydotplus | 2.0.2 |
| drf-spectacular | 0.28.0 |

**前端（package.json）：**

| Package | Version |
|---------|---------|
| react | 18.2.0 |
| react-dom | 18.2.0 |
| react-router-dom | 6.22.0 |
| typescript | 5.3.3 |
| vite | 5.1.0 |
| axios | 1.6.7 |
| bootstrap | 5.3.3 |

### 13.3 安裝與執行

```bash
# 1. Unzip the project
unzip claude_elearning.zip
cd claude_elearning

# 2. Start all services
docker compose up --build

# 3. (First run only) Run migrations and populate demo data
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py populate_db

# 4. Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:8080/api/
# Django Admin: http://localhost:8080/admin/
# API Docs (Swagger): http://localhost:8080/api/docs/
# API Docs (ReDoc): http://localhost:8080/api/redoc/
```

### 13.4 登入憑證

**Django Admin：**

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Teacher (superuser) |

**教師帳號：**

| Username | Password |
|----------|----------|
| john_teacher | teacher123 |
| maria_teacher | teacher123 |

**學生帳號：**

| Username | Password |
|----------|----------|
| alice_student | student123 |
| bob_student | student123 |
| charlie_student | student123 |
| diana_student | student123 |

### 13.5 執行測試

```bash
# Back-end tests (all apps — 132 tests)
docker compose exec backend python manage.py test

# Back-end tests (specific app)
docker compose exec backend python manage.py test accounts
docker compose exec backend python manage.py test courses
docker compose exec backend python manage.py test classroom
docker compose exec backend python manage.py test notifications

# Front-end tests
docker compose exec frontend npx jest --passWithNoTests
```

---

## 14. 超越課程大綱的進階技術

本節重點介紹專案中使用的、超越課程所涵蓋之標準 Bootstrap/jQuery/Django 主題的技術與工具：

1. **React 18 搭配 TypeScript** — 具備靜態型別的現代元件式 SPA 框架，以完全解耦的前端取代伺服器端模板渲染。TypeScript 在編譯時期捕捉型別錯誤，提升程式碼可靠性。

2. **Vite** — 新一代建置工具，具備近乎即時的熱模組替換，取代基於 Webpack 的工具鏈（Create React App）。Vite 基於 ES module 的開發伺服器在開發過程中提供顯著更快的回饋。

3. **Django Channels 搭配 ASGI** — 透過 Daphne 與傳統 HTTP 並行運行的非同步 WebSocket 支援。`AsyncWebsocketConsumer` 搭配 `@database_sync_to_async` 橋接了非同步 WebSocket 層與 Django 的同步 ORM。

4. **HTML5 Canvas API** — 用於互動式白板，採用正規化座標（0–1 範圍）以實現解析度無關性，支援手繪畫筆、直線、文字輸入、橡皮擦、移動和復原工具。

5. **Web Audio API** — 透過 `AudioContext`、`ScriptProcessorNode` 和 `AudioBufferSourceNode` 實現從教師到學生的即時 PCM 音訊串流，提供精確計時的無縫播放。

6. **OpenAI API 整合** — AI 驅動的自動測驗和閃卡產生，從上傳的 PDF 教材中提取內容。系統從 PDF 中擷取文字（透過 pypdf），為 OpenAI 的 Chat Completions API 建構提示詞，解析 JSON 回應，並建立可自動評分的作業。

7. **Docker Compose** — 容器化的開發和部署，包含三個服務（Python、Node、Redis），volume 掛載支援即時開發，以及 `.dockerignore` 檔案優化建置上下文。

8. **CSS Custom Properties 主題化** — 完全使用 CSS 自訂屬性覆寫 Bootstrap 預設值所建構的品牌視覺主題，展示了不修改框架原始碼的現代 CSS 主題化技術。

9. **React Context API** — 透過 `AuthContext` 搭配 `useContext` hook 進行全域身份驗證狀態管理，取代傳統的狀態管理函式庫。

10. **雙通道通知系統** — 集中式工具函式結合應用程式內通知與透過 Django 的 `send_mail`/`send_mass_mail` 發送的電子郵件，具備優雅的錯誤處理和日誌記錄。

11. **OpenAPI / Swagger 文件** — 由 drf-spectacular 從現有的 ViewSet 和序列化器定義自動產生的 API 文件，在 `/api/docs/` 和 `/api/redoc/` 提供互動式 Swagger UI 和 ReDoc 介面，無需手動維護文件。

---

## 參考文獻

1. Django Software Foundation. *Django Documentation 4.2*. https://docs.djangoproject.com/en/4.2/
2. Encode. *Django REST Framework Documentation*. https://www.django-rest-framework.org/
3. Django Channels. *Channels Documentation*. https://channels.readthedocs.io/
4. Meta Platforms. *React Documentation*. https://react.dev/
5. Evan You. *Vite Documentation*. https://vitejs.dev/
6. Mozilla Developer Network. *Web Audio API*. https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
7. Mozilla Developer Network. *WebSocket API*. https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
8. Mozilla Developer Network. *Canvas API*. https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
9. OpenAI. *Chat Completions API Documentation*. https://platform.openai.com/docs/api-reference/chat
10. E.F. Codd. *A Relational Model of Data for Large Shared Data Banks*. Communications of the ACM, 1970.
11. Docker Inc. *Docker Compose Documentation*. https://docs.docker.com/compose/
12. Microsoft. *TypeScript Documentation*. https://www.typescriptlang.org/docs/
