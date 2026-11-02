param([Parameter(Mandatory=$true)][int]$TargetProcessId)
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class NowNoteQaIo {
  [StructLayout(LayoutKind.Sequential)]
  public struct Counters {
    public ulong ReadOperations, WriteOperations, OtherOperations;
    public ulong ReadBytes, WriteBytes, OtherBytes;
  }
  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern bool GetProcessIoCounters(IntPtr process, out Counters counters);
}
'@
$process=[System.Diagnostics.Process]::GetProcessById($TargetProcessId)
try {
  $counters=New-Object NowNoteQaIo+Counters
  if(-not [NowNoteQaIo]::GetProcessIoCounters($process.Handle,[ref]$counters)){throw 'GetProcessIoCounters failed'}
  [pscustomobject]@{readBytes=$counters.ReadBytes;writeBytes=$counters.WriteBytes;readOperations=$counters.ReadOperations;writeOperations=$counters.WriteOperations} | ConvertTo-Json -Compress
} finally {$process.Dispose()}
