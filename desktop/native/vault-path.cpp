#include "vault-path.hpp"

#include <winternl.h>
#include <winioctl.h>

#include <cwctype>
#include <iomanip>
#include <sstream>

namespace vault {
namespace {

bool Fail(Error& error, const char* code, const char* message) {
  error = {code, message};
  return false;
}

bool Utf8ToWide(const std::string& input, std::wstring& output) {
  if (input.empty() || input.find('\0') != std::string::npos) return false;
  const int count = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, input.data(),
                                        static_cast<int>(input.size()), nullptr, 0);
  if (count <= 0) return false;
  output.resize(count);
  return MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, input.data(),
                             static_cast<int>(input.size()), output.data(), count) == count;
}

bool ValidComponent(const std::wstring& name) {
  if (name.empty() || name == L"." || name == L".." || name.back() == L'.' ||
      name.back() == L' ') return false;
  for (wchar_t ch : name) {
    if (ch < 32 || ch == L':' || ch == L'/' || ch == L'?' || ch == L'*' ||
        ch == L'"' || ch == L'<' || ch == L'>' || ch == L'|') return false;
  }
  std::wstring stem = name.substr(0, name.find(L'.'));
  for (wchar_t& ch : stem) ch = static_cast<wchar_t>(std::towupper(ch));
  if (stem == L"CON" || stem == L"PRN" || stem == L"AUX" || stem == L"NUL" ||
      stem == L"CONIN$" || stem == L"CONOUT$") return false;
  if (stem.size() == 4 && (stem.substr(0, 3) == L"COM" || stem.substr(0, 3) == L"LPT")) {
    const wchar_t suffix = stem[3];
    if ((suffix >= L'1' && suffix <= L'9') || suffix == L'\u00b9' ||
        suffix == L'\u00b2' || suffix == L'\u00b3') return false;
  }
  return true;
}

bool OpenDirectory(const std::wstring& name, HANDLE parent, HANDLE& opened) {
  UNICODE_STRING unicode{};
  if (name.size() > 32767) return false;
  unicode.Buffer = const_cast<PWSTR>(name.c_str());
  unicode.Length = static_cast<USHORT>(name.size() * sizeof(wchar_t));
  unicode.MaximumLength = unicode.Length;
  OBJECT_ATTRIBUTES attributes{};
  InitializeObjectAttributes(&attributes, &unicode, OBJ_CASE_INSENSITIVE | OBJ_DONT_REPARSE,
                             parent, nullptr);
  IO_STATUS_BLOCK io{};
  const NTSTATUS status = NtCreateFile(
      &opened, FILE_READ_ATTRIBUTES | FILE_LIST_DIRECTORY | SYNCHRONIZE, &attributes, &io,
      nullptr, FILE_ATTRIBUTE_NORMAL, FILE_SHARE_READ | FILE_SHARE_WRITE,
      FILE_OPEN, FILE_DIRECTORY_FILE | FILE_OPEN_REPARSE_POINT | FILE_SYNCHRONOUS_IO_NONALERT,
      nullptr, 0);
  return status >= 0 && opened != INVALID_HANDLE_VALUE && opened != nullptr;
}

bool IsReparsePoint(HANDLE handle) {
  FILE_ATTRIBUTE_TAG_INFO info{};
  return !GetFileInformationByHandleEx(handle, FileAttributeTagInfo, &info, sizeof(info)) ||
         (info.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0;
}

bool IsLocalDisk(HANDLE handle, Error& error) {
  struct DeviceInformation {
    ULONG deviceType;
    ULONG characteristics;
  } info{};
  using QueryVolume = NTSTATUS(NTAPI*)(HANDLE, PIO_STATUS_BLOCK, PVOID, ULONG, ULONG);
  const HMODULE ntdll = GetModuleHandleW(L"ntdll.dll");
  const auto query = ntdll ? reinterpret_cast<QueryVolume>(
      GetProcAddress(ntdll, "NtQueryVolumeInformationFile")) : nullptr;
  IO_STATUS_BLOCK io{};
  // FileFsDeviceInformation is class 4; FILE_REMOTE_DEVICE is bit 0x10.
  if (!query || query(handle, &io, &info, sizeof(info), 4) < 0) {
    return Fail(error, "DEVICE_QUERY_FAILED", "Cannot verify Vault device");
  }
  if (info.deviceType != FILE_DEVICE_DISK || (info.characteristics & 0x10) != 0) {
    return Fail(error, "UNSUPPORTED_DRIVE", "Vault must be on a local disk");
  }
  return true;
}

std::string HexBytes(const BYTE* bytes, size_t size) {
  std::ostringstream stream;
  stream << std::hex << std::setfill('0');
  for (size_t i = 0; i < size; ++i) stream << std::setw(2) << static_cast<unsigned>(bytes[i]);
  return stream.str();
}

}  // namespace

RootHandles::~RootHandles() {
  for (auto it = handles_.rbegin(); it != handles_.rend(); ++it) CloseHandle(*it);
}

bool RootHandles::Open(const std::string& utf8Root, RootIdentity& identity, Error& error) {
  if (!handles_.empty()) return Fail(error, "INVALID_STATE", "Root is already open");
  std::wstring root;
  if (!Utf8ToWide(utf8Root, root) || root.size() < 3 ||
      !((root[0] >= L'A' && root[0] <= L'Z') || (root[0] >= L'a' && root[0] <= L'z')) ||
      root[1] != L':' || root[2] != L'\\') {
    return Fail(error, "INVALID_ROOT", "Root must be an absolute local drive path");
  }

  const std::wstring drive = root.substr(0, 3);
  std::wstring ntDrive = L"\\??\\" + drive;
  HANDLE opened = INVALID_HANDLE_VALUE;
  if (!OpenDirectory(ntDrive, nullptr, opened)) {
    return Fail(error, "ROOT_OPEN_FAILED", "Cannot open drive root");
  }
  handles_.push_back(opened);
  if (IsReparsePoint(opened)) {
    return Fail(error, "REPARSE_POINT", "Drive root is a reparse point");
  }

  size_t start = 3;
  while (start < root.size()) {
    const size_t end = root.find(L'\\', start);
    const std::wstring component = root.substr(start, end == std::wstring::npos ? end : end - start);
    if (!ValidComponent(component)) {
      return Fail(error, "INVALID_ROOT", "Invalid path component");
    }
    opened = INVALID_HANDLE_VALUE;
    if (!OpenDirectory(component, handles_.back(), opened)) {
      return Fail(error, "ROOT_OPEN_FAILED", "Cannot open Vault path component");
    }
    handles_.push_back(opened);
    if (IsReparsePoint(opened)) {
      return Fail(error, "REPARSE_POINT", "Vault path contains a reparse point");
    }
    if (end == std::wstring::npos) break;
    start = end + 1;
  }

  if (!IsLocalDisk(handles_.back(), error)) return false;
  wchar_t filesystem[64]{};
  if (!GetVolumeInformationByHandleW(handles_.back(), nullptr, 0, nullptr, nullptr, nullptr,
                                      filesystem, static_cast<DWORD>(std::size(filesystem)))) {
    return Fail(error, "FILESYSTEM_UNKNOWN", "Cannot identify Vault filesystem");
  }
  if (_wcsicmp(filesystem, L"NTFS") != 0) {
    return Fail(error, "UNSUPPORTED_FILESYSTEM", "Vault filesystem is not supported");
  }
  FILE_ID_INFO fileId{};
  if (!GetFileInformationByHandleEx(handles_.back(), FileIdInfo, &fileId, sizeof(fileId))) {
    return Fail(error, "IDENTITY_FAILED", "Cannot identify Vault root");
  }
  identity.volumeId = HexBytes(reinterpret_cast<const BYTE*>(&fileId.VolumeSerialNumber),
                               sizeof(fileId.VolumeSerialNumber));
  identity.fileId = HexBytes(fileId.FileId.Identifier, sizeof(fileId.FileId.Identifier));
  identity.filesystem = "NTFS";
  return true;
}

}  // namespace vault
