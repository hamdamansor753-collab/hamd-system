# 🔒 Security Fixes — 2026-07-12 Audit Pass

هذا الملف بيوثّق الثغرات اللي تم اكتشافها في مراجعة أمنية وتم إصلاحها في هذا الـ commit. أي حد هيشتغل على الكود بعد كده لازم يقرأه.

## تم الإصلاح

| # | المشكلة | الملف | الحالة |
|---|---|---|---|
| 1 | حساب `superadmin`/`superadmin123` بيتزرع تلقائيًا بباسورد ثابت مكشوف في كود عام | `db.js` | ✅ اتشال، محتاج سكربت bootstrap آمن بديل (انظر "لسه ناقص" تحت) |
| 2 | كلمات سر بتتقارن كنص عادي (plaintext fallback) في الـ login | `db.js` | ✅ اتشال، Firebase Auth بس هو مصدر الحقيقة |
| 3 | `/api/create-user` من غير أي تحقق هوية — أي حد يعمل أي حساب لأي tenant | `api/create-user.js` | ✅ محتاج الآن Firebase ID token + دور admin/super-admin + نفس الـ tenant |
| 4 | `/api/delete-user` من غير أي تحقق هوية — أي حد يحذف أي مستخدم | `api/delete-user.js` | ✅ نفس الحماية + منع حذف الحساب الشخصي عبر الـ endpoint ده |
| 5 | Stripe webhook بيتجاهل التحقق من التوقيع لو الـ secret مش موجود | `api/stripe-webhook.js` | ✅ بقى Fail-closed: يرفض الطلب بدل ما يصدّقه |
| 6 | ترقية مجانية لأي tenant عبر URL يدوي (`mock_payment=true`) بيكتب مباشرة في Firestore من الـ client | `api/stripe-checkout.js`, `pages.js` | ✅ الـ mock اتقفل في production، والكتابة المباشرة من الـ client اتشالت بالكامل |
| 7 | تحديث رصيد المخزون بدون transaction وبدون تحقق من توفر الكمية (race condition + سالب) | `db.js` (`updateProductStock`) | ✅ بقى Firestore transaction مع فحص الرصيد ومنع السالب |
| 8 | قاعدة `users` بتسمح لأي "admin" (من أي tenant) يعدّل مستخدمي tenant تاني | `firestore.rules` | ✅ اتقيّدت بنفس الـ tenant، وبمنع ترقية أي حد لـ super-admin عبر write عادي |
| 9 | tenant قادر يعدّل `plan`/`status` بتاعه بنفسه من الـ client | `firestore.rules` | ✅ الحقلين دول بقوا read-only من ناحية الـ client، السيرفر (Admin SDK) بس اللي يقدر يغيرهم |

## لسه ناقص — أولوية عالية قبل أي إطلاق حقيقي

1. **سكربت bootstrap آمن لأول super-admin**: لازم يتكتب `scripts/create-superadmin.js` — سكربت server-side بيتشغل مرة واحدة يدويًا، بياخد الباسورد من متغير بيئة أو يولّد باسورد عشوائي قوي، وينشئ الحساب عبر Firebase Auth مباشرة (مش عبر Firestore وليس plaintext).
2. **نقل منطق خصم المخزون بالكامل لـ Cloud Function**: التصليح الحالي (transaction) بيمنع الـ race condition، لكنه لسه شغال في المتصفح، يعني مستخدم خبيث يقدر يفتح Developer Console ويستدعي الدالة بقيم مختلفة (رغم إن الـ transaction والفحص هيمنعوا نتائج غير منطقية، بس التحقق من الصلاحيات نفسه لازم ينتقل للسيرفر).
3. **مراجعة عملية البيع (POS checkout) بالكامل لتبقى atomic**: لو فشلت الفاتورة في نص عملية خصم المخزون لأصناف متعددة، مفيش rollback حاليًا — محتاجة تتحول لعملية واحدة ذرية (الأفضل Cloud Function).
4. **مراجعة أمنية شاملة لباقي الـ API endpoints** (مش بس create/delete-user) للتأكد من وجود نفس نمط التحقق من الهوية والصلاحية.
5. **قرار معماري نهائي**: هل نكمل مع Firestore (وقتها الخطوات فوق ضرورية)، ولا نرجع للمواصفات الأصلية (Next.js + Prisma + PostgreSQL)؟
