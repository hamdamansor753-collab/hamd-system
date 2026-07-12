# 🏭 H.A.M.D — برنامج مخازن SaaS احترافي متكامل (Multi-Tenant)

> **هذا الملف هو الـ Master Prompt.** انسخه كامل وحطه كأول رسالة/تعليمات لأداة Antigravity (أو أي Agentic Coding Tool) قبل ما تبدأ التنفيذ. باقي ملفات الـ Spec Kit مراجع تفصيلية يقرأها الـ AI عند الحاجة لكل موديول.

---

## ⚠️ ملاحظة براندنج مهمة
اسم **H.A.M.D** هنا يخص منتج **مستقل بالكامل** عن نظام إدارة معامل الأسنان (hamdlabs.com). هما منتجين مختلفين بنفس الاسم التجاري. تأكد إن أي نص تسويقي أو صفحة هبوط أو حتى الـ metadata جوه الكود (package.json name, app title) بيوضح إن ده "H.A.M.D — Warehouse Management SaaS" مش نظام المعمل، تفاديًا لتضارب الدومين/الباحث/العميل بينهم.

---

## نظرة عامة

بناء نظام إدارة مخازن (WMS) **متعدد المستأجرين (Multi-Tenant SaaS)** يعمل كـ Web App وPWA، بتصميم عربي أول (RTL كامل)، لمنافسة "السهل" وما هو أفضل منه. النظام هيُباع كاشتراك شهري/سنوي لعملاء متعددين، كل عميل (Tenant) له بياناته معزولة تمامًا عن باقي العملاء.

## القرارات المعمارية الحاسمة (غير قابلة للتفاوض)

1. **PostgreSQL من اليوم الأول** — لا SQLite حتى في مرحلة التطوير المحلي. استخدم Docker Compose محلي لتشغيل Postgres، لأن الترقية اللاحقة من SQLite بتسبب مشاكل توافق أنواع بيانات مع Prisma (enums, JSON fields) ومشاكل concurrency حقيقية مع POS.
2. **Stock Ledger مركزي واحد** — أي تغيير في المخزون (بيع، شراء، مرتجع، تحويل، تسوية جرد) **يجب** يعدي من خدمة واحدة فقط: `StockMovementService`. ممنوع أي كود يعدّل رصيد صنف مباشرة (`UPDATE product SET quantity = ...`). الرصيد الحالي = مجموع حركات `StockMovement` (أو `StockBalance` كجدول cache محسوب من الحركات وليس مصدر الحقيقة).
3. **Tenant Isolation إجباري** — كل جدول بيانات تشغيلية (مش جداول ثابتة زي Currency) لازم فيه `tenantId` مع فهرس (index) عليه، وكل استعلام Prisma لازم يمر بـ middleware أو helper مركزي (`getTenantScope()`) بيضيف الفلتر تلقائيًا. ممنوع الاعتماد على المطور إنه "يفتكر" يحط الفلتر يدويًا في كل route — ده أخطر باب لتسريب بيانات بين العملاء (زي الباج اللي لقيناه قبل كده في مشروع مشابه).
4. **كل حركة مالية أو مخزنية لازم تتسجل في Audit Log** (مين، امتى، من أي IP، القيمة قبل وبعد).
5. **الأسعار والضرائب لا تُحسب على الواجهة (Frontend)** — أي حساب لسعر نهائي أو ضريبة يتم في الـ Backend فقط، والـ Frontend بيعرض النتيجة بس.

## الميزات الرئيسية (كما في الرؤية الأصلية، بدون تغيير جوهري)

راجع الملفات المرقّمة 01-12 في هذا المجلد — كل ملف يغطي موديول كامل بالتفصيل (نماذج البيانات، الـ API endpoints، حالات حافة، قواعد العمل).

## Tech Stack

| الطبقة | التقنية |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui |
| الرسوم البيانية | Recharts |
| النماذج | React Hook Form + Zod |
| إدارة الحالة | Zustand |
| Backend | Next.js API Routes + Prisma ORM |
| قاعدة البيانات | **PostgreSQL** (لا بديل) |
| المصادقة | NextAuth.js + RBAC مخصص |
| الموبايل | PWA (next-pwa) + Service Workers + Camera API للباركود |
| الدفع/الاشتراكات | Stripe أو Paymob (حسب السوق المستهدف) |

## هيكل المشروع المقترح

```
hamd-stock/
├── app/
│   ├── (auth)/                 # login, register, forgot-password
│   ├── (dashboard)/[tenant]/   # كل صفحات العميل تحت مسار الـ tenant
│   │   ├── page.tsx            # KPIs
│   │   ├── inventory/
│   │   ├── warehouses/
│   │   ├── pos/
│   │   ├── sales/ purchases/ returns/ quotations/
│   │   ├── customers/ suppliers/
│   │   ├── finance/
│   │   ├── reports/
│   │   └── settings/
│   ├── (platform-admin)/       # لوحة تحكم مالك المنصة نفسه (إدارة الـ Tenants والاشتراكات)
│   └── api/
├── lib/
│   ├── prisma.ts
│   ├── auth.ts
│   ├── tenant-scope.ts         # ⭐ helper إجباري لعزل الـ tenant في كل query
│   └── stock-movement-service.ts  # ⭐ الـ Ledger المركزي
├── prisma/schema.prisma
└── public/ (manifest.json, sw.js)
```

## خطة التنفيذ — المراحل (لم يبدأ أي منها بعد)

- [ ] **المرحلة 0**: البنية التحتية — Postgres (Docker)، إعداد Multi-tenancy الأساسي (schema-per-tenant أو shared-schema مع tenantId — قرار في ملف 13)، Auth، RBAC الأساسي
- [ ] **المرحلة 1**: إدارة المخزون — الأصناف، الفئات، الوحدات، الباركود، **StockMovementService**
- [ ] **المرحلة 2**: المخازن والمواقع (Rack/Shelf/Bin) والتحويلات بينها
- [ ] **المرحلة 3**: العمليات التجارية — POS، فواتير المبيعات/المشتريات، المرتجعات، عروض الأسعار
- [ ] **المرحلة 4**: العملاء والموردين (CRM) + الإدارة المالية (خزائن، شيكات، مصروفات)
- [ ] **المرحلة 5**: لوحة التحكم والتقارير المتقدمة
- [ ] **المرحلة 6**: SaaS Billing — خطط الاشتراك، الفوترة التلقائية، حدود الاستخدام لكل خطة
- [ ] **المرحلة 7**: PWA والموبايل — الباركود بالكاميرا، Offline sync، Push notifications
- [ ] **المرحلة 8**: اختبارات (Playwright) + تدقيق أمني قبل الإطلاق

> ملاحظة: كل الصناديق فاضية عمدًا — لا تعتبر أي مرحلة مكتملة إلا بعد مراجعة كود فعلي موجود.

## تعليمات مباشرة لـ Antigravity

1. اقرأ ملف `02-database-schema.prisma` وابنِ عليه — لا تنشئ schema من الصفر.
2. ابدأ بالمرحلة 0 فقط، ولا تنتقل لمرحلة تالية إلا بعد ما أراجع وأوافق.
3. أي جدول جديد تضيفه غير الموجود في الـ schema المرفق، لازم يحتوي `tenantId String` + `@@index([tenantId])`.
4. لا تكتب أي منطق حساب رصيد مخزون مباشر — استخدم فقط `StockMovementService` الموصوف في ملف `03-stock-ledger-architecture.md`.
