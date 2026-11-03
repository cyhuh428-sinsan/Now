!macro customInstall
  CreateShortcut "$SMPROGRAMS\NowNote Wiki.lnk" "$INSTDIR\NowNoteWiki.exe"
  CreateShortcut "$DESKTOP\NowNote Wiki.lnk" "$INSTDIR\NowNoteWiki.exe"
!macroend
!macro customUnInstall
  Delete "$SMPROGRAMS\NowNote Wiki.lnk"
  Delete "$DESKTOP\NowNote Wiki.lnk"
!macroend
