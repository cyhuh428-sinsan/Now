#include <windows.h>
#include <winioctl.h>

#include <cstdio>
#include <cstring>
#include <cwchar>
#include <string>
#include <vector>

namespace {

constexpr wchar_t kQaPrefix[] = L"D:\\tmp\\nownote-239-vault-qa\\";

struct MountPointData {
  DWORD tag;
  USHORT dataLength;
  USHORT reserved;
  USHORT substituteOffset;
  USHORT substituteLength;
  USHORT printOffset;
  USHORT printLength;
  wchar_t path[1];
};

static_assert(FIELD_OFFSET(MountPointData, path) == 16);

bool InFixture(const std::wstring& path) {
  return path.size() > std::wcslen(kQaPrefix) &&
         _wcsnicmp(path.c_str(), kQaPrefix, std::wcslen(kQaPrefix)) == 0 &&
         path.find(L"..") == std::wstring::npos;
}

int Fail(const wchar_t* operation) {
  std::fwprintf(stderr, L"%ls %lu\n", operation, GetLastError());
  return 2;
}

}  // namespace

int wmain(int argc, wchar_t** argv) {
  const bool setting = argc > 1 && std::wcscmp(argv[1], L"set") == 0;
  const bool deleting = argc > 1 && std::wcscmp(argv[1], L"delete") == 0;
  if ((!setting && !deleting) || (setting && argc != 4) ||
      (deleting && argc != 3) ||
      !InFixture(argv[2]) || (argc == 4 && !InFixture(argv[3]))) {
    std::fwprintf(stderr, L"fixture paths only\n");
    return 3;
  }
  const HANDLE directory = CreateFileW(
      argv[2], FILE_WRITE_ATTRIBUTES | FILE_READ_ATTRIBUTES,
      FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr, OPEN_EXISTING,
      FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, nullptr);
  if (directory == INVALID_HANDLE_VALUE) return Fail(L"open");

  DWORD returned = 0;
  BOOL success = FALSE;
  if (deleting) {
    MountPointData data{};
    data.tag = IO_REPARSE_TAG_MOUNT_POINT;
    success = DeviceIoControl(directory, FSCTL_DELETE_REPARSE_POINT, &data, 8,
                              nullptr, 0, &returned, nullptr);
  } else {
    if (argc != 4) {
      CloseHandle(directory);
      return 3;
    }
    const std::wstring target = L"\\??\\" + std::wstring(argv[3]);
    const std::wstring printName = argv[3];
    const auto targetBytes = static_cast<USHORT>(target.size() * sizeof(wchar_t));
    const auto printBytes = static_cast<USHORT>(printName.size() * sizeof(wchar_t));
    const size_t header = FIELD_OFFSET(MountPointData, path);
    std::vector<BYTE> storage(header + targetBytes + sizeof(wchar_t) +
                              printBytes + sizeof(wchar_t));
    auto* data = reinterpret_cast<MountPointData*>(storage.data());
    data->tag = IO_REPARSE_TAG_MOUNT_POINT;
    data->dataLength = static_cast<USHORT>(storage.size() - 8);
    data->substituteOffset = 0;
    data->substituteLength = targetBytes;
    data->printOffset = targetBytes + sizeof(wchar_t);
    data->printLength = printBytes;
    auto* path = reinterpret_cast<BYTE*>(data->path);
    std::memcpy(path, target.data(), targetBytes);
    std::memcpy(path + targetBytes + sizeof(wchar_t), printName.data(), printBytes);
    success = DeviceIoControl(directory, FSCTL_SET_REPARSE_POINT, data,
                              static_cast<DWORD>(storage.size()), nullptr, 0,
                              &returned, nullptr);
  }
  const DWORD error = success ? ERROR_SUCCESS : GetLastError();
  CloseHandle(directory);
  if (!success) {
    SetLastError(error);
    return Fail(argv[1]);
  }
  std::wprintf(L"OK\n");
  return 0;
}
