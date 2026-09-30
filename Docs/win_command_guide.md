<div dir="rtl">

# 🐍 دليل أوامر Python و pip والبيئات الافتراضية (Windows)

**نظام التشغيل:** Windows 10/11 — PowerShell / CMD
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

---

## 1. التحقق من الإصدارات

### إصدار Python

```powershell
python --version
python -V
py --version
```

### إصدار pip

```powershell
pip --version
pip -V
```

### عرض الحزم المثبتة

```powershell
pip list
pip list --outdated
pip freeze
```

---

## 2. إدارة الحزم (pip)

### تثبيت وإزالة

```powershell
pip install <package_name>
pip install <package_name>==1.0.0
pip uninstall <package_name>
pip show <package_name>
```

### تحديث pip نفسه

```powershell
python -m pip install --upgrade pip
```

### تحديث حزمة محددة

```powershell
pip install --upgrade <package_name>
```

### تحديث جميع الحزم (PowerShell)

```powershell
pip list --outdated --format=freeze | %{$_.split('==')[0]} | %{pip install --upgrade $_}
```

### التثبيت من ملف

```powershell
pip install -r requirements.txt
```

### فحص التوافق

```powershell
pip check
```

---

## 3. إدارة البيئة الافتراضية (venv)

### 3.1 إنشاء بيئة جديدة

```powershell
python -m venv .venv
```

```powershell
py -m venv .venv
```

لتحديد إصدار معين:

```powershell
py -3.12 -m venv .venv
```

أو بمسار كامل:

```powershell
& "C:\Python312\python.exe" -m venv .venv
```

### 3.2 تفعيل البيئة

**PowerShell:**

```powershell
.venv\Scripts\Activate.ps1
```

في حال ظهور خطأ Execution Policy:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.venv\Scripts\Activate.ps1
```

**CMD:**

```cmd
.venv\Scripts\activate.bat
```

### 3.3 إلغاء التفعيل

```powershell
deactivate
```

### 3.4 التحقق من البيئة المفعلة

```powershell
where python
python -c "import sys; print(sys.executable)"
pip list --local
```

### 3.5 تصدير واستيراد الحزم

```powershell
# تصدير الحزم المحلية فقط
pip freeze --local > requirements.txt

# تصدير جميع الحزم
pip freeze > requirements.txt

# تثبيت من الملف
pip install -r requirements.txt
```

### 3.6 حذف البيئة بالكامل

```powershell
Remove-Item -Recurse -Force .venv
```

---

## 4. تنظيف الملفات المؤقتة

### حذف مجلدات `__pycache__` (PowerShell)

```powershell
Get-ChildItem -Path . -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force
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

```powershell
pip install pyclean
pyclean .
```

---

## 5. إدارة العمليات

### عرض عمليات Python الجارية

```powershell
Get-Process python*
```

### إيقاف جميع عمليات Python

**PowerShell:**

```powershell
Get-Process python | Stop-Process -Force
```

**CMD:**

```cmd
taskkill /F /IM python.exe
```

---

## 6. إعدادات VS Code

### فتح المشروع

```powershell
code .
```

### إعداد المفسر (`settings.json`)

```json
{
  "python.defaultInterpreterPath": ".venv\\Scripts\\python.exe",
  "python.terminal.activateEnvironment": true
}
```

---

## 7. سيناريوهات عملية

### بدء مشروع جديد

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install flask requests pandas
pip freeze > requirements.txt
code .
```

### استنساخ مشروع موجود

```powershell
git clone <repo_url>
cd <project_folder>
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### نسخ احتياطي للبيئة

```powershell
pip freeze --local > requirements_backup.txt
python --version > python_version.txt
pip --version > pip_version.txt
```

---

## 8. استكشاف الأخطاء

| المشكلة              | الحل                                                                   |
| -------------------- | ---------------------------------------------------------------------- |
| pip غير موجود        | `python -m ensurepip --upgrade`                                        |
| pip قديم             | `python -m pip install --upgrade pip`                                  |
| خطأ Execution Policy | `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` |
| البيئة غير مفعلة     | `.venv\Scripts\Activate.ps1`                                           |

---

## 9. مرجع سريع

| المهمة        | الأمر                                                                         |
| ------------- | ----------------------------------------------------------------------------- |
| إنشاء بيئة    | `python -m venv .venv`                                                        |
| تفعيل البيئة  | `.venv\Scripts\Activate.ps1`                                                  |
| إلغاء التفعيل | `deactivate`                                                                  |
| تثبيت الحزم   | `pip install -r requirements.txt`                                             |
| تصدير الحزم   | `pip freeze > requirements.txt`                                               |
| تحديث pip     | `python -m pip install --upgrade pip`                                         |
| تنظيف cache   | `Get-ChildItem -Recurse -Filter "__pycache__" \| Remove-Item -Recurse -Force` |
| إيقاف Python  | `Get-Process python \| Stop-Process -Force`                                   |

---

### ملاحظات مهمة

- **لا ترفع** مجلد `.venv` إلى Git — أضفه في `.gitignore`
- **استخدم بيئة افتراضية** منفصلة لكل مشروع
- **فعّل البيئة** دائماً قبل تشغيل أي أمر pip
- **نظّف** مجلدات `__pycache__` بانتظام

### نموذج `.gitignore`

```gitignore
.venv/
__pycache__/
*.py[cod]
dist/
build/
.vscode/
.env
```

</div>
