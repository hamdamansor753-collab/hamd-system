# H.A.M.D — Warehouse SaaS — Spec Kit

## ترتيب القراءة الموصى به (لـ Antigravity أو أي Agentic Tool)

1. **00-master-prompt.md** ← ابدأ من هنا دائمًا، هو البرومبت الرئيسي اللي تلصقه أول حاجة
2. `01-overview-and-tenancy-strategy.md` — قرار الـ multi-tenancy والاشتراكات
3. `02-stock-ledger-architecture.md` ⭐ — أهم ملف معماري في المشروع كله
4. `03-database-schema.prisma` — مسودة الـ schema الكاملة، ابنِ عليها ولا تبدأ من صفر
5. `04-module-inventory.md`
6. `05-module-pos.md`
7. `06-module-invoices-purchases.md`
8. `07-module-crm.md`
9. `08-module-finance.md`
10. `09-modules-dashboard-rbac-mobile-saas.md`

## طريقة الاستخدام
1. افتح مجلد المشروع الفارغ في Antigravity
2. الصق محتوى `00-master-prompt.md` كتعليمات أولى
3. اطلب من الأداة تقرأ باقي الملفات (ارفعها كلها في نفس المجلد أو كـ context) قبل كتابة أي كود
4. نفّذ **مرحلة واحدة بس في كل مرة** (راجع قسم "خطة التنفيذ" في الملف الرئيسي) وارجعلي أراجع الكود قبل الانتقال للمرحلة التالية

## تذكير
- PostgreSQL من أول يوم — لا SQLite
- كل حركة مخزون تعدي من `StockMovementService` فقط
- كل جدول عملياتي لازم فيه `tenantId` + index
- الأدوار [ ] في خطة التنفيذ فاضية عمدًا — متعتبرش حاجة خلصت غير بعد ما تشوف كود فعلي
