<div dir="rtl">

# اوامر Windows PowerShell للتحكم بالمشروع عن بعد

**تاريخ الانشاء:** 2026-02-09  
**اخر تحديث:** 2026-02-15  
**الحالة:** جاهز للاستخدام

### ملاحظة عن البيئة الافتراضية

هذه الاوامر تتحكم بـ Scheduled Task عن بعد عبر `Invoke-Command`، ولا تشغّل Python مباشرة.  
تفعيل البيئة الافتراضية (venv) يتم تلقائيا داخل اعدادات الـ Scheduled Task نفسها على السيرفر.

---

### ملخص الأوامر :

- Start ( تشغيل النظام ) : إذا كان الموقع لا يفتح والتطبيق متوقف.

- Stop ( إيقاف النظام ) : إذا أردت إجراء صيانة للسيرفر أو إيقاف الخدمة.

- Restart ( إعادة التشغيل ) : بعد تعديل الكود أو ملف .env لتطبيق التغييرات.

## 1. أمر التشغيل (Start System)

> **ملاحظة:** ملفات الاعتماد تُقرأ من `.server/` في جذر المشروع (أو `~/.server/` أو `C:\Users\HR\` كـ fallback)

هذا الأمر مخصص لتشغيل النظام إذا كان متوقفاً، دون الحاجة لإعادة تشغيل العمليات إذا كانت تعمل بالفعل.

```powershell
$u = (Get-Content ".server/server_user.txt").Trim();
$p = (Get-Content ".server/server_creds.txt").Trim() | ConvertTo-SecureString;
$c = New-Object System.Management.Automation.PSCredential($u, $p);
$srv = "172.23.24.109";

Invoke-Command -ComputerName $srv -Credential $c -ScriptBlock {
    $taskName = "SmartArchive_Permanent"

    # 1. Check if the task is already running
    $task = Get-ScheduledTask -TaskName $taskName
    $process = Get-Process python* -ErrorAction SilentlyContinue

    if ($process) {
        Write-Host "System is ALREADY RUNNING (PID: $($process.Id))" -ForegroundColor Yellow
    } else {
        Write-Host "Starting Smart Archive System..." -ForegroundColor Cyan

        # 2. Start the task
        Start-ScheduledTask -TaskName $taskName
        Start-Sleep -Seconds 3

        # 3. Final Verification
        $newProcess = Get-Process python* -ErrorAction SilentlyContinue
        if ($newProcess) {
            Write-Host "System STARTED successfully" -ForegroundColor Green
            Write-Host "New Process ID: $($newProcess.Id)"
        } else {
            Write-Host "Error: System failed to start. Check application logs." -ForegroundColor Red
        }
    }
}
```

---

## 2. أمر الإيقاف (Stop System)

هذا الأمر يقوم بإيقاف المهمة المجدولة وقتل أي عملية بايثون مرتبطة بها لضمان إغلاق كامل.

```powershell
$u = (Get-Content ".server/server_user.txt").Trim();
$p = (Get-Content ".server/server_creds.txt").Trim() | ConvertTo-SecureString;
$c = New-Object System.Management.Automation.PSCredential($u, $p);
$srv = "172.23.24.109";

Invoke-Command -ComputerName $srv -Credential $c -ScriptBlock {
    $taskName = "SmartArchive_Permanent"
    Write-Host "Stopping Task: $taskName"

    # Stop the scheduled task
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

    # Kill any lingering python processes
    Get-Process python* -ErrorAction SilentlyContinue | Stop-Process -Force

    Write-Host "System Status: DOWN" -ForegroundColor Red
}
```

---

## 3. أمر إعادة التشغيل (Restart System)

هذا هو الأمر الذي ستستخدمه غالباً عند تحديث الكود أو ملف .env. يقوم بالإيقاف التام ثم إعادة التشغيل.

```powershell
$u = (Get-Content ".server/server_user.txt").Trim();
$p = (Get-Content ".server/server_creds.txt").Trim() | ConvertTo-SecureString;
$c = New-Object System.Management.Automation.PSCredential($u, $p);
$srv = "172.23.24.109";

Invoke-Command -ComputerName $srv -Credential $c -ScriptBlock {
    $taskName = "SmartArchive_Permanent"
    Write-Host "--- Restarting Smart Archive System ---"

    # Step 1: Full Stop
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Get-Process python* -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2

    # Step 2: Start Task
    Start-ScheduledTask -TaskName $taskName
    Start-Sleep -Seconds 3

    # Step 3: Verification
    $process = Get-Process python* -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "System Restarted Successfully" -ForegroundColor Green
        Write-Host "Process IDs: $($process.Id -join ', ')"
    } else {
        Write-Host "Restart Failed - Check Logs" -ForegroundColor Red
    }
}
```

</div>
