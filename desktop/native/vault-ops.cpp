#include "vault-ops.hpp"

#include <bcrypt.h>
#include <winternl.h>

#include <algorithm>
#include <cctype>
#include <cwctype>
#include <iomanip>
#include <set>
#include <sstream>
#include <vector>

namespace vault {
namespace {

constexpr uint64_t kMaxMarkdown = 5ULL * 1024 * 1024;
constexpr size_t kMaxDepth = 128;
constexpr size_t kMaxEntries = 100000;

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
               Error& error) {
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
      &opened, (directory ? FILE_LIST_DIRECTORY : FILE_READ_DATA) | FILE_READ_ATTRIBUTES | SYNCHRONIZE,
      &attributes, &io, nullptr, FILE_ATTRIBUTE_NORMAL,
      directory ? FILE_SHARE_READ | FILE_SHARE_WRITE : FILE_SHARE_READ,
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
              std::vector<Handle>& chain, Error& error) {
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
      nullptr, FILE_ATTRIBUTE_NORMAL, FILE_SHARE_READ | FILE_SHARE_WRITE, FILE_OPEN,
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
    if (!OpenChild(chain.back().value, name, true, child, error)) return false;
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

bool Names(HANDLE directory, std::vector<DirectoryEntry>& names, Error& error) {
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
      const std::wstring name(item->FileName, item->FileNameLength / sizeof(wchar_t));
      if (name != L"." && name != L"..") {
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
          nlohmann::json& skipped, Error& error) {
  if (depth > kMaxDepth) return Fail(error, "TOO_DEEP", "Vault nesting is too deep");
  std::vector<DirectoryEntry> names;
  if (!Names(directory, names, error)) return false;
  for (const auto& item : names) {
    const auto& name = item.name;
    std::string utf8;
    if (!ToUtf8(name, utf8)) return Fail(error, "INVALID_NAME", "Invalid Vault filename");
    const std::string relative = prefix.empty() ? utf8 : prefix + "/" + utf8;
    if (name.size() >= 17 && _wcsnicmp(name.c_str(), L".nownote-pending-", 17) == 0) {
      recovery.push_back(relative);
      continue;
    }
    if (HiddenOrExcluded(name)) continue;
    if (!ValidName(name)) return Fail(error, "INVALID_NAME", "Invalid Vault filename");
    if ((item.attributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0) {
      skipped.push_back({{"relativePath", relative}, {"reason", "reparsePoint"}});
      continue;
    }
    Handle child;
    if ((item.attributes & FILE_ATTRIBUTE_DIRECTORY) != 0) {
      if (!OpenChild(directory, name, true, child, error)) return false;
      std::vector<DirectoryEntry> childNames;
      if (!Names(child.value, childNames, error)) return false;
      bool childHasIndex = false;
      for (const auto& candidate : childNames)
        if (_wcsicmp(candidate.name.c_str(), L"_index.md") == 0) childHasIndex = true;
      if (!childHasIndex) entries.push_back({{"relativePath", relative}, {"kind", "directory"}, {"size", 0}});
      // Enumeration above consumed the directory cursor. Reopen by handle for recursion.
      Handle recursive;
      if (!OpenChild(directory, name, true, recursive, error)) return false;
      if (!Scan(recursive.value, relative, depth + 1, entries, recovery, skipped, error)) return false;
    } else if (Markdown(name)) {
      Handle file;
      if (!OpenChild(directory, name, false, file, error)) {
        if (error.code == "REPARSE_POINT") {
          skipped.push_back({{"relativePath", relative}, {"reason", "reparsePoint"}});
          error = {};
          continue;
        }
        return false;
      }
      uint64_t size = 0;
      if (!FileInfo(file.value, size, error)) {
        if (error.code == "UNSAFE_FILE" || error.code == "FILE_TOO_LARGE") {
          skipped.push_back({{"relativePath", relative},
                             {"reason", error.code == "FILE_TOO_LARGE" ? "tooLarge" : "hardlinkAlias"}});
          error = {};
          continue;
        }
        return false;
      }
      entries.push_back({{"relativePath", relative}, {"kind", "file"}, {"size", size}});
    }
    if (entries.size() + recovery.size() + skipped.size() > kMaxEntries)
      return Fail(error, "TOO_MANY_ENTRIES", "Vault has too many entries");
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

bool ExactName(HANDLE directory, const std::wstring& name, Error& error) {
  std::vector<DirectoryEntry> names;
  if (!Names(directory, names, error)) return false;
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

}  // namespace

bool List(const std::string& root, const RootIdentity& expected, nlohmann::json& result,
          Error& error) {
  std::vector<Handle> chain;
  if (!OpenRoot(root, expected, chain, error)) return false;
  nlohmann::json entries = nlohmann::json::array();
  nlohmann::json recovery = nlohmann::json::array();
  nlohmann::json skipped = nlohmann::json::array();
  if (!Scan(chain.back().value, "", 0, entries, recovery, skipped, error)) return false;
  auto ordered = entries.get<std::vector<nlohmann::json>>();
  std::sort(ordered.begin(), ordered.end(), [](const auto& a, const auto& b) {
    return a["relativePath"].template get<std::string>() < b["relativePath"].template get<std::string>();
  });
  auto orderedSkipped = skipped.get<std::vector<nlohmann::json>>();
  std::sort(orderedSkipped.begin(), orderedSkipped.end(), [](const auto& a, const auto& b) {
    return a["relativePath"].template get<std::string>() < b["relativePath"].template get<std::string>();
  });
  result = {{"entries", ordered}, {"recovery", recovery}, {"skipped", orderedSkipped}};
  return true;
}

bool Read(const std::string& root, const RootIdentity& expected,
          const std::string& relativePath, nlohmann::json& result, Error& error) {
  std::vector<std::wstring> parts;
  if (!SplitRelative(relativePath, parts, error)) return false;
  std::vector<Handle> chain;
  if (!OpenRoot(root, expected, chain, error)) return false;
  for (size_t i = 0; i + 1 < parts.size(); ++i) {
    Handle child;
    if (!ExactName(chain.back().value, parts[i], error)) return false;
    if (!OpenChild(chain.back().value, parts[i], true, child, error)) return false;
    chain.push_back(std::move(child));
  }
  Handle file;
  if (!ExactName(chain.back().value, parts.back(), error)) return false;
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

}  // namespace vault
