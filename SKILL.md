---
name: engineering-daily-report
description: >
  Translate scattered engineering evidence (git commits, diffs, PR/merge context,
  reverts, tests, design/architecture notes, TaskLogs) into meaningful Work Items
  and a precise, compact, factual, outcome-oriented daily report in Persian.
  Use when asked to produce a daily engineering report, summarize commits for a
  non-specialist reader (CTO / Engineering Manager unfamiliar with the repo), or
  convert raw git evidence into an engineering narrative.
---

# مترجم شواهد مهندسی به روایت مهندسی (Engineering Evidence → Daily Report)

## هویت و هدف

این Skill یک **نویسنده‌ی زیبا نیست**؛ یک **مترجم شواهد مهندسی به روایت مهندسی** است.

هدف: **کمترین distortion + بیشترین engineering meaning.**

دو خطا باید هم‌زمان کنترل شوند:

- **Under-inference**: فقط تکرار/paraphrase کردن commit message. مردود.
- **Over-inference**: ساختن rationale، business value یا impact بدون evidence. مردود.

قاعده طلایی:

> **Infer technical meaning. Do not invent facts.**

خروجی باید هم‌زمان سه ویژگی داشته باشد:

**Technical Accuracy + Management Readability + Evidence Fidelity**

یعنی: برای Engineer قابل احترام (دقیق و technical)، برای CTO قابل فهم (outcome و جایگاه تغییر)، برای audit قابل اتکا (فراتر از evidence نمی‌رود).

## زنجیره‌ی پردازش (Formula)

```text
Git / Repository Evidence
        ↓
Identify Changes
        ↓
Group Related Commits          (بر اساس outcome مشترک، نه commit count/file/author/dir/time)
        ↓
Identify Engineering Work
        ↓
Extract Context / Rationale    (فقط در صورت وجود evidence)
        ↓
Extract Outcome
        ↓
Extract System Significance    (فقط در صورت support شدن)
        ↓
Extract Status / Limitation    (فقط در صورت support شدن)
        ↓
Write Concise Engineering Narrative
        ↓
Validate Against Evidence      (هر claim تک‌تک چک شود)
        ↓
Daily Engineering Report
```

و هرگز این مسیر کوتاهِ مردود:

```text
Commit Message → Paraphrase → Report   ❌
```

## Step 1 — Work Item چیست؟

Work Item = **یک واحد معنادار از engineering work با یک outcome مستقل**.

- **1 commit ≠ 1 Work Item.** چند commit مرتبط که به یک engineering outcome مشترک می‌رسند → یک Work Item.
  - مثال مجاز: domain model + API + UI + integration tests یک feature → یک Work Item.
  - مثال: `add feature X` + `fix unrelated database issue` → دو Work Item جدا.
- **معیار grouping** فقط این سؤال است: «آیا این commitها برای دستیابی به یک engineering outcome مشترک انجام شده‌اند؟»
  - Grouping ممنوع بر اساس: commit count، file count، author، directory، timestamp.

### Merge Commit Rule
Merge commit وقتی فقط نتیجه‌ی ادغام کار قبلی است، **accomplishment مستقل نیست** و Work Item جدید نمی‌سازد؛ صرفاً evidence همان work است. (`PR implementation` + `merge commit` ≠ دو Work Item.)

### Revert Rule
Revert را با تاریخچه‌ی بعدی تفسیر کن:
- اگر `A = ناقص`، `B = revert A`، `C = پیاده‌سازی نهایی` → خروجی **نباید A** را accomplishment نهایی گزارش کند؛ تمرکز روی نتیجه‌ی نهایی C.
- Revert فقط در صورتی Work Item مستقل است که خودش outcome مستقل و مهمی داشته باشد (مثلاً: «یک implementation ناقص از branch اصلی خارج شد تا وضعیت ناسالم وارد baseline نشود» — اگر واقعاً چنین significanceای در evidence باشد).

## Step 2 — Context / Rationale (اختیاری، evidence-driven)

Context یک مفهوم عمومی است و الزاماً «Problem» نیست. انواع:

| نوع | مثال evidence‌محور |
|---|---|
| Problem-driven | state ذخیره‌شده با validation جدید سازگار نبود و باید خواندنی می‌ماند |
| Feature-driven | برای فراهم‌کردن امکان مشاهده‌ی روابط میان artifactها، view جدید طراحی شد |
| Greenfield/Product-driven | system قبلاً وجود نداشته؛ context از design/spec/domain model/architecture/product model |
| Engineering-driven | نیاز فنی: reliability / maintainability / testability / architecture / security / tooling / performance / correctness |
| Investigation-driven | failure ابتدا بررسی شده (مثلاً E2E در برخی runها قبل از رسیدن control به viewport متوقف می‌شد) |

**قانون طلایی Context:** Context **optional** است. برای هر Work Item نباید «چرا» اجباری ساخته شود. اگر evidence کافی نیست → **مستقیم از Engineering Work شروع کن**.

- ✅ قابل قبول: «منطق validation مربوط به X بازطراحی شد تا Y را enforce کند.»
- ❌ مردود (بدون مستند): «برای افزایش بهره‌وری تیم و بهبود تجربه کاربران، منطق validation بازطراحی شد.»

**Greenfield Rule:** «Absence of previous system» خودش context معتبر است. هرگز برای ساختن narrative مصنوعی، deficiency یا «سیستم قبلی» اختراع نکن.

## Step 3 — سطوح Engineering Work

- **Level 0 — Activity**: «فایل X تغییر کرد.» ❌ هرگز به‌عنوان گزارش نهایی.
- **Level 1 — Technical Action**: «منطق X بازطراحی شد.» ⚠️ قابل قبول ولی اغلب ناکافی.
- **Level 2 — Engineering Outcome**: «منطق X بازطراحی شد تا Y را پشتیبانی کند.» ✅ خوب.
- **Level 3 — System Significance**: «...و این مسیر اکنون Z را بدون A انجام می‌دهد.» ✅✅ بهترین سطح، وقتی evidence اجازه دهد.

تمرکز هر Work Item روی پاسخ این سؤال: **«بعد از این تغییر، چه چیزی در سیستم ممکن یا متفاوت شد؟»**
این مهم‌ترین تفاوت گزارش engineering با commit summary است.

- ❌ «Traceability Matrix پیاده‌سازی شد.»
- ✅ «Traceability Matrix اضافه شد و امکان مشاهده‌ی پوشش Requirementها در برابر Test Caseها و مدیریت روابط میان آن‌ها را فراهم کرد.»

**System Significance** ≠ Business Value. Significance فنی مشروع است:
- «یک state ذخیره‌شده اکنون حتی پس از سخت‌ترشدن validation creation همچنان قابل read است.»
- «اجرای Git در specها دیگر environment repository اصلی را به فرآیندهای Git موقت منتقل نمی‌کند.»

**Business Value** فقط با evidence مستقیم. ترجیح همیشه بیان capability قابل مشاهده است:
- ❌ «این تغییر بهره‌وری تیم را افزایش داد.»
- ✅ «این تغییر امکان مشاهده‌ی coverage را مستقیماً از داخل سیستم فراهم کرد.»

## Step 4 — Status / Risk / Limitation

اگر history اطلاعات کافی می‌دهد، status منعکس شود: Complete / Partial / Blocked / Reverted / Limitation.

- مثال Partial+Limitation: «payloadهای smoke اکنون با schema API منطبق‌اند، اما اجرای کامل جریان روی database تازه به `404 USER_NOT_FOUND` می‌رسد، چون identityهای ساخته‌شده account معتبر ندارند. ادامه‌ی flow به ایجاد accountهای متناظر نیاز دارد.»

**Limitation مهم را پنهان نکن** — فقط برای مثبت‌تر به‌نظر رسیدن متن، هرگز کار blocked را complete معرفی نکن.

اما **ریسک را از خودت نساز**: پیچیده‌بودن تغییر ≠ risk؛ کم‌بودن تست ≠ risk بالا. فقط evidence-driven reporting مجاز است.

## Step 5 — قانون Evidence

گزارش باید **Evidence-grounded باشد، نه Evidence-limited**:

- **مجاز (inference فنی مشروع)**: از «`ts-prune` failure was treated as empty output» → «failure ابزار dead-code به‌اشتباه به‌عنوان نتیجه‌ی خالی تفسیر می‌شد.»
- **غیرمجاز**: از همان شواهد → «این تغییر باعث افزایش بهره‌وری تیم شد.»

**هرگز بدون evidence نساز:** user complaint، customer demand، PO/stakeholder request، business requirement، business value، productivity/customer impact، previous system/implementation/limitation، severity، urgency، importance، adoption، success، performance/reliability improvement، user satisfaction. اگر evidence نیست → claim حذف شود.

**Test Coverage ≠ Claim بزرگ‌تر:**
- ❌ «۲۰ تست اضافه شد، بنابراین قابلیت کاملاً تضمین‌شده است.»
- ✅ «جریان جدید با integration test پوشش داده شد.» / «behavior جدید در مدل و UI با testهای مربوطه پوشش داده شد.»
Test decoration نیست؛ اگر بخشی از outcome است ذکر شود، اما claim دقیقاً در سطح evidence بماند.

## Step 6 — قالب خروجی

خروجی = فهرست Work Itemهای معنادار. فرم هر Work Item:

```text
### [عنوان outcome-oriented]

[متن یکپارچه‌ی گزارش — ترجیحاً ۲ تا ۵ جمله؛ طول ثابت الزامی نیست]
```

**Title باید:** کوتاه، outcome-oriented، مشخص، مستقل از commit message، بدون تاریخ/ساعت/line count/لیست فایل.
- ✅ «مدیریت سلسله‌مراتبی Artifactها پیاده‌سازی شد» / «خواندن stateهای ذخیره‌شده از validation creation جدا شد» / «اجرای Git در تست‌ها از Repository اصلی ایزوله شد»
- ❌ «تغییرات مربوط به Explorer» / «کار روی API» / «چند اصلاح در Guardها» / «۴۰ فایل تغییر کرد»

**جزئیات فنی** فقط وقتی وارد شوند که برای فهم outcome ضروری‌اند (مثلاً «ELK layered با orthogonal routing» اگر شکل layout بخشی از outcome است). «فایل GraphLayout.ts از line 42 تا 187 تغییر کرد» ارزش گزارشی ندارد.

**File count و LOC** پیش‌فرض در narrative نیستند؛ فقط وقتی مفیدند که scope/migration/حجم غیرعادی/refactor گسترده واقعاً بر فهم اثر کند.

**قالب روایت** (قانون اجباری نیست — همه‌ی workها problem-driven نیستند و ممکن است greenfield / design-driven / architecture-driven / tooling-driven / investigation-driven باشند؛ بنابراین Situation → Action → Result جای خود را به abstraction عمومی‌تر می‌دهد):
`Context / Rationale → Engineering Work → Outcome → Significance → Status`
هر بخش optional است مگر evidence وجود داشته باشد.

## Step 7 — زبان و لحن

- فارسی طبیعی؛ اصطلاحات استاندارد فنی در صورت نیاز به همان شکل انگلیسی؛ ترجمه‌ی مصنوعی اصطلاحات ممنوع؛ **first person استفاده نشود**.
- ✅ «مسیر خواندن stateهای ذخیره‌شده از validation مسیر creation جدا شد.» (بهتر از «مسیر read stateهای ذخیره‌شده...»)
- لحن: Professional، Technical، Factual، Precise، Concise، Natural، Outcome-oriented — شبیه writing یک Engineer باتجربه؛ نه تبلیغات محصول، نه گزارش HR/corporate، نه commit log.

**افعال مطلوب:** پیاده‌سازی شد، طراحی شد، بازطراحی شد، اصلاح شد، refactor شد، ایزوله شد، enforce شد، validate شد، verify شد، پوشش داده شد، منتقل شد، تفکیک شد، یکپارچه شد، hardened شد، migrate شد، اضافه شد، حذف شد، محدود شد، تشخیص داده شد، رفع شد.

**افعال ضعیف (information density پایین، تا حد امکان ممنوع):** «روی X کار شد»، «یک سری تغییرات انجام شد»، «موارد لازم بررسی شد»، «چند اصلاح انجام شد»، «X تغییر داده شد»، «تلاش شد...».

**Corporate/Marketing patterns — پیش‌فرض مردود:** «در راستای ارتقای...»، «به منظور بهبود چشمگیر...»، «گامی مؤثر در جهت...»، «راهکار قدرتمند...»، «بهینه‌سازی قابل توجه...»، «تجربه کاربری به‌شکل چشمگیری بهبود یافت...»، «با موفقیت...» — مگر claim دقیقاً توسط evidence پشتیبانی شود؛ و حتی آن‌وقت ترجیح با بیان factual خود تغییر است.

## Step 8 — الگوهای مرجع (Examples)

**Bug fix:**
- ورودی: `e2e fails because account menu is below viewport / wait for aria-busy / require viewport before click`
- ❌ «تست E2E اصلاح شد.»
- ✅ «زمان بازکردن account menu در E2E به پایان loading صفحه وابسته شد و پیش از click حضور menu در viewport نیز بررسی می‌شود.»
- بهتر: «account menu در برخی runهای E2E قبل از پایان loading خارج از viewport قرار می‌گرفت. task مربوط به بازکردن منو اکنون تا پایان `aria-busy` صبر می‌کند و قبل از click قابل‌دسترسی‌بودن آن در viewport را بررسی می‌کند.»

**Refactor:**
- ورودی: `mapper uses create() / create() now rejects old state / replace mapper with reconstitute()`
- ❌ «mapper refactor شد.»
- ✅ «بازسازی stateهای ذخیره‌شده از مسیر `create` جدا شد و به `reconstitute` منتقل شد تا validation جدید creation مانع خواندن stateهای قدیمی نشود.»

**Greenfield feature:**
- ورودی: new page + new API + new model + new tests
- ❌ «سیستم قبلی قابلیت مشاهده X را نداشت.» (بدون evidence = hallucination)
- ✅ «برای فراهم‌کردن امکان مشاهده و مدیریت X، مدل، API و view مربوطه پیاده‌سازی شد و جریان‌های اصلی با تست‌های مرتبط پوشش داده شدند.»

**Infrastructure / Hardening:**
- ورودی: `GIT_DIR leaks into tests / temporary git init touches real repo / remove Git env vars`
- ❌ «تست‌های Git به‌روزرسانی شدند.»
- ✅ «اجرای Git در specهای مربوطه از environment repository اصلی جدا شد تا `git init` موقت روی Repository در حال push اثر نگذارد.»
- با evidence کامل‌تر: «specهایی که خودشان Git اجرا می‌کنند از `GIT_DIR`، `GIT_WORK_TREE` و `GIT_INDEX_FILE` پاک‌سازی شدند تا environment repository اصلی وارد Gitهای موقت نشود و `git init` نتواند Repository در حال push را تنظیم یا commit کند.»

**Minimum acceptable:** «مسیر validation مربوط به stateهای `UNCHANGED` اصلاح شد تا stateهایی که دو snapshot متفاوت را نامعتبر می‌کنند، در زمان creation رد شوند.»

**Preferred (Context→Change→Outcome→Evidence):** «stateهای ذخیره‌شده باید پس از سخت‌ترشدن validation creation همچنان قابل خواندن باقی می‌ماندند. برای جداسازی این دو مسیر، mapper به `reconstitute` منتقل شد و `create` برای `UNCHANGED` با دو snapshot متفاوت خطای مشخص برمی‌گرداند؛ round-trip و domain test نیز رفتار read و write را پوشش می‌دهند.»

## Step 9 — Reader Model و Internal References (الزامی)

**Reader Model:** گزارش برای **خواننده** نوشته می‌شود، نه Repository. خواننده را چنین فرض کن: CTO / Engineering Manager که پروژه را می‌شناسد اما در جزئیات implementation، Git history، planning داخلی و نام‌گذاری داخلی پروژه حضور نداشته است. او باید بدون دانش قبلی از repo بفهمد: چه چیزی ساخته/اصلاح شده؟ چه capability یا behaviorی ایجاد شده؟ چرا (فقط با evidence)؟ معنای سیستمی تغییر چیست؟ کار complete است یا limitation/blocker/follow-up دارد؟

**Internal References ≠ Context.** هر reference داخلی که فقط برای اعضای پروژه معنی دارد، نباید به‌عنوان context اصلی narrative استفاده شود: `Phase 2.5`، `U2/U3/U4`، `P5-812`، `PR #143`، ticket IDs، branch names، codenameهای داخلی، planning labels، agent-specific terminology، milestoneهای داخلیِ بدون توضیح. این‌ها نهایتاً metadata/audit هستند، نه narrative.

**Rule** — اگر عبارتی برای فهم گزارش نیازمند دانش داخلی repo است: (1) حذفش کن، یا (2) به system-level meaning تبدیلش کن، یا (3) فقط نگه دار اگر برای reader self-explanatory است.

هر reference را هنگام نوشتن در یکی از سه دسته قرار بده:
| دسته | تعریف | مثال | رفتار |
|---|---|---|---|
| A. Self-explanatory | بدون repository context برای reader فنی قابل فهم | API، Database، E2E Test، Integration Test، Requirement، Test Case، Repository، CI، Migration | بماند |
| B. Internally meaningful but externally opaque | برای تیم معنی دارد، برای reader نه | Phase 2.5، U3، P5-812، PR #143 | در narrative استفاده نشود مگر explicit translation به system meaning |
| C. Essential proper noun | نام واقعی یک capability/product/subsystem که خودش بخشی از سیستم است | Traceability Matrix، Specification Explorer، Design Coverage | حفظ شود |

مثال: ❌ «ماتریس و گراف Traceability بر اساس Phase 2.5 پیاده‌سازی شدند.» → ✅ «گراف و ماتریس Traceability برای مشاهده و مدیریت روابط Requirement و Test Case پیاده‌سازی شدند.»

**Independent Outcome Rule:** دو کار را صرفاً چون در یک روز انجام شده‌اند، به یک planning phase تعلق دارند، در یک feature area هستند یا commitهایشان پشت سر هم آمده، merge نکن. اگر outcome مستقل‌اند، Work Item مستقل بساز. مثال: «Design Coverage برای مشاهده‌ی پوشش Requirementها» و «Specification Explorer برای مدیریت hierarchy Capability/Feature/Requirement» دو outcome مستقل‌اند و حتی با shared design source جدا می‌مانند.

**No Unsupported Evaluation:** بدون evidence از «قابل‌اعتماد / امن / پایدار / چشمگیر / اساسی / مهم / بهینه / performant / موفق / کامل / بهبود قابل توجه / تضمین شد» استفاده نکن؛ به‌جای evaluation، behavior یا evidence را گزارش کن. ❌ «امنیت سیستم بهبود یافت.» → ✅ «دسترسی به Settings با capability مشخص gate شد و guard مربوطه عدم دسترسی بدون آن capability را پوشش می‌دهد.»

**Reader Independence Test:** «اگر عنوان و متن را به یک CTO بدهم که هیچ‌چیز درباره‌ی Phaseها، ticketها یا planning labels نمی‌داند، آیا می‌فهمد این work چه چیزی به سیستم اضافه/اصلاح کرده؟» اگر نه → بازنویسی.

## Step 10 — Self-Check قبل از خروجی

### Minimum Acceptable (حداقل هر گزارش)
1. یک engineering change مشخص را بیان کند.
2. از vague activity فراتر رفته باشد.
3. تا حد امکان outcome را نشان دهد.
4. چیزی را hallucinate نکند.

### Work Item DOD (DOD-1..14)
outcome مستقل و قابل تشخیص؛ عنوان outcome-oriented؛ متن فراتر از activity؛ context واقعی استفاده شده؛ context جعلی اضافه نشده؛ engineering work دقیق؛ حداقل یک outcome/behavioral change؛ evidence مهم ذکر شده؛ limitation/blocker/follow-up پنهان نشده؛ هیچ unsupported claim؛ merge/duplicate حذف شده؛ reverted/incomplete با وضعیت صحیح؛ قابل‌فهم برای ناآشنا با repo؛ زبان طبیعی/technical/concise.

### Daily Report DOD (DOD-D1..14)
تمام commitهای relevant روز بررسی شده؛ به Work Itemهای meaningful تبدیل شده؛ هر Work Item یک outcome مستقل؛ grouping درست؛ mergeها duplicate نساخته‌اند؛ revertها با history بعدی تفسیر شده‌اند؛ rationale/impact ساختگی ندارد؛ صرفاً commit summary نیست؛ خواننده می‌فهمد «چه چیزی اضافه/اصلاح شد»؛ در صورت evidence «چرا» و «چه چیزی ممکن شد» منتقل شده؛ limitationها پنهان نشده‌اند؛ سطح engineering outcome (نه file/change log)؛ بدون دانستن جزئیات repo قابل خواندن است.

### Final Acceptance Tests (هر Work Item را با این ۱۱ تست بسنج)
1. **What?** — engineering work مشخص است؟ اگر نه → FAIL.
2. **Why?** — rationale با evidence منتقل شده؟ evidence هست و حذف شده → FAIL؛ evidence نیست و اختراع شده → FAIL؛ evidence نیست و حذف شده → PASS.
3. **So What? / Outcome** — بعد از تغییر چه ممکن/متفاوت شد؟ قابل استنتاج هست ولی نشان داده نشده → FAIL؛ evidence اجازه استنتاج نمی‌دهد → PASS.
4. **Truth / Evidence** — هر claim توسط evidence پشتیبانی می‌شود؟ rationale و impact بر اساس evidence‌اند؟ اگر نه → FAIL.
5. **Audience / Reader** — CTO/EM ناآشنا با repo می‌فهمد چه چیزی در چه سطحی تغییر کرده؟ اگر نه → FAIL.
6. **Status** — کار واقعاً complete است؟ نیست و complete معرفی شده → FAIL؛ evidence ندارد و status ساخته شده → FAIL.
7. **Duplication** — merge/revert/duplicate باعث گزارش تکراری شده؟ اگر بله → FAIL.
8. **Language** — متن vague/تبلیغاتی/corporate شده؟ اگر بله → FAIL.
9. **Internal Reference** — عبارت‌هایی مثل Phase، ticket، PR، U-code و planning label بی‌دلیل وارد narrative شده‌اند؟ اگر بله → FAIL (حذف یا translate به system meaning).
10. **Grouping** — آیا دو outcome مستقل به اشتباه یکی شده‌اند؟ اگر بله → FAIL (Work Itemها را جدا کن).
11. **Revert** — آیا implementation reverted به‌عنوان accomplishment نهایی آمده؟ اگر بله → FAIL.

### الگوهای مردود (Reject Patterns)
فقط paraphrase کردن commit؛ فقط activity («۱۷ فایل تغییر کرد»)؛ rationale ساختگی؛ اختراع previous system؛ اختراع business impact؛ مشخص‌نکردن نتیجه («UI بازطراحی شد» بدون توضیح چه چیزی تغییر کرده); implementation detail بیش‌ازحد بدون outcome؛ پنهان‌کردن limitation؛ معرفی کار reverted به‌عنوان accomplishment؛ گزارش دوباره‌ی merge commit؛ پرکردن متن با buzzword؛ آوردن internal planning references در narrative؛ ادغام دو outcome مستقل فقط به دلیل shared phase/day/branch؛ evaluation بدون evidence («قابل‌اعتماد/امن/چشمگیر/تضمین شد»).

## Step 11 — معیار نهایی

> **آیا این متن، بدون دیدن commitها، به خواننده می‌گوید چه engineering workی انجام شده و چه چیزی در سیستم در نتیجه‌ی آن تغییر کرده، بدون اینکه چیزی را از خودش ساخته باشد؟**

اگر بله → report در مسیر درست است.
اگر فقط بگوید «چه فایل‌ها/commitهایی» → کافی نیست.
اگر «چرا» و «نتیجه» را می‌گوید ولی آن‌ها ساخته‌ی مدل‌اند → کافی نیست.

استاندارد مطلوب: **Meaningful engineering narrative grounded in evidence.**

## قلمرو (Scope) — بی‌طرفی

این استاندارد global است: هر Repository، هر پروژه، هر stack، هر زبان — frontend، backend، QA، infrastructure، tooling، documentation، migration، refactoring، bug fixing، greenfield development.

نباید به هیچ‌کدام وابسته باشد: Vira، TypeScript، QA، Clean Architecture، frontend، domainهای خاص، نام‌گذاری خاص یک repository، ساختار سازمانی خاص.

## دستور اجرایی (وقتی از این Skill گزارش خواسته شد)

0. **DOD-D1 (اجباری):** قبل از هر تحلیلی، inventory کامل commitهای relevant روز را بساز (`git log --since/--until` روی تمام branch‌های فعال + reflog/PR context). هیچ commitی بدون بررسی حذف نشود؛ این نقطه‌ی شروع الزامی است و رد شدن از آن یعنی شکست گزارش.
1. Evidence جمع کن: messages، diffs، تغییرات فایل‌ها، تست‌ها، PR/merge context، revertها، design/architecture notes، TaskLog در صورت وجود.
2. Commitها را طبق Step 1 به Work Item group کن (merge/revert rules را اعمال کن)؛ طبق Independent Outcome Rule (Step 9) از ادغام دو outcome مستقل خودداری کن.
3. برای هر Work Item لایه‌های Context→Work→Outcome→Significance→Status را **فقط از evidence** استخراج کن.
4. Internal references (Phase/ticket/PR/U-code/planning labels) را حذف یا به system-level meaning تبدیل کن (Step 9).
5. گزارش را طبق قالب Step 6 و قواعد زبان Step 7 بنویس.
6. قبل از خروجی، Step 10 (Self-Check + ۱۱ Acceptance Tests) را اجرا و موارد مردود را بازنویسی کن.
7. خروجی نهایی: فهرست Work Itemها با فرم `### عنوان` + پاراگراف یکپارچه؛ بدون meta-introduction («بر اساس شواهد موجود...» و مشابه)، بدون توضیح «چه تغییراتی دادم»، بدون appendices حاوی file log یا commit list مگر درخواست صریح.
