<div dir="rtl">

# تعليمات Git

## الفهرس

- [الأوامر الأساسية](#الأوامر-الأساسية)
- [المقارنة بين commits](#المقارنة-بين-commits)
- [إعادة التعيين والاستعادة](#إعادة-التعيين-والاستعادة)
- [بداية جديدة](#بداية-جديدة)
- [قواعد .gitignore](#قواعد-gitignore)
- [إعدادات .gitattributes](#إعدادات-gitattributes)
- [التحقق من حالة Git](#التحقق-من-حالة-git)
- [معرفة بيانات Git](#معرفة-بيانات-git)
- [إصلاح مشاكل Git](#إصلاح-مشاكل-git)
- [مشاكل شائعة](#مشاكل-شائعة)

## الأوامر الأساسية

### تهيئة Git

```powershell
git init
```

### استرجاع الملفات المحذوفة

```powershell
# استرجاع ملف واحد محدد
git checkout HEAD -- path/to/file.txt

# استرجاع جميع الملفات المحذوفة دفعة واحدة
git checkout .
# أو
git restore .

# استرجاع ملف من commit سابق
git checkout <commit_id> -- path/to/file.txt
```

### حذف الملفات من Git

```powershell
# حذف ملف من Git مع الاحتفاظ به محلياً
git rm --cached <file>

# حذف ملف من Git وحذفه محلياً
git rm <file>

# حذف مجلد من Git مع الاحتفاظ به محلياً
git rm -r --cached <folder>

# حذف ملفات متعددة
git rm file1.py file2.py file3.py
```

### إضافة الملفات

```powershell
# إضافة الملفات الجديدة والمعدلة فقط
git add .

# إضافة جميع التغييرات (جديدة، معدلة، محذوفة)
git add -A

# إعادة توحيد line endings (بعد تغييرات .gitattributes)
git add --renormalize .
```

### حفظ التغييرات

```powershell
git commit -m "رسالة الحفظ"
```

### فحص الحالة

```powershell
git status
```

### عرض سجل الـ commits

```powershell
git log
git log --oneline
```

### عرض تفاصيل الـ commit

```powershell
git show HEAD
git show HEAD --stat
```

### المقارنة بين commits

```powershell
# مقارنة آخر commit مع الملفات الحالية
git diff HEAD

# مقارنة بين commitين محددين
git diff <commit-hash-1> <commit-hash-2>

# مقارنة آخر commit مع commit سابق
git diff HEAD~1 HEAD

# عرض التغييرات في staging area
git diff --staged

# عرض التغييرات غير المضافة
git diff

# عرض ملخص التغييرات
git diff --stat
git diff HEAD~1 HEAD --stat

# عرض سجل commits مع التغييرات
git log -p
git log -p -2  # آخر 2 commits
```

## إعادة التعيين والاستعادة

### إعادة تعيين إلى آخر commit (إلغاء جميع التغييرات)

```powershell
git reset --hard HEAD
```

### إلغاء آخر commit (الاحتفاظ بالتغييرات)

```powershell
git reset --soft HEAD~1
```

### إلغاء آخر commit (حذف التغييرات)

```powershell
git reset --hard HEAD~1
```

### حذف commit محدد (ليس الأخير)

```powershell
# العودة إلى commit قبل المراد حذفه
git reset --hard <commit-hash-before>

# أو استخدام rebase (متقدم)
git rebase -i <commit-hash-before>
```

### حذف commit من السجل بالكامل (خطر)

```powershell
git filter-branch --tree-filter 'rm -f <file>' HEAD
```

**ملاحظات:**

- `--soft` يحتفظ بالتغييرات في staging area
- `--hard` يحذف التغييرات نهائياً
- حذف commit من السجل يغير التاريخ — لا تفعله إذا تم دفع (push) للسيرفر

### عرض commit سابق (للقراءة فقط)

```powershell
git checkout <commit-hash>
```

### العودة إلى master

```powershell
git checkout master
```

## بداية جديدة

### حذف Git والبدء من جديد

```powershell
Remove-Item -Recurse -Force .git
git init
git add -A
git commit -m "Initial commit"
```

## قواعد .gitignore

### الصياغة

- `*` — يطابق أي حرف/أحرف
- `?` — يطابق حرف واحد
- `**/` — يطابق أي مجلد فرعي
- `/` في البداية — يطابق من الجذر فقط
- `!` — استثناء (لا تتجاهل)

### أمثلة

```gitignore
# تجاهل جميع الملفات في المجلد
folder/*

# تجاهل المجلد بالكامل
folder/

# تجاهل الكل ما عدا ملفات JSON
folder/*
!folder/**/*.json
```

## .gitattributes

### الغرض

- توحيد line endings (LF vs CRLF)
- تعريف أنواع الملفات (نصية vs ثنائية)

### تطبيق التغييرات

```powershell
git add --renormalize .
git commit -m "Normalize line endings"
```

## مشاكل شائعة

### تحذيرات CRLF

- الحل: إضافة ملف `.gitattributes`
- تشغيل `git add --renormalize .`

### ملفات غير متجاهلة

- تحقق من صياغة `.gitignore`
- تأكد أن الملف غير متتبع مسبقاً (`git rm --cached <file>`)

### ملفات كبيرة في السجل

- استخدام `git filter-branch` أو BFG Repo-Cleaner (متقدم)

## التحقق من حالة Git

### التحقق من أن Git يعمل للمشروع

```powershell
# التحقق من أن المجلد هو Git repository
git status

# عرض معلومات Git
git info

# عرض الإعدادات
git config --list

# عرض جميع الملفات المتتبعة
git ls-files
```

### التحقق من الاتصال بالسيرفر (إذا كان هناك remote)

```powershell
# عرض الـ remotes
git remote -v

# التحقق من الاتصال
git remote show origin
```

## معرفة بيانات Git

### عرض الإيميل والاسم

```powershell
# إيميل Git للمشروع الحالي
git config user.email

# اسم Git للمشروع الحالي
git config user.name

# الإيميل العام (global)
git config --global user.email

# الاسم العام (global)
git config --global user.name

# عرض جميع الإعدادات
git config --list
```

### تعيين الإيميل والاسم

```powershell
# تعيين عام (لكل المشاريع)
git config --global user.email "your-email@example.com"
git config --global user.name "Your Name"

# تعيين خاص بالمشروع الحالي فقط
git config user.email "project-email@example.com"
git config user.name "Project Name"
```

**ملاحظة:** إذا لم يُعرض الإيميل عند تشغيل `git config user.email`، فهذا يعني أن Git لم يُضبط بعد.

## إصلاح مشاكل Git

### إعادة تعيين الفهرس (index)

```powershell
git reset
```

### تنظيف الملفات غير المتتبعة

```powershell
git clean -fd
```

### إعادة تعيين Git بالكامل (آخر حل)

```powershell
Remove-Item -Recurse -Force .git
git init
git add -A
git commit -m "Reset Git"
```

### إعادة تثبيت Git (إذا كان Git نفسه معطلاً)

```powershell
winget install Git.Git
```

</div>
