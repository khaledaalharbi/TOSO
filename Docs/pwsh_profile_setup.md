<div dir="rtl">

# اعداد PowerShell Profile - اوامر SmartArchive المختصرة

**تاريخ الانشاء:** 2026-02-10  
**الحالة:** جاهز للتنفيذ  
**المرجع:** [pwsh.md](pwsh.md)

---

## الغرض

هذا الملف يحتوي على تعليمات لاعداد PowerShell Profile على جهاز العمل بحيث تصبح جميع اوامر التحكم بمشروع الارشفة الذكية متاحة كاختصارات جاهزة في اي نافذة PowerShell.

---

## تعليمات التنفيذ للمساعد الذكي

> **ملاحظة:** هذا القسم موجه للمساعد الذكي (Windsurf / Cascade) لتنفيذ الاعداد تلقائيا.

### الخطوة 1: التحقق من المتطلبات

تحقق من وجود الملفات التالية على الجهاز:

> **ملاحظة:** ملفات الاعتماد تُقرأ من `.server/` في جذر المشروع (أو `~/.server/` أو `C:\Users\HR\` كـ fallback)

```
.server/server_user.txt
.server/server_creds.txt
```

اذا لم تكن موجودة، ابلغ المستخدم ولا تتابع.

### الخطوة 2: ضبط سياسة التنفيذ

نفّذ هذا الامر في PowerShell:

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

### الخطوة 3: انشاء ملف Profile

تحقق من وجود ملف `$PROFILE`. اذا لم يكن موجودا، انشئه:

```powershell
if (-not (Test-Path $PROFILE)) {
    New-Item -Path $PROFILE -Type File -Force
}
```

### الخطوة 4: اضافة الكود

انسخ كامل محتوى قسم [كود PowerShell Profile](#كود-powershell-profile) الى نهاية ملف `$PROFILE`.

### الخطوة 5: اعادة تحميل الـ Profile

```powershell
. $PROFILE
```

### الخطوة 6: التحقق من نجاح الاعداد

نفّذ:

```powershell
sa status
```

اذا ظهر تقرير الحالة بالالوان فالاعداد ناجح.

---

## كود PowerShell Profile

الكود التالي يجب اضافته الى ملف `$PROFILE`:

```powershell
# ============================================================
# SmartArchive Remote Control Functions
# Source: tools/order_command/pwsh_profile_setup.md
# ============================================================

function Invoke-SmartArchive {
    [CmdletBinding()]
    param(
        [Parameter(Position = 0)]
        [ValidateSet(
            'start', 'stop', 'restart', 'status',
            'mysql-status', 'mysql-start', 'mysql-stop', 'mysql-restart',
            'db-check', 'full'
        )]
        [string]$Action = 'status',

        [string]$Server   = "172.23.24.109",
        [string]$UserFile = ".server/server_user.txt",
        [string]$PassFile = ".server/server_creds.txt",
        [string]$TaskName = "SmartArchive_Permanent",
        [string]$MySQLSvc = "MySQL80"
    )

    # --- Validate credential files ---
    if (-not (Test-Path $UserFile) -or -not (Test-Path $PassFile)) {
        Write-Error "Credential files not found! Check paths: $UserFile, $PassFile"
        return
    }

    # --- Build credentials ---
    try {
        $u = (Get-Content $UserFile).Trim()
        $p = (Get-Content $PassFile).Trim() | ConvertTo-SecureString
        $cred = New-Object System.Management.Automation.PSCredential($u, $p)
    }
    catch {
        Write-Error "Failed to load credentials: $_"
        return
    }

    # --- Execute action ---
    try {
        switch ($Action) {

            # ──────────────────────────────────
            # Application Commands
            # ──────────────────────────────────

            'start' {
                Invoke-Command -ComputerName $Server -Credential $cred -ScriptBlock {
                    param($tn)
                    Write-Host "--- Executing START Command ---" -ForegroundColor Cyan
                    Start-ScheduledTask -TaskName $tn -ErrorAction SilentlyContinue
                    Write-Host "Waiting 3 seconds for initialization..."
                    Start-Sleep -Seconds 3

                    $task = Get-ScheduledTask -TaskName $tn
                    $proc = Get-Process python* -ErrorAction SilentlyContinue

                    $taskColor = "Yellow"
                    if ($task.State -eq 'Running') { $taskColor = "Green" }

                    Write-Host "`n--- Final Status Report ---" -ForegroundColor White
                    Write-Host "Task State: $($task.State)" -ForegroundColor $taskColor

                    if ($proc) {
                        Write-Host "Python Process: RUNNING (PIDs: $($proc.Id -join ', '))" -ForegroundColor Green
                    } else {
                        Write-Host "Python Process: FAILED TO START" -ForegroundColor Red
                    }
                    Write-Host "---------------------------`n"
                } -ArgumentList $TaskName
            }

            'stop' {
                Invoke-Command -ComputerName $Server -Credential $cred -ScriptBlock {
                    param($tn)
                    Write-Host "--- Executing STOP Command ---" -ForegroundColor Red
                    Stop-ScheduledTask -TaskName $tn -ErrorAction SilentlyContinue
                    Get-Process python* -ErrorAction SilentlyContinue | Stop-Process -Force
                    Write-Host "Cleaning up memory..."
                    Start-Sleep -Seconds 3

                    $task = Get-ScheduledTask -TaskName $tn
                    $proc = Get-Process python* -ErrorAction SilentlyContinue

                    Write-Host "`n--- Final Status Report ---" -ForegroundColor White
                    Write-Host "Task State: $($task.State)" -ForegroundColor Yellow

                    if ($proc) {
                        Write-Host "Warning: Some processes still alive (PIDs: $($proc.Id -join ', '))" -ForegroundColor Red
                    } else {
                        Write-Host "System Status: COMPLETELY STOPPED" -ForegroundColor White
                    }
                    Write-Host "---------------------------`n"
                } -ArgumentList $TaskName
            }

            'restart' {
                Invoke-Command -ComputerName $Server -Credential $cred -ScriptBlock {
                    param($tn)
                    Write-Host "--- Executing RESTART Command ---" -ForegroundColor Magenta

                    Get-Process python* -ErrorAction SilentlyContinue | Stop-Process -Force
                    Start-Sleep -Seconds 1

                    Start-ScheduledTask -TaskName $tn
                    Write-Host "Refreshing system session..."
                    Start-Sleep -Seconds 4

                    $task = Get-ScheduledTask -TaskName $tn
                    $proc = Get-Process python* -ErrorAction SilentlyContinue

                    $taskColor = "Yellow"
                    if ($task.State -eq 'Running') { $taskColor = "Green" }

                    Write-Host "`n--- Final Status Report ---" -ForegroundColor White
                    Write-Host "Task State: $($task.State)" -ForegroundColor $taskColor

                    if ($proc) {
                        Write-Host "System Restarted Successfully!" -ForegroundColor Green
                        Write-Host "New Process IDs: $($proc.Id -join ', ')" -ForegroundColor Cyan
                    } else {
                        Write-Host "Restart Failed: Python didn't start." -ForegroundColor Red
                    }
                    Write-Host "---------------------------`n"
                } -ArgumentList $TaskName
            }

            'status' {
                Invoke-Command -ComputerName $Server -Credential $cred -ScriptBlock {
                    param($tn)
                    $task = Get-ScheduledTask -TaskName $tn -ErrorAction SilentlyContinue
                    $proc = Get-Process python* -ErrorAction SilentlyContinue

                    Write-Host "`n--- Status Report: $tn ---" -ForegroundColor White

                    if ($task) {
                        $color = if ($task.State -eq 'Ready' -or $task.State -eq 'Running') { "Green" } else { "Red" }
                        Write-Host "Task State: $($task.State)" -ForegroundColor $color
                    } else {
                        Write-Host "Task '$tn' not found!" -ForegroundColor Red
                    }

                    if ($proc) {
                        Write-Host "Python Process: RUNNING" -ForegroundColor Green
                        Write-Host "   PID: $($proc.Id)" -ForegroundColor Cyan
                        Write-Host "   Start Time: $($proc.StartTime)" -ForegroundColor White
                    } else {
                        Write-Host "Python Process: NOT FOUND" -ForegroundColor Red
                    }
                    Write-Host "-----------------------------------`n"
                } -ArgumentList $TaskName
            }

            # ──────────────────────────────────
            # MySQL Commands
            # ──────────────────────────────────

            'mysql-status' {
                Invoke-Command -ComputerName $Server -Credential $cred -ScriptBlock {
                    param($svcName)
                    $svc = Get-Service -Name $svcName -ErrorAction SilentlyContinue

                    Write-Host "`n--- MySQL Status Report ---" -ForegroundColor White

                    if ($svc) {
                        $color = if ($svc.Status -eq 'Running') { "Green" } else { "Red" }
                        Write-Host "Service Name : $($svc.Name)" -ForegroundColor White
                        Write-Host "Display Name : $($svc.DisplayName)" -ForegroundColor White
                        Write-Host "Status       : $($svc.Status)" -ForegroundColor $color
                        Write-Host "Start Type   : $($svc.StartType)" -ForegroundColor White
                    } else {
                        Write-Host "$svcName service not found!" -ForegroundColor Red
                    }
                    Write-Host "----------------------------`n"
                } -ArgumentList $MySQLSvc
            }

            'mysql-start' {
                Invoke-Command -ComputerName $Server -Credential $cred -ScriptBlock {
                    param($svcName)
                    Write-Host "Starting $svcName service..." -ForegroundColor Cyan
                    Start-Service -Name $svcName -ErrorAction Stop
                    Start-Sleep -Seconds 2

                    $svc = Get-Service -Name $svcName
                    $color = if ($svc.Status -eq 'Running') { "Green" } else { "Red" }
                    Write-Host "$svcName Status: $($svc.Status)" -ForegroundColor $color
                } -ArgumentList $MySQLSvc
            }

            'mysql-stop' {
                Invoke-Command -ComputerName $Server -Credential $cred -ScriptBlock {
                    param($svcName)
                    Write-Host "Stopping $svcName service..." -ForegroundColor Yellow
                    Stop-Service -Name $svcName -Force -ErrorAction Stop
                    Start-Sleep -Seconds 2

                    $svc = Get-Service -Name $svcName
                    $color = if ($svc.Status -eq 'Stopped') { "White" } else { "Red" }
                    Write-Host "$svcName Status: $($svc.Status)" -ForegroundColor $color
                } -ArgumentList $MySQLSvc
            }

            'mysql-restart' {
                Invoke-Command -ComputerName $Server -Credential $cred -ScriptBlock {
                    param($svcName)
                    Write-Host "Restarting $svcName service..." -ForegroundColor Magenta
                    Restart-Service -Name $svcName -Force -ErrorAction Stop
                    Start-Sleep -Seconds 3

                    $svc = Get-Service -Name $svcName
                    $color = if ($svc.Status -eq 'Running') { "Green" } else { "Red" }
                    Write-Host "$svcName Status: $($svc.Status)" -ForegroundColor $color
                } -ArgumentList $MySQLSvc
            }

            'db-check' {
                Invoke-Command -ComputerName $Server -Credential $cred -ScriptBlock {
                    param($svcName)
                    Write-Host "`n--- Database Connection Check ---" -ForegroundColor White

                    $svc = Get-Service -Name $svcName -ErrorAction SilentlyContinue
                    if (-not $svc -or $svc.Status -ne 'Running') {
                        Write-Host "$svcName service is NOT running!" -ForegroundColor Red
                        return
                    }
                    Write-Host "$svcName Service: Running" -ForegroundColor Green

                    $mysqlPath = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
                    $result = & $mysqlPath -u root -pNewPassword -e "SELECT 'CONNECTION_OK' AS status;" smart_archive_db 2>&1
                    if ($result -match "CONNECTION_OK") {
                        Write-Host "Database smart_archive_db: CONNECTED" -ForegroundColor Green
                    } else {
                        Write-Host "Database connection FAILED!" -ForegroundColor Red
                        Write-Host $result -ForegroundColor Yellow
                    }

                    $tables = & $mysqlPath -u root -pNewPassword -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='smart_archive_db';" 2>&1
                    Write-Host "Table Count: $($tables.Trim())" -ForegroundColor Cyan
                    Write-Host "---------------------------------`n"
                } -ArgumentList $MySQLSvc
            }

            # ──────────────────────────────────
            # Full System Check
            # ──────────────────────────────────

            'full' {
                Invoke-Command -ComputerName $Server -Credential $cred -ScriptBlock {
                    param($tn, $svcName)
                    Write-Host "`n========== FULL SYSTEM CHECK ==========" -ForegroundColor White

                    $mysql = Get-Service -Name $svcName -ErrorAction SilentlyContinue
                    $mysqlColor = if ($mysql -and $mysql.Status -eq 'Running') { "Green" } else { "Red" }
                    $mysqlStatus = if ($mysql) { $mysql.Status } else { "NOT FOUND" }
                    Write-Host "[MySQL]    Service  : $mysqlStatus" -ForegroundColor $mysqlColor

                    $task = Get-ScheduledTask -TaskName $tn -ErrorAction SilentlyContinue
                    $taskColor = if ($task -and ($task.State -eq 'Running' -or $task.State -eq 'Ready')) { "Green" } else { "Red" }
                    $taskStatus = if ($task) { $task.State } else { "NOT FOUND" }
                    Write-Host "[Task]     State    : $taskStatus" -ForegroundColor $taskColor

                    $proc = Get-Process python* -ErrorAction SilentlyContinue
                    if ($proc) {
                        Write-Host "[Python]   Process  : RUNNING (PIDs: $($proc.Id -join ', '))" -ForegroundColor Green
                    } else {
                        Write-Host "[Python]   Process  : NOT RUNNING" -ForegroundColor Red
                    }

                    $disk = Get-PSDrive C
                    $freeGB = [math]::Round($disk.Free / 1GB, 1)
                    $diskColor = if ($freeGB -gt 10) { "Green" } elseif ($freeGB -gt 3) { "Yellow" } else { "Red" }
                    Write-Host "[Disk C:]  Free     : $freeGB GB" -ForegroundColor $diskColor

                    Write-Host "========================================`n" -ForegroundColor White
                } -ArgumentList $TaskName, $MySQLSvc
            }
        }
    }
    catch {
        Write-Error "Remote execution failed: $_"
    }
}

# --- Register alias ---
Set-Alias -Name sa -Value Invoke-SmartArchive -Scope Global

Write-Host "[SmartArchive] Remote control loaded. Type 'sa' for help." -ForegroundColor DarkGray
# ============================================================
```

---

## الاستخدام بعد الاعداد

### اوامر التطبيق

| الاختصار     | الامر الكامل                  | الوظيفة                      |
| ------------ | ----------------------------- | ---------------------------- |
| `sa`         | `sa status`                   | فحص حالة التطبيق (الافتراضي) |
| `sa start`   | `Invoke-SmartArchive start`   | تشغيل + فحص الحالة           |
| `sa stop`    | `Invoke-SmartArchive stop`    | ايقاف + فحص الحالة           |
| `sa restart` | `Invoke-SmartArchive restart` | اعادة تشغيل + فحص الحالة     |
| `sa status`  | `Invoke-SmartArchive status`  | فحص الحالة فقط               |

### اوامر قاعدة البيانات

| الاختصار           | الوظيفة                                |
| ------------------ | -------------------------------------- |
| `sa mysql-status`  | فحص حالة خدمة MySQL                    |
| `sa mysql-start`   | تشغيل خدمة MySQL                       |
| `sa mysql-stop`    | ايقاف خدمة MySQL                       |
| `sa mysql-restart` | اعادة تشغيل خدمة MySQL                 |
| `sa db-check`      | فحص اتصال قاعدة البيانات + عدد الجداول |

### فحص شامل

| الاختصار  | الوظيفة                                       |
| --------- | --------------------------------------------- |
| `sa full` | فحص شامل: MySQL + Task + Python + مساحة القرص |

### امثلة

```powershell
# فحص سريع للحالة
sa

# تشغيل المشروع
sa start

# ايقاف المشروع
sa stop

# اعادة تشغيل
sa restart

# فحص MySQL
sa mysql-status

# فحص شامل للنظام
sa full

# فحص اتصال قاعدة البيانات
sa db-check

# استخدام سيرفر مختلف
sa start -Server "192.168.1.100"
```

---

## ملاحظات

- **الاختصار `sa`** يعمل كـ alias لـ `Invoke-SmartArchive` ويقبل نفس المعاملات
- **الامر الافتراضي** بدون معاملات هو `status` - اي ان كتابة `sa` فقط يعرض تقرير الحالة
- **Tab Completion** يعمل تلقائيا - اكتب `sa` ثم مسافة ثم اضغط Tab لعرض الخيارات المتاحة
- **تغيير السيرفر** ممكن عبر `-Server` لاختبار سيرفرات اخرى
- **ملفات الاعتماد** يجب ان تكون موجودة في `C:\Users\HR\` على جهاز العمل

</div>
