' ==============================================================================
' MAPFY SENTINEL v2 - INICIALIZADOR EM SEGUNDO PLANO (RAIZ)
' ==============================================================================
Option Explicit

Dim WshShell, fso, scriptDir, targetVbs

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
targetVbs = fso.BuildPath(scriptDir, "MapFy_Telegram_Monitor\INICIAR_SEGUNDO_PLANO.vbs")

If fso.FileExists(targetVbs) Then
    WshShell.Run "wscript.exe """ & targetVbs & """", 0, False
Else
    WScript.Echo "Erro: Arquivo MapFy_Telegram_Monitor\INICIAR_SEGUNDO_PLANO.vbs nao encontrado."
    WScript.Quit 1
End If

Set WshShell = Nothing
Set fso = Nothing
