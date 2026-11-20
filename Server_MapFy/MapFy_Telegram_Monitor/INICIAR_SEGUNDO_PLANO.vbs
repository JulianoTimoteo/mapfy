' ==============================================================================
' MAPFY SENTINEL v2 - INICIALIZADOR EM SEGUNDO PLANO (100% SILENCIOSO / SEM JANELA)
' ==============================================================================
Option Explicit

Dim WshShell, fso, scriptDir, pythonwExe, runtimePythonw, targetScript, workDir, cmd

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' 1. Determina diretorio e script run_server.py
If fso.FileExists(fso.BuildPath(scriptDir, "run_server.py")) Then
    workDir = scriptDir
    targetScript = fso.BuildPath(scriptDir, "run_server.py")
    runtimePythonw = fso.BuildPath(scriptDir, "..\server\runtime\pythonw.exe")
ElseIf fso.FileExists(fso.BuildPath(scriptDir, "MapFy_Telegram_Monitor\run_server.py")) Then
    workDir = fso.BuildPath(scriptDir, "MapFy_Telegram_Monitor")
    targetScript = fso.BuildPath(workDir, "run_server.py")
    runtimePythonw = fso.BuildPath(scriptDir, "server\runtime\pythonw.exe")
Else
    WScript.Quit 1
End If

' 2. Localiza interpretador pythonw (sem console) ou python comum como fallback
If fso.FileExists(runtimePythonw) Then
    pythonwExe = runtimePythonw
ElseIf fso.FileExists(fso.BuildPath(scriptDir, "..\server\runtime\python.exe")) Then
    pythonwExe = fso.BuildPath(scriptDir, "..\server\runtime\python.exe")
Else
    pythonwExe = "pythonw.exe"
End If

WshShell.CurrentDirectory = workDir

' 3. Executa totalmente invisivel em background (0 = Hidden, False = Nao bloqueia)
cmd = """" & pythonwExe & """ """ & targetScript & """"
WshShell.Run cmd, 0, False

Set WshShell = Nothing
Set fso = Nothing
