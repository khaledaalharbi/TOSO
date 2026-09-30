<div dir="rtl">

# 🐍 دليل أوامر Python و pip والبيئات الافتراضية (macOS)

**نظام التشغيل:** macOS (Sonoma / Ventura / Monterey) — Terminal / Zsh
**آخر تحديث:** 2026-03-18

---

## 📑 فهرس المحتويات

1. [التحقق من الإصدارات](#1-التحقق-من-الإصدارات)
2. [إدارة الحزم (pip)](#2-إدارة-الحزم-pip)
3. [إدارة البيئة الافتراضية (venv)](#3-إدارة-البيئة-الافتراضية-venv)
4. [تنظيف الملفات المؤقتة](#4-تنظيف-الملفات-المؤقتة)
5. [إدارة العمليات](#5-إدارة-العمليات)
6. [إعدادات VS Code](#6-إعدادات-vs-code)
7. [سيناريوهات عملية](#7-سيناريوهات-عملية)
8. [استكشاف الأخطاء](#8-استكشاف-الأخطاء)
9. [مرجع سريع](#9-مرجع-سريع)
10. [تثبيت Python على macOS](#10-تثبيت-python-على-macos)

---

## 1. التحقق من الإصدارات

### إصدار Python

```bash
python3 --version
python3 -V
```

> ⚠️ **ملاحظة:** على macOS، استخدم `python3` بدلاً من `python` لأن `python` قد يشير إلى Python 2 القديم.

### إصدار pip

```bash
pip3 --version
pip3 -V
```

### عرض الحزم المثبتة

```bash
pip3 list
pip3 list --outdated
pip3 freeze
```

---

## 2. إدارة الحزم (pip)

### تثبيت وإزالة

```bash
pip3 install <package_name>
pip3 install <package_name>==1.0.0
pip3 uninstall <package_name>
pip3 show <package_name>
```

### تحديث pip نفسه

```bash
python3 -m pip install --upgrade pip
```

### تحديث حزمة محددة

```bash
pip3 install --upgrade <package_name>
```

### تحديث جميع الحزم (Bash/Zsh)

```bash
pip3 list --outdated --format=freeze | cut -d= -f1 | xargs -n1 pip3 install --upgrade
```

### التثبيت من ملف

```bash
pip3 install -r requirements.txt
```

### فحص التوافق

```bash
pip3 check
```

---

## 3. إدارة البيئة الافتراضية (venv)

### 3.1 إنشاء بيئة جديدة

```bash
python3 -m venv .venv
```

لتحديد إصدار معين (إذا كان مثبتاً عبر pyenv):

```bash
pyenv local 3.12.0
python3 -m venv .venv
```

أو بمسار كامل:

```bash
/usr/local/bin/python3.12 -m venv .venv
```

### 3.2 تفعيل البيئة

```bash
source .venv/bin/activate
```

أو الاختصار:

```bash
. .venv/bin/activate
```

### 3.3 إلغاء التفعيل

```bash
deactivate
```

### 3.4 التحقق من البيئة المفعلة

```bash
which python3
python3 -c "import sys; print(sys.executable)"
pip3 list --local
```

### 3.5 تصدير واستيراد الحزم

```bash
# تصدير الحزم المحلية فقط
pip3 freeze --local > requirements.txt

# تصدير جميع الحزم
pip3 freeze > requirements.txt

# تثبيت من الملف
pip3 install -r requirements.txt
```

### 3.6 حذف البيئة بالكامل

```bash
rm -rf .venv
```

---

## 4. تنظيف الملفات المؤقتة

### حذف مجلدات `__pycache__` (Terminal)

```bash
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
```

### حذف ملفات `.pyc`

```bash
find . -type f -name "*.pyc" -delete
```

### حذف عبر سكربت Python

```python
import os, shutil
for root, dirs, files in os.walk('.'):
    for d in dirs:
        if d == '__pycache__':
            shutil.rmtree(os.path.join(root, d), ignore_errors=True)
```

### حذف عبر أداة pyclean

```bash
pip3 install pyclean
pyclean .
```

---

## 5. إدارة العمليات

### عرض عمليات Python الجارية

```bash
ps aux | grep python
```

أو باستخدام pgrep:

```bash
pgrep -fl python
```

### إيقاف جميع عمليات Python

```bash
pkill -f python
```

أو بالقوة:

```bash
pkill -9 -f python
```

### إيقاف عملية محددة بـ PID

```bash
kill -9 <PID>
```

---

## 6. إعدادات VS Code

### فتح المشروع

```bash
code .
```

> إذا لم يعمل الأمر، افتح VS Code → اضغط `Cmd+Shift+P` → اكتب "Shell Command: Install 'code' command in PATH"

### إعداد المفسر (`settings.json`)

```json
{
  "python.defaultInterpreterPath": ".venv/bin/python3",
  "python.terminal.activateEnvironment": true
}
```

---

## 7. سيناريوهات عملية

### بدء مشروع جديد

```bash
python3 -m venv .venv
source .venv/bin/activate
pip3 install flask requests pandas
pip3 freeze > requirements.txt
code .
```

### استنساخ مشروع موجود

```bash
git clone <repo_url>
cd <project_folder>
python3 -m venv .venv
source .venv/bin/activate
pip3 install -r requirements.txt
```

### نسخ احتياطي للبيئة

```bash
pip3 freeze --local > requirements_backup.txt
python3 --version > python_version.txt
pip3 --version > pip_version.txt
```

---

## 8. استكشاف الأخطاء

| المشكلة                     | الحل                                                     |
| --------------------------- | -------------------------------------------------------- |
| pip غير موجود               | `python3 -m ensurepip --upgrade`                         |
| pip قديم                    | `python3 -m pip install --upgrade pip`                   |
| Permission denied           | `pip3 install --user <package>` أو استخدم venv           |
| البيئة غير مفعلة            | `source .venv/bin/activate`                              |
| python3 غير موجود           | `brew install python` أو حمّل من python.org              |
| zsh: command not found: pip | استخدم `pip3` بدلاً من `pip`                             |
| SSL Certificate Error       | `pip3 install --trusted-host pypi.org <package>`         |

---

## 9. مرجع سريع

| المهمة        | الأمر                                                          |
| ------------- | -------------------------------------------------------------- |
| إنشاء بيئة    | `python3 -m venv .venv`                                        |
| تفعيل البيئة  | `source .venv/bin/activate`                                    |
| إلغاء التفعيل | `deactivate`                                                   |
| تثبيت الحزم   | `pip3 install -r requirements.txt`                             |
| تصدير الحزم   | `pip3 freeze > requirements.txt`                               |
| تحديث pip     | `python3 -m pip install --upgrade pip`                         |
| تنظيف cache   | `find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null` |
| إيقاف Python  | `pkill -f python`                                              |

---

## 10. تثبيت Python على macOS

### الطريقة 1: Homebrew (الموصى بها)

```bash
# تثبيت Homebrew إذا لم يكن موجوداً
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# تثبيت Python
brew install python

# التحقق
python3 --version
```

### الطريقة 2: pyenv (لإدارة إصدارات متعددة)

```bash
# تثبيت pyenv
brew install pyenv

# إضافة للـ shell
echo 'eval "$(pyenv init --path)"' >> ~/.zshrc
echo 'eval "$(pyenv init -)"' >> ~/.zshrc
source ~/.zshrc

# تثبيت إصدار معين
pyenv install 3.12.0
pyenv global 3.12.0
```

### الطريقة 3: من الموقع الرسمي

1. حمّل من [python.org](https://www.python.org/downloads/macos/)
2. افتح ملف `.pkg` واتبع التعليمات

---

### ملاحظات مهمة

- **لا ترفع** مجلد `.venv` إلى Git — أضفه في `.gitignore`
- **استخدم `python3` و `pip3`** دائماً على macOS
- **استخدم بيئة افتراضية** منفصلة لكل مشروع
- **فعّل البيئة** دائماً قبل تشغيل أي أمر pip
- **نظّف** مجلدات `__pycache__` بانتظام
- **تجنب `sudo pip`** — استخدم venv أو `--user` بدلاً منه

### نموذج `.gitignore`

```gitignore
.venv/
__pycache__/
*.py[cod]
dist/
build/
.vscode/
.env
.DS_Store
```

### اختصارات مفيدة للـ ~/.zshrc

```bash
# إضافة aliases مفيدة
alias py="python3"
alias pip="pip3"
alias venv="python3 -m venv .venv && source .venv/bin/activate"
alias activate="source .venv/bin/activate"
```

</div>
