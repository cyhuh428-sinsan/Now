#include "vault-ops.hpp"

#include <bcrypt.h>
#include <winternl.h>

#include <algorithm>
#include <cctype>
#ifdef NOW_VAULT_MUTATION_EXPERIMENT
#include <cstdio>
#include <cstdlib>
#endif
#include <cstring>
#include <cwctype>
#include <iomanip>
#include <limits>
#include <memory>
#include <set>
#include <sstream>
#include <vector>

namespace vault {
namespace {

constexpr uint64_t kMaxMarkdown = 5ULL * 1024 * 1024;
constexpr size_t kMaxResponse = 16 * 1024 * 1024;
constexpr size_t kMaxScanNameBytes = 4 * 1024 * 1024;
constexpr size_t kMaxDepth = 128;
constexpr size_t kMaxEntries = 100000;

DWORD MutationDirectoryShare() {
#ifdef NOW_VAULT_MUTATION_EXPERIMENT
  return FILE_SHARE_READ | FILE_SHARE_WRITE;
#else
  return FILE_SHARE_READ;
#endif
}

#ifdef NOW_VAULT_MUTATION_EXPERIMENT
void PauseForTest(const char* variable, const char* marker) {
  char pause[16]{};
  size_t pauseLength = 0;
  if (getenv_s(&pauseLength, pause, sizeof(pause), variable) != 0 || pauseLength == 0)
    return;
  char* end = nullptr;
  const long milliseconds = std::strtol(pause, &end, 10);
  if (*end == '\0' && milliseconds > 0 && milliseconds <= 5000) {
    std::fputs(marker, stderr);
    std::fputc('\n', stderr);
    std::fflush(stderr);
    Sleep(static_cast<DWORD>(milliseconds));
  }
}
#endif

bool Fail(Error& error, const char* code, const char* message) {
  error = {code, message};
  return false;
}

struct Handle {
  HANDLE value = INVALID_HANDLE_VALUE;
  Handle() = default;
  explicit Handle(HANDLE handle) : value(handle) {}
  ~Handle() { if (value != INVALID_HANDLE_VALUE) CloseHandle(value); }
  Handle(const Handle&) = delete;
  Handle& operator=(const Handle&) = delete;
  Handle(Handle&& other) noexcept : value(other.value) { other.value = INVALID_HANDLE_VALUE; }
  Handle& operator=(Handle&& other) noexcept {
    if (this != &other) {
      if (value != INVALID_HANDLE_VALUE) CloseHandle(value);
      value = other.value;
      other.value = INVALID_HANDLE_VALUE;
    }
    return *this;
  }
};

struct MutationMutex {
  Handle handle;
  bool owned = false;
  ~MutationMutex() { if (owned) ReleaseMutex(handle.value); }

  bool Acquire(const RootIdentity& identity, Error& error) {
    const std::string suffix = identity.volumeId + "-" + identity.fileId;
    const std::wstring name = L"Global\\NowNoteVault-" + std::wstring(suffix.begin(), suffix.end());
    handle = Handle(CreateMutexW(nullptr, FALSE, name.c_str()));
    if (handle.value == INVALID_HANDLE_VALUE || handle.value == nullptr)
      return Fail(error, "LOCK_UNAVAILABLE", "Cannot create Vault mutation lock");
    const DWORD state = WaitForSingleObject(handle.value, 30000);
    if (state != WAIT_OBJECT_0 && state != WAIT_ABANDONED)
      return Fail(error, "LOCK_UNAVAILABLE", "Cannot acquire Vault mutation lock");
    owned = true;
    return true;
  }
};

bool ToWide(const std::string& source, std::wstring& wide) {
  if (source.empty() || source.size() > 32767 || source.find('\0') != std::string::npos)
    return false;
  const int count = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, source.data(),
                                        static_cast<int>(source.size()), nullptr, 0);
  if (count <= 0) return false;
  wide.resize(count);
  return MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, source.data(),
                             static_cast<int>(source.size()), wide.data(), count) == count;
}

bool ToUtf8(const std::wstring& wide, std::string& result) {
  const int count = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, wide.data(),
                                        static_cast<int>(wide.size()), nullptr, 0, nullptr, nullptr);
  if (count <= 0) return false;
  result.resize(count);
  return WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, wide.data(),
                             static_cast<int>(wide.size()), result.data(), count, nullptr, nullptr) == count;
}

bool ValidName(const std::wstring& name) {
  if (name.empty() || name == L"." || name == L".." || name.back() == L'.' ||
      name.back() == L' ' || name.size() > 255) return false;
  for (wchar_t ch : name) {
    if (ch < 32 || ch == L':' || ch == L'/' || ch == L'\\' || ch == L'?' ||
        ch == L'*' || ch == L'"' || ch == L'<' || ch == L'>' || ch == L'|') return false;
  }
  std::wstring stem = name.substr(0, name.find(L'.'));
  for (auto& ch : stem) ch = static_cast<wchar_t>(std::towupper(ch));
  if (stem == L"CON" || stem == L"PRN" || stem == L"AUX" || stem == L"NUL" ||
      stem == L"CONIN$" || stem == L"CONOUT$") return false;
  if (stem.size() == 4 && (stem.substr(0, 3) == L"COM" || stem.substr(0, 3) == L"LPT") &&
      ((stem[3] >= L'1' && stem[3] <= L'9') || stem[3] == L'\u00b9' ||
       stem[3] == L'\u00b2' || stem[3] == L'\u00b3')) return false;
  return true;
}

bool OpenChild(HANDLE parent, const std::wstring& name, bool directory, Handle& child,
               Error& error, DWORD share = FILE_SHARE_READ | FILE_SHARE_WRITE) {
  if (!ValidName(name)) return Fail(error, "INVALID_PATH", "Invalid path component");
  UNICODE_STRING unicode{};
  unicode.Buffer = const_cast<PWSTR>(name.c_str());
  unicode.Length = static_cast<USHORT>(name.size() * sizeof(wchar_t));
  unicode.MaximumLength = unicode.Length;
  OBJECT_ATTRIBUTES attributes{};
  InitializeObjectAttributes(&attributes, &unicode, OBJ_CASE_INSENSITIVE | OBJ_DONT_REPARSE,
                             parent, nullptr);
  IO_STATUS_BLOCK io{};
  HANDLE opened = INVALID_HANDLE_VALUE;
  const NTSTATUS status = NtCreateFile(
      &opened, (directory ? FILE_LIST_DIRECTORY : FILE_READ_DATA) |
                   FILE_READ_ATTRIBUTES | SYNCHRONIZE,
      &attributes, &io, nullptr, FILE_ATTRIBUTE_NORMAL,
      directory ? share : FILE_SHARE_READ,
      FILE_OPEN, (directory ? FILE_DIRECTORY_FILE : FILE_NON_DIRECTORY_FILE) |
                 FILE_OPEN_REPARSE_POINT | FILE_SYNCHRONOUS_IO_NONALERT,
      nullptr, 0);
  if (status < 0 || opened == INVALID_HANDLE_VALUE || opened == nullptr)
    return Fail(error, "OPEN_FAILED", "Cannot open Vault component");
  child = Handle(opened);
  FILE_ATTRIBUTE_TAG_INFO tag{};
  if (!GetFileInformationByHandleEx(child.value, FileAttributeTagInfo, &tag, sizeof(tag)) ||
      (tag.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0)
    return Fail(error, "REPARSE_POINT", "Vault component is a reparse point");
  return true;
}

std::string HexBytes(const BYTE* bytes, size_t size) {
  std::ostringstream stream;
  stream << std::hex << std::setfill('0');
  for (size_t i = 0; i < size; ++i) stream << std::setw(2) << static_cast<unsigned>(bytes[i]);
  return stream.str();
}

bool OpenRoot(const std::string& root, const RootIdentity& expected,
              std::vector<Handle>& chain, Error& error, bool exclusive = false) {
  std::wstring wide;
  if (!ToWide(root, wide) || wide.size() < 3 || !std::iswalpha(wide[0]) ||
      wide[1] != L':' || wide[2] != L'\\')
    return Fail(error, "INVALID_ROOT", "Root must be a local drive path");
  const std::wstring drive = L"\\??\\" + wide.substr(0, 3);
  UNICODE_STRING unicode{};
  unicode.Buffer = const_cast<PWSTR>(drive.c_str());
  unicode.Length = static_cast<USHORT>(drive.size() * sizeof(wchar_t));
  unicode.MaximumLength = unicode.Length;
  OBJECT_ATTRIBUTES attributes{};
  InitializeObjectAttributes(&attributes, &unicode, OBJ_CASE_INSENSITIVE | OBJ_DONT_REPARSE,
                             nullptr, nullptr);
  IO_STATUS_BLOCK io{};
  HANDLE opened = INVALID_HANDLE_VALUE;
  const NTSTATUS status = NtCreateFile(
      &opened, FILE_LIST_DIRECTORY | FILE_READ_ATTRIBUTES | SYNCHRONIZE, &attributes, &io,
      nullptr, FILE_ATTRIBUTE_NORMAL,
      exclusive ? MutationDirectoryShare() : FILE_SHARE_READ | FILE_SHARE_WRITE, FILE_OPEN,
      FILE_DIRECTORY_FILE | FILE_OPEN_REPARSE_POINT | FILE_SYNCHRONOUS_IO_NONALERT,
      nullptr, 0);
  if (status < 0 || opened == INVALID_HANDLE_VALUE || opened == nullptr)
    return Fail(error, "ROOT_OPEN_FAILED", "Cannot open drive root");
  chain.emplace_back(opened);
  FILE_ATTRIBUTE_TAG_INFO tag{};
  if (!GetFileInformationByHandleEx(opened, FileAttributeTagInfo, &tag, sizeof(tag)) ||
      (tag.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0)
    return Fail(error, "REPARSE_POINT", "Drive root is a reparse point");
  for (size_t start = 3; start < wide.size();) {
    const size_t end = wide.find(L'\\', start);
    const auto name = wide.substr(start, end == std::wstring::npos ? end : end - start);
    Handle child;
    if (!OpenChild(chain.back().value, name, true, child, error,
                   exclusive ? MutationDirectoryShare() : FILE_SHARE_READ | FILE_SHARE_WRITE)) return false;
    chain.push_back(std::move(child));
    if (end == std::wstring::npos) break;
    start = end + 1;
  }
  FILE_ID_INFO id{};
  if (!GetFileInformationByHandleEx(chain.back().value, FileIdInfo, &id, sizeof(id)))
    return Fail(error, "IDENTITY_FAILED", "Cannot identify opened Vault root");
  if (expected.volumeId != HexBytes(reinterpret_cast<const BYTE*>(&id.VolumeSerialNumber),
                                     sizeof(id.VolumeSerialNumber)) ||
      expected.fileId != HexBytes(id.FileId.Identifier, sizeof(id.FileId.Identifier)))
    return Fail(error, "ROOT_CHANGED", "Vault root identity changed");
  return true;
}

bool HiddenOrExcluded(const std::wstring& name) {
  if (name.empty() || name[0] == L'.') return true;
  std::wstring lower = name;
  for (auto& ch : lower) ch = static_cast<wchar_t>(std::towlower(ch));
  return lower == L"trash" || lower == L"node_modules";
}

bool Markdown(const std::wstring& name) {
  if (name.size() < 3) return false;
  return std::towlower(name[name.size() - 3]) == L'.' &&
         std::towlower(name[name.size() - 2]) == L'm' &&
         std::towlower(name[name.size() - 1]) == L'd';
}

bool FileInfo(HANDLE file, uint64_t& size, Error& error) {
  BY_HANDLE_FILE_INFORMATION info{};
  if (!GetFileInformationByHandle(file, &info))
    return Fail(error, "FILE_INFO_FAILED", "Cannot inspect Vault file");
  if ((info.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0 ||
      (info.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0 ||
      info.nNumberOfLinks != 1)
    return Fail(error, "UNSAFE_FILE", "Vault file is linked or not regular");
  size = (static_cast<uint64_t>(info.nFileSizeHigh) << 32) | info.nFileSizeLow;
  if (size > kMaxMarkdown) return Fail(error, "FILE_TOO_LARGE", "Markdown exceeds 5 MiB");
  return true;
}

struct DirectoryEntry {
  std::wstring name;
  DWORD attributes;
};

struct NameBudget {
  size_t bytes = 0;
  size_t count = 0;
};

bool AppendBounded(nlohmann::json& target, nlohmann::json item,
                   size_t& responseBytes, size_t& itemCount, Error& error) {
  if (itemCount >= kMaxEntries)
    return Fail(error, "TOO_MANY_ENTRIES", "Vault has too many entries");
  const size_t added = item.dump().size() + (target.empty() ? 0 : 1);
  if (added > kMaxResponse - responseBytes)
    return Fail(error, "RESPONSE_TOO_LARGE", "Vault listing exceeds 16 MiB");
  target.push_back(std::move(item));
  responseBytes += added;
  ++itemCount;
  return true;
}

bool Names(HANDLE directory, std::vector<DirectoryEntry>& names,
           NameBudget& budget, Error& error) {
  std::vector<BYTE> buffer(64 * 1024);
  std::set<std::wstring> seen;
  while (true) {
    if (!GetFileInformationByHandleEx(directory, FileIdBothDirectoryInfo,
                                       buffer.data(), static_cast<DWORD>(buffer.size()))) {
      if (GetLastError() == ERROR_NO_MORE_FILES) return true;
      return Fail(error, "LIST_FAILED", "Cannot enumerate Vault directory");
    }
    size_t offset = 0;
    while (true) {
      if (offset + offsetof(FILE_ID_BOTH_DIR_INFO, FileName) > buffer.size())
        return Fail(error, "LIST_FAILED", "Invalid directory entry");
      const auto* item = reinterpret_cast<const FILE_ID_BOTH_DIR_INFO*>(buffer.data() + offset);
      if (item->FileNameLength % sizeof(wchar_t) != 0 ||
          offset + offsetof(FILE_ID_BOTH_DIR_INFO, FileName) + item->FileNameLength > buffer.size())
        return Fail(error, "LIST_FAILED", "Invalid directory name");
      const size_t length = item->FileNameLength / sizeof(wchar_t);
      const bool dot = (length == 1 && item->FileName[0] == L'.') ||
                       (length == 2 && item->FileName[0] == L'.' && item->FileName[1] == L'.');
      if (!dot) {
        if (budget.count >= kMaxEntries)
          return Fail(error, "TOO_MANY_NAMES", "Vault scan has too many names");
        if (item->FileNameLength > kMaxScanNameBytes - budget.bytes)
          return Fail(error, "SCAN_NAME_BUDGET_EXCEEDED", "Vault scan names exceed 4 MiB");
        budget.bytes += item->FileNameLength;
        ++budget.count;
        const std::wstring name(item->FileName, length);
        std::wstring lower = name;
        for (auto& ch : lower) ch = static_cast<wchar_t>(std::towlower(ch));
        if (!seen.insert(lower).second)
          return Fail(error, "CASE_COLLISION", "Vault contains case-colliding names");
        if (names.size() >= kMaxEntries)
          return Fail(error, "TOO_MANY_ENTRIES", "Vault has too many entries");
        names.push_back({name, item->FileAttributes});
      }
      if (item->NextEntryOffset == 0) break;
      if (item->NextEntryOffset < offsetof(FILE_ID_BOTH_DIR_INFO, FileName) ||
          offset + item->NextEntryOffset <= offset)
        return Fail(error, "LIST_FAILED", "Invalid directory entry offset");
      offset += item->NextEntryOffset;
    }
  }
}

bool Scan(HANDLE directory, const std::string& prefix, size_t depth,
          nlohmann::json& entries, nlohmann::json& recovery,
          nlohmann::json& skipped, size_t& responseBytes, size_t& itemCount,
          NameBudget& namesBudget, Error& error) {
  if (depth > kMaxDepth) return Fail(error, "TOO_DEEP", "Vault nesting is too deep");
  std::vector<DirectoryEntry> names;
  if (!Names(directory, names, namesBudget, error)) return false;
  for (const auto& item : names) {
    const auto& name = item.name;
    std::string utf8;
    if (!ToUtf8(name, utf8)) return Fail(error, "INVALID_NAME", "Invalid Vault filename");
    const std::string relative = prefix.empty() ? utf8 : prefix + "/" + utf8;
    if ((name.size() >= 17 && _wcsnicmp(name.c_str(), L".nownote-pending-", 17) == 0) ||
        (name.size() >= 14 && _wcsnicmp(name.c_str(), L".nownote-temp-", 14) == 0)) {
      if (!AppendBounded(recovery, relative, responseBytes, itemCount, error)) return false;
      continue;
    }
    if (HiddenOrExcluded(name)) continue;
    if (!ValidName(name)) return Fail(error, "INVALID_NAME", "Invalid Vault filename");
    if ((item.attributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0) {
      if (!AppendBounded(skipped, {{"relativePath", relative}, {"reason", "reparsePoint"}},
                         responseBytes, itemCount, error)) return false;
      continue;
    }
    Handle child;
    if ((item.attributes & FILE_ATTRIBUTE_DIRECTORY) != 0) {
      if (!OpenChild(directory, name, true, child, error)) return false;
      std::vector<DirectoryEntry> childNames;
      if (!Names(child.value, childNames, namesBudget, error)) return false;
      bool childHasIndex = false;
      for (const auto& candidate : childNames) {
        if (_wcsicmp(candidate.name.c_str(), L"_index.md") != 0 ||
            (candidate.attributes & (FILE_ATTRIBUTE_DIRECTORY | FILE_ATTRIBUTE_REPARSE_POINT)) != 0)
          continue;
        Handle index;
        if (!OpenChild(child.value, candidate.name, false, index, error)) return false;
        uint64_t indexSize = 0;
        if (FileInfo(index.value, indexSize, error)) {
          childHasIndex = true;
        } else if (error.code == "UNSAFE_FILE" || error.code == "FILE_TOO_LARGE") {
          error = {};
        } else {
          return false;
        }
      }
      if (!childHasIndex &&
          !AppendBounded(entries, {{"relativePath", relative}, {"kind", "directory"}, {"size", 0}},
                         responseBytes, itemCount, error)) return false;
      // Enumeration above consumed the directory cursor. Reopen by handle for recursion.
      Handle recursive;
      if (!OpenChild(directory, name, true, recursive, error)) return false;
      if (!Scan(recursive.value, relative, depth + 1, entries, recovery, skipped,
                responseBytes, itemCount, namesBudget, error)) return false;
    } else if (Markdown(name)) {
      Handle file;
      if (!OpenChild(directory, name, false, file, error)) {
        if (error.code == "REPARSE_POINT") {
          error = {};
          if (!AppendBounded(skipped, {{"relativePath", relative}, {"reason", "reparsePoint"}},
                             responseBytes, itemCount, error)) return false;
          continue;
        }
        return false;
      }
      uint64_t size = 0;
      if (!FileInfo(file.value, size, error)) {
        if (error.code == "UNSAFE_FILE" || error.code == "FILE_TOO_LARGE") {
          const char* reason = error.code == "FILE_TOO_LARGE" ? "tooLarge" : "hardlinkAlias";
          error = {};
          if (!AppendBounded(skipped, {{"relativePath", relative}, {"reason", reason}},
                             responseBytes, itemCount, error)) return false;
          continue;
        }
        return false;
      }
      if (!AppendBounded(entries, {{"relativePath", relative}, {"kind", "file"}, {"size", size}},
                         responseBytes, itemCount, error)) return false;
    }
  }
  return true;
}

bool SplitRelative(const std::string& path, std::vector<std::wstring>& parts, Error& error) {
  if (path.empty() || path.size() > 32767 || path.find('\\') != std::string::npos ||
      path.front() == '/' || path.back() == '/')
    return Fail(error, "INVALID_PATH", "Invalid Vault relative path");
  size_t start = 0;
  while (start < path.size()) {
    const size_t end = path.find('/', start);
    std::wstring name;
    if (!ToWide(path.substr(start, end == std::string::npos ? end : end - start), name) ||
        !ValidName(name) || HiddenOrExcluded(name))
      return Fail(error, "INVALID_PATH", "Invalid Vault relative path component");
    parts.push_back(std::move(name));
    if (parts.size() > kMaxDepth) return Fail(error, "TOO_DEEP", "Vault path is too deep");
    if (end == std::string::npos) break;
    start = end + 1;
  }
  if (!Markdown(parts.back())) return Fail(error, "INVALID_PATH", "Only Markdown can be read");
  return true;
}

bool SplitDirectoryRelative(const std::string& path, std::vector<std::wstring>& parts,
                            Error& error) {
  if (path.empty() || path.size() > 32767 || path.find('\\') != std::string::npos ||
      path.front() == '/' || path.back() == '/')
    return Fail(error, "INVALID_PATH", "Invalid Vault directory path");
  size_t start = 0;
  while (start < path.size()) {
    const size_t end = path.find('/', start);
    std::wstring name;
    if (!ToWide(path.substr(start, end == std::string::npos ? end : end - start), name) ||
        !ValidName(name) || HiddenOrExcluded(name))
      return Fail(error, "INVALID_PATH", "Invalid Vault directory component");
    parts.push_back(std::move(name));
    if (parts.size() > kMaxDepth) return Fail(error, "TOO_DEEP", "Vault path is too deep");
    if (end == std::string::npos) break;
    start = end + 1;
  }
  return true;
}

bool ExactName(HANDLE directory, const std::wstring& name,
               NameBudget& budget, Error& error) {
  std::vector<DirectoryEntry> names;
  if (!Names(directory, names, budget, error)) return false;
  if (std::find_if(names.begin(), names.end(), [&](const auto& entry) {
        return entry.name == name;
      }) == names.end())
    return Fail(error, "NAME_CHANGED", "Vault component name does not match");
  return true;
}

std::string Base64(const std::vector<BYTE>& bytes) {
  static constexpr char alphabet[] =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::string output;
  output.reserve(((bytes.size() + 2) / 3) * 4);
  for (size_t i = 0; i < bytes.size(); i += 3) {
    const unsigned triple = (static_cast<unsigned>(bytes[i]) << 16) |
                            (i + 1 < bytes.size() ? static_cast<unsigned>(bytes[i + 1]) << 8 : 0) |
                            (i + 2 < bytes.size() ? bytes[i + 2] : 0);
    output += alphabet[(triple >> 18) & 63];
    output += alphabet[(triple >> 12) & 63];
    output += i + 1 < bytes.size() ? alphabet[(triple >> 6) & 63] : '=';
    output += i + 2 < bytes.size() ? alphabet[triple & 63] : '=';
  }
  return output;
}

bool DecodeBase64(const std::string& encoded, std::vector<BYTE>& bytes, Error& error) {
  if (encoded.size() > ((kMaxMarkdown + 2) / 3) * 4 || encoded.size() % 4 != 0)
    return Fail(error, "INVALID_CONTENT", "Markdown base64 is invalid or too large");
  bytes.reserve(encoded.size() / 4 * 3);
  auto digit = [](char ch) -> int {
    if (ch >= 'A' && ch <= 'Z') return ch - 'A';
    if (ch >= 'a' && ch <= 'z') return ch - 'a' + 26;
    if (ch >= '0' && ch <= '9') return ch - '0' + 52;
    if (ch == '+') return 62;
    if (ch == '/') return 63;
    return -1;
  };
  for (size_t i = 0; i < encoded.size(); i += 4) {
    const bool last = i + 4 == encoded.size();
    const int a = digit(encoded[i]);
    const int b = digit(encoded[i + 1]);
    const int c = encoded[i + 2] == '=' ? 0 : digit(encoded[i + 2]);
    const int d = encoded[i + 3] == '=' ? 0 : digit(encoded[i + 3]);
    if (a < 0 || b < 0 || c < 0 || d < 0 ||
        (!last && (encoded[i + 2] == '=' || encoded[i + 3] == '=')) ||
        (encoded[i + 2] == '=' && encoded[i + 3] != '='))
      return Fail(error, "INVALID_CONTENT", "Markdown base64 is malformed");
    const unsigned value = (static_cast<unsigned>(a) << 18) |
                           (static_cast<unsigned>(b) << 12) |
                           (static_cast<unsigned>(c) << 6) | static_cast<unsigned>(d);
    bytes.push_back(static_cast<BYTE>(value >> 16));
    if (encoded[i + 2] != '=') bytes.push_back(static_cast<BYTE>(value >> 8));
    if (encoded[i + 3] != '=') bytes.push_back(static_cast<BYTE>(value));
  }
  if (bytes.size() > kMaxMarkdown || Base64(bytes) != encoded)
    return Fail(error, "INVALID_CONTENT", "Markdown base64 is not canonical");
  return true;
}

bool HashBytes(const std::vector<BYTE>& bytes, std::string& hash, Error& error) {
  BYTE digest[32]{};
  BCRYPT_ALG_HANDLE algorithm = nullptr;
  const bool ok = BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_SHA256_ALGORITHM,
                                               nullptr, 0) >= 0 &&
                  BCryptHash(algorithm, nullptr, 0, const_cast<BYTE*>(bytes.data()),
                             static_cast<ULONG>(bytes.size()), digest, sizeof(digest)) >= 0;
  if (algorithm) BCryptCloseAlgorithmProvider(algorithm, 0);
  if (!ok) return Fail(error, "HASH_FAILED", "Cannot hash Vault content");
  hash = HexBytes(digest, sizeof(digest));
  return true;
}

bool ReadLocked(HANDLE file, std::vector<BYTE>& bytes, std::string& hash, Error& error) {
  uint64_t size = 0;
  if (!FileInfo(file, size, error)) return false;
  LARGE_INTEGER zero{};
  if (!SetFilePointerEx(file, zero, nullptr, FILE_BEGIN))
    return Fail(error, "READ_FAILED", "Cannot seek Vault file");
  bytes.resize(static_cast<size_t>(size));
  DWORD count = 0;
  if (size && (!ReadFile(file, bytes.data(), static_cast<DWORD>(size), &count, nullptr) ||
               count != size))
    return Fail(error, "READ_FAILED", "Cannot read locked Vault file");
  uint64_t sizeAfter = 0;
  if (!FileInfo(file, sizeAfter, error) || sizeAfter != size)
    return Fail(error, "FILE_CHANGED", "Vault file changed during read");
  return HashBytes(bytes, hash, error);
}

bool WriteBytes(HANDLE file, const std::vector<BYTE>& bytes, Error& error) {
  DWORD written = 0;
  if (!bytes.empty() && (!WriteFile(file, bytes.data(), static_cast<DWORD>(bytes.size()),
                                   &written, nullptr) || written != bytes.size()))
    return Fail(error, "WRITE_FAILED", "Cannot write file content");
  if (!FlushFileBuffers(file)) return Fail(error, "FLUSH_FAILED", "Cannot flush file content");
  return true;
}

bool MakePublishedFileVisible(HANDLE file, Error& error) {
  FILE_BASIC_INFO basic{};
  if (!GetFileInformationByHandleEx(file, FileBasicInfo, &basic, sizeof(basic)))
    return Fail(error, "ATTRIBUTES_FAILED", "Cannot inspect temporary file attributes");
  basic.FileAttributes &= ~FILE_ATTRIBUTE_HIDDEN;
  if (basic.FileAttributes == 0) basic.FileAttributes = FILE_ATTRIBUTE_NORMAL;
  if (!SetFileInformationByHandle(file, FileBasicInfo, &basic, sizeof(basic)))
    return Fail(error, "ATTRIBUTES_FAILED", "Cannot publish a visible Vault file");
  return true;
}

bool SameId(HANDLE a, HANDLE b, Error& error) {
  FILE_ID_INFO left{}, right{};
  if (!GetFileInformationByHandleEx(a, FileIdInfo, &left, sizeof(left)) ||
      !GetFileInformationByHandleEx(b, FileIdInfo, &right, sizeof(right))) {
    Fail(error, "IDENTITY_FAILED", "Cannot compare directory identities");
    return false;
  }
  return left.VolumeSerialNumber == right.VolumeSerialNumber &&
         std::memcmp(left.FileId.Identifier, right.FileId.Identifier,
                     sizeof(left.FileId.Identifier)) == 0;
}

bool HandlePath(HANDLE handle, std::string& path, Error& error) {
  const DWORD size = GetFinalPathNameByHandleW(handle, nullptr, 0, FILE_NAME_NORMALIZED);
  if (size == 0 || size > 32767) return Fail(error, "PATH_FAILED", "Cannot locate recovery file");
  std::wstring wide(size + 1, L'\0');
  const DWORD length = GetFinalPathNameByHandleW(handle, wide.data(),
                                                  static_cast<DWORD>(wide.size()),
                                                  FILE_NAME_NORMALIZED);
  if (length == 0 || length > size) return Fail(error, "PATH_FAILED", "Cannot locate recovery file");
  wide.resize(length);
#ifdef NOW_VAULT_MUTATION_EXPERIMENT
  char inject[4]{};
  size_t injectLength = 0;
  if (wide.find(L".nownote-preserved-") != std::wstring::npos &&
      getenv_s(&injectLength, inject, sizeof(inject),
               "NOWNOTE_VAULT_TEST_FAIL_PRESERVED_PATH_LOOKUP") == 0 && injectLength > 0)
    return Fail(error, "PATH_FAILED", "Injected preserved path lookup failure");
#endif
  return ToUtf8(wide, path) || Fail(error, "PATH_FAILED", "Cannot encode recovery path");
}

bool ChildPath(HANDLE parent, const std::wstring& name, std::string& path, Error& error) {
  std::string parentPath, utf8Name;
  if (!HandlePath(parent, parentPath, error) || !ToUtf8(name, utf8Name))
    return Fail(error, "PATH_FAILED", "Cannot prepare recovery path");
  path = parentPath;
  if (path.empty() || path.back() != '\\') path += '\\';
  path += utf8Name;
  return true;
}

bool RandomName(const wchar_t* prefix, std::wstring& name, Error& error) {
  BYTE random[16]{};
  if (BCryptGenRandom(nullptr, random, sizeof(random), BCRYPT_USE_SYSTEM_PREFERRED_RNG) < 0)
    return Fail(error, "RANDOM_FAILED", "Cannot create unique recovery name");
  static constexpr wchar_t hex[] = L"0123456789abcdef";
  name = prefix;
  for (BYTE value : random) {
    name += hex[value >> 4];
    name += hex[value & 15];
  }
  return true;
}

bool CreateRelative(HANDLE parent, const std::wstring& name, bool directory,
                    Handle& created, Error& error) {
  if (!ValidName(name)) return Fail(error, "INVALID_PATH", "Invalid created name");
  UNICODE_STRING unicode{};
  unicode.Buffer = const_cast<PWSTR>(name.c_str());
  unicode.Length = static_cast<USHORT>(name.size() * sizeof(wchar_t));
  unicode.MaximumLength = unicode.Length;
  OBJECT_ATTRIBUTES attributes{};
  InitializeObjectAttributes(&attributes, &unicode, OBJ_CASE_INSENSITIVE | OBJ_DONT_REPARSE,
                             parent, nullptr);
  IO_STATUS_BLOCK io{};
  HANDLE opened = INVALID_HANDLE_VALUE;
  const NTSTATUS status = NtCreateFile(
      &opened,
      (directory ? FILE_LIST_DIRECTORY : FILE_READ_DATA | FILE_WRITE_DATA | FILE_WRITE_ATTRIBUTES) |
          FILE_READ_ATTRIBUTES | DELETE | SYNCHRONIZE,
      &attributes, &io, nullptr, directory ? FILE_ATTRIBUTE_DIRECTORY : FILE_ATTRIBUTE_HIDDEN,
      directory ? MutationDirectoryShare() : FILE_SHARE_READ, FILE_CREATE,
      (directory ? FILE_DIRECTORY_FILE : FILE_NON_DIRECTORY_FILE) |
          FILE_OPEN_REPARSE_POINT | FILE_SYNCHRONOUS_IO_NONALERT,
      nullptr, 0);
  if (status < 0 || opened == INVALID_HANDLE_VALUE || opened == nullptr)
    return Fail(error, "CREATE_FAILED", "Cannot create file without replacing an existing name");
  created = Handle(opened);
  return true;
}

bool OpenLockedFile(HANDLE parent, const std::wstring& name, Handle& file, Error& error) {
  UNICODE_STRING unicode{};
  unicode.Buffer = const_cast<PWSTR>(name.c_str());
  unicode.Length = static_cast<USHORT>(name.size() * sizeof(wchar_t));
  unicode.MaximumLength = unicode.Length;
  OBJECT_ATTRIBUTES attributes{};
  InitializeObjectAttributes(&attributes, &unicode, OBJ_CASE_INSENSITIVE | OBJ_DONT_REPARSE,
                             parent, nullptr);
  IO_STATUS_BLOCK io{};
  HANDLE opened = INVALID_HANDLE_VALUE;
  const NTSTATUS status = NtCreateFile(
      &opened, FILE_READ_DATA | FILE_READ_ATTRIBUTES | DELETE | SYNCHRONIZE,
      &attributes, &io, nullptr, FILE_ATTRIBUTE_NORMAL, FILE_SHARE_READ, FILE_OPEN,
      FILE_NON_DIRECTORY_FILE | FILE_OPEN_REPARSE_POINT | FILE_SYNCHRONOUS_IO_NONALERT,
      nullptr, 0);
  if (status < 0 || opened == INVALID_HANDLE_VALUE || opened == nullptr)
    return Fail(error, "SOURCE_LOCKED", "Cannot lock Vault file against concurrent writing");
  file = Handle(opened);
  FILE_ATTRIBUTE_TAG_INFO tag{};
  if (!GetFileInformationByHandleEx(file.value, FileAttributeTagInfo, &tag, sizeof(tag)) ||
      (tag.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0)
    return Fail(error, "REPARSE_POINT", "Vault file is a reparse point");
  return true;
}

bool RenameRelative(HANDLE source, HANDLE targetParent, const std::wstring& targetName,
                    Error& error) {
  if (!ValidName(targetName)) return Fail(error, "INVALID_PATH", "Invalid rename target");
  const size_t nameBytes = targetName.size() * sizeof(wchar_t);
  const size_t bufferSize = sizeof(FILE_RENAME_INFO) + nameBytes;
  auto buffer = std::make_unique<BYTE[]>(bufferSize);
  std::memset(buffer.get(), 0, bufferSize);
  auto* info = reinterpret_cast<FILE_RENAME_INFO*>(buffer.get());
  info->ReplaceIfExists = FALSE;
  info->RootDirectory = targetParent;
  info->FileNameLength = static_cast<DWORD>(nameBytes);
  std::memcpy(info->FileName, targetName.data(), nameBytes);
  using SetInformation = NTSTATUS(NTAPI*)(HANDLE, PIO_STATUS_BLOCK, PVOID, ULONG, ULONG);
  const HMODULE ntdll = GetModuleHandleW(L"ntdll.dll");
  const auto setInformation = ntdll ? reinterpret_cast<SetInformation>(
      GetProcAddress(ntdll, "NtSetInformationFile")) : nullptr;
  IO_STATUS_BLOCK io{};
  const NTSTATUS status = setInformation
      ? setInformation(source, &io, info, static_cast<ULONG>(bufferSize), 10)
      : static_cast<NTSTATUS>(0xC0000002);
  if (status < 0) {
    error = {"RENAME_FAILED", "Cannot rename without replacing an existing name (NT " +
                                  std::to_string(static_cast<unsigned long>(status)) + ")"};
    return false;
  }
  return true;
}

bool NamePresent(HANDLE parent, const std::wstring& name, bool& present, Error& error) {
  std::vector<DirectoryEntry> names;
  NameBudget budget;
  if (!Names(parent, names, budget, error)) return false;
  present = false;
  for (const auto& entry : names) {
    if (_wcsicmp(entry.name.c_str(), name.c_str()) == 0) {
      if (entry.name != name)
        return Fail(error, "CASE_COLLISION", "Vault name differs only by case");
      present = true;
    }
  }
  return true;
}

}  // namespace

bool List(const std::string& root, const RootIdentity& expected, nlohmann::json& result,
          Error& error) {
  std::vector<Handle> chain;
  if (!OpenRoot(root, expected, chain, error)) return false;
  nlohmann::json entries = nlohmann::json::array();
  nlohmann::json recovery = nlohmann::json::array();
  nlohmann::json skipped = nlohmann::json::array();
  size_t responseBytes = nlohmann::json({{"ok", true}, {"result", {
      {"entries", nlohmann::json::array()}, {"recovery", nlohmann::json::array()},
      {"skipped", nlohmann::json::array()}}}}).dump().size();
  size_t itemCount = 0;
  NameBudget namesBudget;
  if (!Scan(chain.back().value, "", 0, entries, recovery, skipped,
            responseBytes, itemCount, namesBudget, error)) return false;
  std::sort(entries.begin(), entries.end(), [](const auto& a, const auto& b) {
    return a["relativePath"].template get<std::string>() < b["relativePath"].template get<std::string>();
  });
  std::sort(skipped.begin(), skipped.end(), [](const auto& a, const auto& b) {
    return a["relativePath"].template get<std::string>() < b["relativePath"].template get<std::string>();
  });
  result = {{"entries", std::move(entries)}, {"recovery", std::move(recovery)},
            {"skipped", std::move(skipped)}};
  return true;
}

bool Read(const std::string& root, const RootIdentity& expected,
          const std::string& relativePath, nlohmann::json& result, Error& error) {
  std::vector<std::wstring> parts;
  if (!SplitRelative(relativePath, parts, error)) return false;
  std::vector<Handle> chain;
  if (!OpenRoot(root, expected, chain, error)) return false;
  NameBudget namesBudget;
  for (size_t i = 0; i + 1 < parts.size(); ++i) {
    Handle child;
    if (!ExactName(chain.back().value, parts[i], namesBudget, error)) return false;
    if (!OpenChild(chain.back().value, parts[i], true, child, error)) return false;
    chain.push_back(std::move(child));
  }
  Handle file;
  if (!ExactName(chain.back().value, parts.back(), namesBudget, error)) return false;
  if (!OpenChild(chain.back().value, parts.back(), false, file, error)) return false;
  uint64_t size = 0;
  if (!FileInfo(file.value, size, error)) return false;
  std::vector<BYTE> bytes(static_cast<size_t>(size));
  DWORD read = 0;
  if (size != 0 && (!ReadFile(file.value, bytes.data(), static_cast<DWORD>(size), &read, nullptr) ||
                    read != size))
    return Fail(error, "READ_FAILED", "Cannot read Vault file");
  uint64_t sizeAfter = 0;
  if (!FileInfo(file.value, sizeAfter, error) || sizeAfter != size)
    return Fail(error, "FILE_CHANGED", "Vault file changed during read");
  BYTE digest[32]{};
  BCRYPT_ALG_HANDLE algorithm = nullptr;
  const bool hashOk = BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_SHA256_ALGORITHM,
                                                   nullptr, 0) >= 0 &&
                      BCryptHash(algorithm, nullptr, 0, bytes.data(),
                                 static_cast<ULONG>(bytes.size()), digest, sizeof(digest)) >= 0;
  if (algorithm) BCryptCloseAlgorithmProvider(algorithm, 0);
  if (!hashOk) return Fail(error, "HASH_FAILED", "Cannot hash Vault file");
  result = {{"contentBase64", Base64(bytes)}, {"fileHash", HexBytes(digest, sizeof(digest))}};
  return true;
}

bool Write(const std::string& root, const RootIdentity& expected,
           const std::string& relativePath, const std::optional<std::string>& expectedHash,
           const std::string& contentBase64, const std::string& backupDir,
           nlohmann::json& result, Error& error) {
  result = {{"relativePath", relativePath}, {"fileHash", nullptr}, {"backupPath", nullptr},
            {"preservedPath", nullptr}, {"pendingPath", nullptr}, {"tempPath", nullptr},
            {"createdDirs", nlohmann::json::array()}};
  std::vector<std::wstring> parts;
  if (!SplitRelative(relativePath, parts, error)) return false;
  if (expectedHash &&
      (expectedHash->size() != 64 || !std::all_of(expectedHash->begin(), expectedHash->end(),
        [](char ch) { return (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f'); })))
    return Fail(error, "INVALID_HASH", "Expected SHA-256 must be lowercase hexadecimal");
  std::vector<BYTE> newBytes;
  if (!DecodeBase64(contentBase64, newBytes, error)) return false;
  std::string newHash;
  if (!HashBytes(newBytes, newHash, error)) return false;
  result["fileHash"] = newHash;
#ifdef NOW_VAULT_MUTATION_EXPERIMENT
  char notify[4]{};
  size_t notifyLength = 0;
  if (getenv_s(&notifyLength, notify, sizeof(notify),
               "NOWNOTE_VAULT_TEST_NOTIFY_LOCK_WAIT") == 0 && notifyLength > 0) {
    std::fputs("VAULT_TEST_LOCK_WAIT\n", stderr);
    std::fflush(stderr);
  }
#endif

  MutationMutex mutationLock;
  if (!mutationLock.Acquire(expected, error)) return false;

  nlohmann::json listing;
  if (!List(root, expected, listing, error)) return false;
  if (!listing["recovery"].empty())
    return Fail(error, "PENDING_RECOVERY", "Vault contains a pending recovery file");
#ifdef NOW_VAULT_MUTATION_EXPERIMENT
  PauseForTest("NOWNOTE_VAULT_TEST_PAUSE_AFTER_SCAN_MS", "VAULT_TEST_SCAN_READY");
#endif

  std::vector<Handle> vaultChain;
  if (!OpenRoot(root, expected, vaultChain, error, true)) return false;
  RootHandles backupProbe;
  RootIdentity backupIdentity;
  if (!backupProbe.Open(backupDir, backupIdentity, error))
    return Fail(error, "BACKUP_UNAVAILABLE", "Cannot open trusted backup directory");
  std::vector<Handle> backupChain;
  if (!OpenRoot(backupDir, backupIdentity, backupChain, error, true)) return false;
  for (const auto& component : backupChain) {
    error = {};
    if (SameId(component.value, vaultChain.back().value, error))
      return Fail(error, "BACKUP_INSIDE_VAULT", "Backup directory is inside Vault");
    if (!error.code.empty()) return false;
  }

  nlohmann::json latestListing;
  if (!List(root, expected, latestListing, error)) return false;
  if (!latestListing["recovery"].empty())
    return Fail(error, "PENDING_RECOVERY", "Vault contains a pending recovery file");
#ifdef NOW_VAULT_MUTATION_EXPERIMENT
  PauseForTest("NOWNOTE_VAULT_TEST_PAUSE_AFTER_RECOVERY_MS", "VAULT_TEST_RECOVERY_READY");
#endif

  std::string parentRelative;
  for (size_t i = 0; i + 1 < parts.size(); ++i) {
    bool exists = false;
    if (!NamePresent(vaultChain.back().value, parts[i], exists, error)) return false;
    Handle child;
    if (exists) {
      if (!OpenChild(vaultChain.back().value, parts[i], true, child, error,
                     MutationDirectoryShare())) return false;
    } else {
      if (!CreateRelative(vaultChain.back().value, parts[i], true, child, error)) return false;
      std::string component;
      if (!ToUtf8(parts[i], component))
        return Fail(error, "INVALID_PATH", "Cannot encode created directory");
      parentRelative = parentRelative.empty() ? component : parentRelative + "/" + component;
      result["createdDirs"].push_back(parentRelative);
    }
    if (exists) {
      std::string component;
      if (!ToUtf8(parts[i], component))
        return Fail(error, "INVALID_PATH", "Cannot encode Vault directory");
      parentRelative = parentRelative.empty() ? component : parentRelative + "/" + component;
    }
    vaultChain.push_back(std::move(child));
  }
  const HANDLE parent = vaultChain.back().value;
#ifdef NOW_VAULT_MUTATION_EXPERIMENT
  PauseForTest("NOWNOTE_VAULT_TEST_PAUSE_AFTER_PARENT_MS", "VAULT_TEST_PARENT_READY");
#endif
  bool exists = false;
  if (!NamePresent(parent, parts.back(), exists, error)) return false;
  if (exists != expectedHash.has_value())
    return Fail(error, "HASH_MISMATCH", "Vault target changed since preview");
  Handle source;
  std::vector<BYTE> oldBytes;
  std::string oldHash;
  if (exists) {
    if (!OpenLockedFile(parent, parts.back(), source, error) ||
        !ReadLocked(source.value, oldBytes, oldHash, error)) return false;
    if (oldHash != *expectedHash)
      return Fail(error, "HASH_MISMATCH", "Vault target changed since preview");
  }

  Handle backup;
  if (exists) {
    std::wstring backupName;
    if (!RandomName(L".nownote-backup-", backupName, error) ||
        !CreateRelative(backupChain.back().value, backupName, false, backup, error)) return false;
    std::string backupPath;
    if (!HandlePath(backup.value, backupPath, error)) return false;
    result["backupPath"] = backupPath;
    if (!WriteBytes(backup.value, oldBytes, error)) return false;
    std::vector<BYTE> checked;
    std::string checkedHash;
    if (!ReadLocked(source.value, checked, checkedHash, error) || checkedHash != oldHash)
      return Fail(error, "FILE_CHANGED", "Vault file changed before parking");
  }

  std::wstring tempName;
  Handle temp;
  if (!RandomName(L".nownote-temp-", tempName, error) ||
      !CreateRelative(parent, tempName, false, temp, error)) return false;
  std::string tempPath;
  if (!HandlePath(temp.value, tempPath, error)) return false;
  result["tempPath"] = tempPath;
  if (!WriteBytes(temp.value, newBytes, error) ||
      !MakePublishedFileVisible(temp.value, error)) return false;

  std::wstring pendingName;
  if (exists) {
    std::string pendingPath;
    if (!RandomName(L".nownote-pending-", pendingName, error) ||
        !ChildPath(parent, pendingName, pendingPath, error) ||
        !RenameRelative(source.value, parent, pendingName, error)) return false;
    result["pendingPath"] = pendingPath;
#ifdef NOW_VAULT_MUTATION_EXPERIMENT
    PauseForTest("NOWNOTE_VAULT_TEST_PAUSE_AFTER_PARK_MS", "VAULT_TEST_PARKED_READY");
#endif
  }

  if (!RenameRelative(temp.value, parent, parts.back(), error)) {
    if (exists) {
      Error restoreError;
      if (RenameRelative(source.value, parent, parts.back(), restoreError)) {
        result["pendingPath"] = nullptr;
      } else {
        error.message += "; original remains at pendingPath";
      }
    }
    return false;
  }
  result["tempPath"] = nullptr;
  if (exists) {
    std::wstring preservedName;
    std::string preservedPath;
    if (!RandomName(L".nownote-preserved-", preservedName, error) ||
        !ChildPath(parent, preservedName, preservedPath, error) ||
        !RenameRelative(source.value, parent, preservedName, error)) return false;
    result["preservedPath"] = preservedPath;
    result["pendingPath"] = nullptr;
  }
#ifdef NOW_VAULT_MUTATION_EXPERIMENT
  PauseForTest("NOWNOTE_VAULT_TEST_PAUSE_AFTER_FINAL_RENAME_MS",
               "VAULT_TEST_FINAL_RENAME_READY");
#endif
  return true;
}

bool Rollback(const std::string& root, const RootIdentity& expected,
              const std::string& relativePath, const std::string& expectedHash,
              const std::string& backupDir, nlohmann::json& result, Error& error) {
  result = {{"relativePath", relativePath}, {"fileHash", nullptr}, {"backupPath", nullptr},
            {"preservedPath", nullptr}, {"pendingPath", nullptr},
            {"createdDirs", nlohmann::json::array()}};
  std::vector<std::wstring> parts;
  if (!SplitRelative(relativePath, parts, error)) return false;
  if (expectedHash.size() != 64 ||
      !std::all_of(expectedHash.begin(), expectedHash.end(), [](char ch) {
        return (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f');
      }))
    return Fail(error, "INVALID_HASH", "Expected SHA-256 must be lowercase hexadecimal");

  MutationMutex mutationLock;
  if (!mutationLock.Acquire(expected, error)) return false;
  nlohmann::json listing;
  if (!List(root, expected, listing, error)) return false;
  if (!listing["recovery"].empty())
    return Fail(error, "PENDING_RECOVERY", "Vault contains a pending recovery file");

  std::vector<Handle> vaultChain;
  if (!OpenRoot(root, expected, vaultChain, error, true)) return false;
  RootHandles backupProbe;
  RootIdentity backupIdentity;
  if (!backupProbe.Open(backupDir, backupIdentity, error))
    return Fail(error, "BACKUP_UNAVAILABLE", "Cannot open trusted backup directory");
  std::vector<Handle> backupChain;
  if (!OpenRoot(backupDir, backupIdentity, backupChain, error, true)) return false;
  for (const auto& component : backupChain) {
    error = {};
    if (SameId(component.value, vaultChain.back().value, error))
      return Fail(error, "BACKUP_INSIDE_VAULT", "Backup directory is inside Vault");
    if (!error.code.empty()) return false;
  }

  nlohmann::json latestListing;
  if (!List(root, expected, latestListing, error)) return false;
  if (!latestListing["recovery"].empty())
    return Fail(error, "PENDING_RECOVERY", "Vault contains a pending recovery file");

  const HANDLE vaultRoot = vaultChain.back().value;
  for (size_t i = 0; i + 1 < parts.size(); ++i) {
    bool exists = false;
    if (!NamePresent(vaultChain.back().value, parts[i], exists, error)) return false;
    if (!exists) return Fail(error, "SOURCE_MISSING", "Vault parent does not exist");
    Handle child;
    if (!OpenChild(vaultChain.back().value, parts[i], true, child, error,
                   MutationDirectoryShare())) return false;
    vaultChain.push_back(std::move(child));
  }
  const HANDLE parent = vaultChain.back().value;
  bool exists = false;
  if (!NamePresent(parent, parts.back(), exists, error)) return false;
  if (!exists) return Fail(error, "SOURCE_MISSING", "Vault entry does not exist");
  Handle source;
  std::vector<BYTE> original;
  std::string actualHash;
  if (!OpenLockedFile(parent, parts.back(), source, error) ||
      !ReadLocked(source.value, original, actualHash, error)) return false;
  if (actualHash != expectedHash)
    return Fail(error, "HASH_MISMATCH", "Vault entry changed since preview");
  result["fileHash"] = actualHash;

  std::wstring backupName;
  Handle backup;
  if (!RandomName(L".nownote-backup-", backupName, error) ||
      !CreateRelative(backupChain.back().value, backupName, false, backup, error)) return false;
  std::string backupPath;
  if (!HandlePath(backup.value, backupPath, error)) return false;
  result["backupPath"] = backupPath;
  if (!WriteBytes(backup.value, original, error)) return false;
  std::vector<BYTE> checked;
  std::string checkedHash;
  if (!ReadLocked(source.value, checked, checkedHash, error) || checkedHash != actualHash)
    return Fail(error, "FILE_CHANGED", "Vault entry changed before rollback");

  std::wstring pendingName;
  std::string pendingPath;
  if (!RandomName(L".nownote-pending-", pendingName, error) ||
      !ChildPath(parent, pendingName, pendingPath, error) ||
      !RenameRelative(source.value, parent, pendingName, error)) return false;
  result["pendingPath"] = pendingPath;
#ifdef NOW_VAULT_MUTATION_EXPERIMENT
  PauseForTest("NOWNOTE_VAULT_TEST_PAUSE_ROLLBACK_AFTER_PARK_MS",
               "VAULT_TEST_ROLLBACK_PARKED_READY");
#endif
  std::wstring preservedName;
  std::string preservedPath;
  if (!RandomName(L".nownote-preserved-", preservedName, error) ||
      !ChildPath(vaultRoot, preservedName, preservedPath, error) ||
      !RenameRelative(source.value, vaultRoot, preservedName, error)) {
    Error restoreError;
    if (RenameRelative(source.value, parent, parts.back(), restoreError))
      result["pendingPath"] = nullptr;
    else
      error.message += "; original remains at pendingPath";
    return false;
  }
  result["preservedPath"] = preservedPath;
  result["pendingPath"] = nullptr;
#ifdef NOW_VAULT_MUTATION_EXPERIMENT
  PauseForTest("NOWNOTE_VAULT_TEST_PAUSE_AFTER_FINAL_RENAME_MS",
               "VAULT_TEST_FINAL_RENAME_READY");
#endif
  return true;
}

bool Move(const std::string& root, const RootIdentity& expected,
          const std::string& from, const std::string& to,
          const std::string& expectedHash, const std::string& backupDir,
          nlohmann::json& result, Error& error) {
  result = {{"relativePath", to}, {"fileHash", nullptr}, {"backupPath", nullptr},
            {"preservedPath", nullptr}, {"pendingPath", nullptr}, {"tempPath", nullptr},
            {"createdDirs", nlohmann::json::array()}};
  std::vector<std::wstring> sourceParts, targetParts;
  if (!SplitRelative(from, sourceParts, error) ||
      !SplitRelative(to, targetParts, error)) return false;
  if (sourceParts.size() == targetParts.size() &&
      std::equal(sourceParts.begin(), sourceParts.end(), targetParts.begin(),
                 [](const auto& a, const auto& b) { return _wcsicmp(a.c_str(), b.c_str()) == 0; }))
    return Fail(error, "TARGET_COLLISION", "Move target is the source entry");
  if (expectedHash.size() != 64 ||
      !std::all_of(expectedHash.begin(), expectedHash.end(), [](char ch) {
        return (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f');
      }))
    return Fail(error, "INVALID_HASH", "Expected SHA-256 must be lowercase hexadecimal");

  MutationMutex mutationLock;
  if (!mutationLock.Acquire(expected, error)) return false;
  nlohmann::json listing;
  if (!List(root, expected, listing, error)) return false;
  if (!listing["recovery"].empty())
    return Fail(error, "PENDING_RECOVERY", "Vault contains a pending recovery file");

  std::vector<Handle> sourceChain, targetChain;
  if (!OpenRoot(root, expected, sourceChain, error, true) ||
      !OpenRoot(root, expected, targetChain, error, true)) return false;
  RootHandles backupProbe;
  RootIdentity backupIdentity;
  if (!backupProbe.Open(backupDir, backupIdentity, error))
    return Fail(error, "BACKUP_UNAVAILABLE", "Cannot open trusted backup directory");
  std::vector<Handle> backupChain;
  if (!OpenRoot(backupDir, backupIdentity, backupChain, error, true)) return false;
  for (const auto& component : backupChain) {
    error = {};
    if (SameId(component.value, sourceChain.back().value, error))
      return Fail(error, "BACKUP_INSIDE_VAULT", "Backup directory is inside Vault");
    if (!error.code.empty()) return false;
  }
  nlohmann::json latestListing;
  if (!List(root, expected, latestListing, error)) return false;
  if (!latestListing["recovery"].empty())
    return Fail(error, "PENDING_RECOVERY", "Vault contains a pending recovery file");

  for (size_t i = 0; i + 1 < sourceParts.size(); ++i) {
    bool exists = false;
    if (!NamePresent(sourceChain.back().value, sourceParts[i], exists, error)) return false;
    if (!exists) return Fail(error, "SOURCE_MISSING", "Move source parent does not exist");
    Handle child;
    if (!OpenChild(sourceChain.back().value, sourceParts[i], true, child, error,
                   MutationDirectoryShare())) return false;
    sourceChain.push_back(std::move(child));
  }
  const HANDLE sourceParent = sourceChain.back().value;
  bool sourceExists = false;
  if (!NamePresent(sourceParent, sourceParts.back(), sourceExists, error)) return false;
  if (!sourceExists) return Fail(error, "SOURCE_MISSING", "Move source does not exist");
  Handle source;
  std::vector<BYTE> original;
  std::string actualHash;
  if (!OpenLockedFile(sourceParent, sourceParts.back(), source, error) ||
      !ReadLocked(source.value, original, actualHash, error)) return false;
  if (actualHash != expectedHash)
    return Fail(error, "HASH_MISMATCH", "Move source changed since preview");
  result["fileHash"] = actualHash;

  std::string parentRelative;
  for (size_t i = 0; i + 1 < targetParts.size(); ++i) {
    bool exists = false;
    if (!NamePresent(targetChain.back().value, targetParts[i], exists, error)) return false;
    Handle child;
    if (exists) {
      if (!OpenChild(targetChain.back().value, targetParts[i], true, child, error,
                     MutationDirectoryShare())) return false;
    } else {
      if (!CreateRelative(targetChain.back().value, targetParts[i], true, child, error)) return false;
    }
    std::string component;
    if (!ToUtf8(targetParts[i], component))
      return Fail(error, "INVALID_PATH", "Cannot encode move target directory");
    parentRelative = parentRelative.empty() ? component : parentRelative + "/" + component;
    if (!exists) result["createdDirs"].push_back(parentRelative);
    targetChain.push_back(std::move(child));
  }
  const HANDLE targetParent = targetChain.back().value;
  bool targetExists = false;
  if (!NamePresent(targetParent, targetParts.back(), targetExists, error)) return false;
  if (targetExists) return Fail(error, "TARGET_COLLISION", "Move target already exists");

  std::wstring backupName;
  Handle backup;
  if (!RandomName(L".nownote-backup-", backupName, error) ||
      !CreateRelative(backupChain.back().value, backupName, false, backup, error)) return false;
  std::string backupPath;
  if (!HandlePath(backup.value, backupPath, error)) return false;
  result["backupPath"] = backupPath;
  if (!WriteBytes(backup.value, original, error)) return false;
  std::vector<BYTE> checked;
  std::string checkedHash;
  if (!ReadLocked(source.value, checked, checkedHash, error) || checkedHash != actualHash)
    return Fail(error, "FILE_CHANGED", "Move source changed before parking");

  std::wstring tempName;
  Handle temp;
  if (!RandomName(L".nownote-temp-", tempName, error) ||
      !CreateRelative(targetParent, tempName, false, temp, error)) return false;
  std::string tempPath;
  if (!HandlePath(temp.value, tempPath, error)) return false;
  result["tempPath"] = tempPath;
  if (!WriteBytes(temp.value, original, error) ||
      !MakePublishedFileVisible(temp.value, error)) return false;

  std::wstring pendingName;
  std::string pendingPath;
  if (!RandomName(L".nownote-pending-", pendingName, error) ||
      !ChildPath(sourceParent, pendingName, pendingPath, error) ||
      !RenameRelative(source.value, sourceParent, pendingName, error)) return false;
  result["pendingPath"] = pendingPath;
#ifdef NOW_VAULT_MUTATION_EXPERIMENT
  PauseForTest("NOWNOTE_VAULT_TEST_PAUSE_MOVE_AFTER_PARK_MS", "VAULT_TEST_MOVE_PARKED_READY");
#endif
  if (!RenameRelative(temp.value, targetParent, targetParts.back(), error)) {
    Error restoreError;
    if (RenameRelative(source.value, sourceParent, sourceParts.back(), restoreError))
      result["pendingPath"] = nullptr;
    else
      error.message += "; source remains at pendingPath";
    return false;
  }
  result["tempPath"] = nullptr;
  std::wstring preservedName;
  std::string preservedPath;
  if (!RandomName(L".nownote-preserved-", preservedName, error) ||
      !ChildPath(sourceParent, preservedName, preservedPath, error) ||
      !RenameRelative(source.value, sourceParent, preservedName, error)) return false;
  result["preservedPath"] = preservedPath;
  result["pendingPath"] = nullptr;
#ifdef NOW_VAULT_MUTATION_EXPERIMENT
  PauseForTest("NOWNOTE_VAULT_TEST_PAUSE_AFTER_FINAL_RENAME_MS",
               "VAULT_TEST_FINAL_RENAME_READY");
#endif
  return true;
}

bool RemoveEmptyDirs(const std::string& root, const RootIdentity& expected,
                     const std::vector<std::string>& createdDirs,
                     nlohmann::json& result, Error& error) {
  result = {{"removed", nlohmann::json::array()}, {"deferred", true}};
  // Caller-supplied paths are not proof of folder ownership; cleanup is deferred.
  (void)root;
  (void)expected;
  (void)createdDirs;
  (void)error;
  return true;
}

}  // namespace vault
