param([Parameter(Mandatory=$true)][int]$TargetProcessId)
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class NowNoteQaAppIo {
  [StructLayout(LayoutKind.Sequential)]
  public struct Counters { public ulong ReadOperations, WriteOperations, OtherOperations, ReadBytes, WriteBytes, OtherBytes; }
  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern bool GetProcessIoCounters(IntPtr process, out Counters counters);
}
'@
$ids=New-Object 'System.Collections.Generic.HashSet[int]'
$queue=New-Object 'System.Collections.Generic.Queue[int]'
$queue.Enqueue($TargetProcessId)
while($queue.Count -gt 0){
  $current=$queue.Dequeue()
  if(-not $ids.Add($current)){continue}
  Get-CimInstance Win32_Process -Filter "ParentProcessId=$current" | ForEach-Object {$queue.Enqueue([int]$_.ProcessId)}
}
$rows=@(foreach($id in $ids){
  $process=[System.Diagnostics.Process]::GetProcessById($id)
  try{
    $counter=New-Object NowNoteQaAppIo+Counters
    if(-not [NowNoteQaAppIo]::GetProcessIoCounters($process.Handle,[ref]$counter)){throw 'Own process I/O probe failed'}
    [pscustomobject]@{pid=$id;workingSet=$process.WorkingSet64;privateBytes=$process.PrivateMemorySize64;readBytes=$counter.ReadBytes;writeBytes=$counter.WriteBytes}
  }finally{$process.Dispose()}
})
[pscustomobject]@{rootPid=$TargetProcessId;processes=$rows;workingSet=($rows|Measure-Object workingSet -Sum).Sum;privateBytes=($rows|Measure-Object privateBytes -Sum).Sum;readBytes=($rows|Measure-Object readBytes -Sum).Sum;writeBytes=($rows|Measure-Object writeBytes -Sum).Sum} | ConvertTo-Json -Compress -Depth 4
