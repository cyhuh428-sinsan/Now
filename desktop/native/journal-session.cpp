#include "vault-path.hpp"
#include "third_party/json.hpp"

#include <bcrypt.h>
#include <winternl.h>

#include <array>
#include <algorithm>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <limits>
#include <set>
#include <string>
#include <vector>

namespace {

using nlohmann::json;
constexpr size_t kMaxLog = 128 * 1024;
constexpr size_t kHeader = 4 + 32;
constexpr wchar_t kName[] = L"nownote-vault-journal.bin";
constexpr NTSTATUS kNameNotFound = static_cast<NTSTATUS>(0xC0000034);

json Failure(const char* code, const char* message) {
  return {{"ok", false}, {"error", {{"code", code}, {"message", message}}}};
}

json Success(json result) { return {{"ok", true}, {"result", std::move(result)}}; }

bool FixtureRoot(const std::string& root) {
  const std::string prefix = "D:\\tmp\\nownote-239-vault-qa\\";
  return root.size() > prefix.size() && root.compare(0, prefix.size(), prefix) == 0;
}

bool Digest(const BYTE* bytes, size_t length, std::array<BYTE, 32>& hash) {
  BCRYPT_ALG_HANDLE algorithm = nullptr;
  if (length > static_cast<size_t>((std::numeric_limits<ULONG>::max)()) ||
      BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_SHA256_ALGORITHM, nullptr, 0) < 0)
    return false;
  const NTSTATUS status = BCryptHash(algorithm, nullptr, 0, const_cast<BYTE*>(bytes),
                                     static_cast<ULONG>(length), hash.data(),
                                     static_cast<ULONG>(hash.size()));
  BCryptCloseAlgorithmProvider(algorithm, 0);
  return status >= 0;
}

class Session {
 public:
  ~Session() {
    if (journal_ != INVALID_HANDLE_VALUE) CloseHandle(journal_);
    if (owned_) ReleaseMutex(mutex_);
    if (mutex_) CloseHandle(mutex_);
  }

  json Open(const json& request) {
    if (opened_ || !request.contains("root") || !request["root"].is_string())
      return Failure("INVALID_REQUEST", "One QA root is required");
    const std::string root = request["root"].get<std::string>();
    if (!FixtureRoot(root)) return Failure("FIXTURE_ONLY", "Journal is limited to the QA fixture");
    vault::Error error;
    if (!handles_.Open(root, identity_, error))
      return Failure("ROOT_OPEN_FAILED", "Cannot hold a safe userData root");
    const std::string suffix = identity_.volumeId + "-" + identity_.fileId;
    const std::wstring mutexName = L"Local\\NowNoteJournal-" +
        std::wstring(suffix.begin(), suffix.end());
    mutex_ = CreateMutexW(nullptr, FALSE, mutexName.c_str());
    if (!mutex_) return Failure("LOCK_UNAVAILABLE", "Cannot create journal mutex");
    const DWORD wait = WaitForSingleObject(mutex_, 500);
    if (wait != WAIT_OBJECT_0 && wait != WAIT_ABANDONED)
      return Failure("LOCKED", "Journal is locked by another session");
    owned_ = true;
    if (!OpenFile(false)) return Failure("JOURNAL_UNSAFE", "Cannot open journal safely");
    root_ = root;
    if (!ReadLog()) return Failure("JOURNAL_CORRUPT", "Journal requires manual recovery");
    if (!record_.is_null() && !HoldVault(record_))
      return Failure("VAULT_CHANGED", "Recorded Vault identity cannot be held");
    resumed_ = !record_.is_null();
    opened_ = true;
    return Success({{"rootIdentity", {{"volumeId", identity_.volumeId},
                                       {"fileId", identity_.fileId}}},
                    {"abandoned", wait == WAIT_ABANDONED},
                    {"recoveryRequired", !record_.is_null()}});
  }

  json Command(const json& request) {
    if (!opened_) return Failure("NOT_OPEN", "Journal session is not open");
    if (poisoned_) return Failure("JOURNAL_CORRUPT", "Journal requires manual recovery");
    const std::string operation = request.value("operation", "");
    if (operation == "read") {
      char pause[16]{};
      size_t length = 0;
      if (getenv_s(&length, pause, sizeof(pause), "NOWNOTE_JOURNAL_TEST_PAUSE_READ_MS") == 0 &&
          length > 0) {
        char* end = nullptr;
        const long milliseconds = std::strtol(pause, &end, 10);
        if (*end == '\0' && milliseconds > 0 && milliseconds <= 5000)
          Sleep(static_cast<DWORD>(milliseconds));
      }
      return Success({{"record", record_}, {"sequence", sequence_}});
    }
    if (operation == "assertClear") {
      if (!record_.is_null()) return Failure("RECOVERY_REQUIRED", "Active journal requires recovery");
      return Success({{"clear", true}});
    }
    if (operation == "begin") {
      if (!record_.is_null()) return Failure("RECOVERY_REQUIRED", "Active journal requires recovery");
      if (!request.contains("record") || !ValidRecord(request["record"], true))
        return Failure("INVALID_RECORD", "Invalid initial journal record");
      if (!HoldVault(request["record"]))
        return Failure("VAULT_CHANGED", "Vault identity changed before journal begin");
      return Append(request["record"]);
    }
    if (operation == "advance") {
      if (record_.is_null() || !MatchingId(request))
        return Failure("OPERATION_MISMATCH", "Journal operation ID mismatch");
      if (!request.contains("patch") || !request["patch"].is_object())
        return Failure("INVALID_RECORD", "Invalid journal update");
      const json& patch = request["patch"];
      for (auto it = patch.begin(); it != patch.end(); ++it) {
        if (it.key() != "phase" && it.key() != "artifacts" && it.key() != "postStoreHash")
          return Failure("INVALID_RECORD", "Unexpected journal update field");
      }
      json next = record_;
      if (patch.contains("artifacts")) {
        if (!patch["artifacts"].is_object()) return Failure("INVALID_RECORD", "Invalid artifacts");
        next["artifacts"].update(patch["artifacts"]);
      }
      if (patch.contains("phase")) next["phase"] = patch["phase"];
      if (patch.contains("postStoreHash")) next["postStoreHash"] = patch["postStoreHash"];
      if (!ValidRecord(next, false) || !SameOperation(record_, next) ||
          !AllowedPhase(record_["phase"], next["phase"]))
        return Failure("INVALID_RECORD", "Invalid journal transition");
      return Append(next);
    }
    if (operation == "clear") {
      if (record_.is_null() || !MatchingId(request))
        return Failure("OPERATION_MISMATCH", "Journal operation ID mismatch");
      if (resumed_)
        return Failure("RECOVERY_REQUIRED", "Resumed journal requires native recovery verification");
      if (record_["phase"] != "storeCommitted")
        return Failure("RECOVERY_REQUIRED", "Journal cannot clear before confirmed store commit");
      return Append(nullptr);
    }
    return Failure("INVALID_OPERATION", "Unsupported journal command");
  }

 private:
  bool HoldVault(const json& record) {
    vault::RootIdentity held;
    vault::Error error;
    return vaultHandles_.Open(record["root"].get<std::string>(), held, error) &&
           record["rootIdentity"]["volumeId"] == held.volumeId &&
           record["rootIdentity"]["fileId"] == held.fileId;
  }

  bool MatchingId(const json& request) const {
    return request.contains("operationId") && request["operationId"].is_string() &&
           request["operationId"] == record_["operationId"];
  }

  static bool Bounded(const json& value, size_t limit) {
    if (!value.is_string()) return false;
    const std::string text = value.get<std::string>();
    return !text.empty() && text.size() <= limit &&
           std::none_of(text.begin(), text.end(), [](unsigned char ch) { return ch < 32 || ch == 127; });
  }

  static bool Hash(const json& value) {
    if (value.is_null()) return true;
    if (!value.is_string()) return false;
    const std::string text = value.get<std::string>();
    return text.size() == 64 && std::all_of(text.begin(), text.end(), [](char ch) {
      return (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F');
    });
  }

  static bool RelativePath(const json& value) {
    if (!Bounded(value, 1024)) return false;
    const std::string text = value.get<std::string>();
    if (text[0] == '/' || text.find('\\') != std::string::npos ||
        text.find(':') != std::string::npos) return false;
    size_t start = 0;
    while (start < text.size()) {
      const size_t end = text.find('/', start);
      const std::string part = text.substr(start, end == std::string::npos ? end : end - start);
      if (part.empty() || part == "." || part == "..") return false;
      if (end == std::string::npos) return true;
      start = end + 1;
    }
    return false;
  }

  static bool Keys(const json& value, const std::set<std::string>& allowed) {
    if (!value.is_object()) return false;
    for (auto it = value.begin(); it != value.end(); ++it)
      if (allowed.count(it.key()) == 0) return false;
    return true;
  }

  bool ArtifactPath(const std::string& key, const json& value) const {
    if (value.is_null()) return true;
    if (!Bounded(value, 4096)) return false;
    const std::string text = value.get<std::string>();
    const std::string prefix = (key == "backupPath" ? root_ : recordVaultRoot_) + "\\";
    if (text.size() <= prefix.size() || text.compare(0, prefix.size(), prefix) != 0 ||
        text.find('/') != std::string::npos || text.find(':', 2) != std::string::npos)
      return false;
    const std::string marker = key == "backupPath" ? ".nownote-backup-" :
        key == "pendingPath" ? ".nownote-pending-" :
        key == "preservedPath" ? ".nownote-preserved-" : ".nownote-temp-";
    const size_t last = text.find_last_of('\\');
    if (last == std::string::npos || last <= prefix.size()) return false;
    const std::string name = text.substr(last + 1);
    if (name.size() != marker.size() + 32 || name.compare(0, marker.size(), marker) != 0 ||
        !std::all_of(name.begin() + marker.size(), name.end(), [](char ch) {
          return (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f');
        })) return false;
    size_t start = prefix.size();
    while (start < last) {
      const size_t end = text.find('\\', start);
      if (end == std::string::npos || end > last) break;
      const std::string part = text.substr(start, end - start);
      if (part.empty() || part == "." || part == "..") return false;
      start = end + 1;
    }
    vault::RootHandles parent;
    vault::RootIdentity parentIdentity;
    vault::Error error;
    return parent.Open(text.substr(0, last), parentIdentity, error);
  }

  bool ValidRecord(const json& value, bool initial) const {
    static const std::set<std::string> fields = {
        "operationId", "root", "rootIdentity", "userDataRootIdentity", "itemId", "steps", "phase",
        "preStoreHash", "postStoreHash", "createdAt", "artifacts"};
    static const std::set<std::string> stepFields = {
        "operation", "relativePath", "from", "to", "preHash", "postHash"};
    static const std::set<std::string> artifactFields = {
        "backupPath", "pendingPath", "preservedPath", "tempPath"};
    if (!Keys(value, fields) || !value.contains("operationId") ||
        !Bounded(value["operationId"], 128) || !value.contains("root") ||
        !value["root"].is_string() || !FixtureRoot(value["root"].get<std::string>()) ||
        !value.contains("rootIdentity") ||
        !Keys(value["rootIdentity"], {"volumeId", "fileId"}) ||
        !value["rootIdentity"].contains("volumeId") ||
        !value["rootIdentity"].contains("fileId") ||
        !value.contains("userDataRootIdentity") ||
        !Keys(value["userDataRootIdentity"], {"volumeId", "fileId"}) ||
        !value["userDataRootIdentity"].contains("volumeId") ||
        !value["userDataRootIdentity"].contains("fileId") ||
        value["userDataRootIdentity"]["volumeId"] != identity_.volumeId ||
        value["userDataRootIdentity"]["fileId"] != identity_.fileId ||
        !value.contains("itemId") || !Bounded(value["itemId"], 256) ||
        !value.contains("phase") || !value["phase"].is_string() ||
        (initial && value["phase"] != "prepared") ||
        !value.contains("preStoreHash") || value["preStoreHash"].is_null() ||
        !Hash(value["preStoreHash"]) ||
        !value.contains("createdAt") || !Bounded(value["createdAt"], 64) ||
        !value.contains("artifacts") || !Keys(value["artifacts"], artifactFields) ||
        !value.contains("steps") || !value["steps"].is_array() ||
        value["steps"].empty() || value["steps"].size() > 8)
      return false;
    vault::RootHandles vaultRoot;
    vault::RootIdentity vaultIdentity;
    vault::Error vaultError;
    if (!vaultRoot.Open(value["root"].get<std::string>(), vaultIdentity, vaultError) ||
        value["rootIdentity"]["volumeId"] != vaultIdentity.volumeId ||
        value["rootIdentity"]["fileId"] != vaultIdentity.fileId)
      return false;
    recordVaultRoot_ = value["root"].get<std::string>();
    const std::string phase = value["phase"].get<std::string>();
    if (phase != "prepared" && phase != "vaultConfirmed" &&
        phase != "storeCommitted" && phase != "rollingBack" &&
        phase != "recoveryRequired") return false;
    if (phase == "storeCommitted" &&
        (!value.contains("postStoreHash") || value["postStoreHash"].is_null())) return false;
    if (phase != "storeCommitted" && value.contains("postStoreHash")) return false;
    if (value.contains("postStoreHash") && !Hash(value["postStoreHash"])) return false;
    for (const auto& step : value["steps"]) {
      if (!Keys(step, stepFields) || !step.contains("operation") || !step["operation"].is_string() ||
          !step.contains("preHash") || !Hash(step["preHash"]) ||
          !step.contains("postHash") || !Hash(step["postHash"])) return false;
      const std::string operation = step["operation"].get<std::string>();
      if (operation == "move") {
        if (!step.contains("from") || !RelativePath(step["from"]) ||
            !step.contains("to") || !RelativePath(step["to"]) ||
            step.contains("relativePath") || step["preHash"].is_null() ||
            step["postHash"].is_null()) return false;
      } else if (operation == "write" || operation == "rollback") {
        if (!step.contains("relativePath") || !RelativePath(step["relativePath"]) ||
            step.contains("from") || step.contains("to") ||
            (operation == "write" && step["postHash"].is_null()) ||
            (operation == "rollback" && !step["postHash"].is_null())) return false;
      } else return false;
    }
    for (auto it = value["artifacts"].begin(); it != value["artifacts"].end(); ++it)
      if (!ArtifactPath(it.key(), it.value())) return false;
    return true;
  }

  static bool AllowedPhase(const json& before, const json& after) {
    if (!before.is_string() || !after.is_string()) return false;
    const std::string from = before.get<std::string>();
    const std::string to = after.get<std::string>();
    if (from == to) return true;
    if (to == "recoveryRequired") return true;
    if (from == "prepared") return to == "vaultConfirmed" || to == "rollingBack";
    if (from == "vaultConfirmed") return to == "storeCommitted" || to == "rollingBack";
    return false;
  }

  static bool SameOperation(const json& before, const json& after) {
    json oldCore = before;
    json nextCore = after;
    for (const char* key : {"phase", "artifacts", "postStoreHash"}) {
      oldCore.erase(key);
      nextCore.erase(key);
    }
    if (oldCore != nextCore) return false;
    for (auto it = before["artifacts"].begin(); it != before["artifacts"].end(); ++it) {
      if (!after["artifacts"].contains(it.key()) ||
          after["artifacts"][it.key()] != it.value()) return false;
    }
    return true;
  }

  bool OpenFile(bool create) {
    if (journal_ != INVALID_HANDLE_VALUE) return true;
    UNICODE_STRING name{};
    name.Buffer = const_cast<PWSTR>(kName);
    name.Length = static_cast<USHORT>((std::size(kName) - 1) * sizeof(wchar_t));
    name.MaximumLength = name.Length;
    OBJECT_ATTRIBUTES attributes{};
    InitializeObjectAttributes(&attributes, &name, OBJ_CASE_INSENSITIVE | OBJ_DONT_REPARSE,
                               handles_.Root(), nullptr);
    IO_STATUS_BLOCK io{};
    HANDLE opened = INVALID_HANDLE_VALUE;
    const NTSTATUS status = NtCreateFile(
        &opened, FILE_READ_DATA | FILE_WRITE_DATA | FILE_READ_ATTRIBUTES | SYNCHRONIZE,
        &attributes, &io, nullptr, FILE_ATTRIBUTE_NORMAL, 0,
        create ? FILE_CREATE : FILE_OPEN,
        FILE_NON_DIRECTORY_FILE | FILE_OPEN_REPARSE_POINT | FILE_SYNCHRONOUS_IO_NONALERT,
        nullptr, 0);
    if (!create && status == kNameNotFound) return true;
    if (status < 0 || opened == INVALID_HANDLE_VALUE || opened == nullptr) return false;
    journal_ = opened;
    FILE_ATTRIBUTE_TAG_INFO tag{};
    BY_HANDLE_FILE_INFORMATION info{};
    return GetFileInformationByHandleEx(journal_, FileAttributeTagInfo, &tag, sizeof(tag)) &&
           (tag.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) == 0 &&
           GetFileInformationByHandle(journal_, &info) && info.nNumberOfLinks == 1;
  }

  bool ReadLog() {
    if (journal_ == INVALID_HANDLE_VALUE) return true;
    LARGE_INTEGER size{};
    if (!GetFileSizeEx(journal_, &size) || size.QuadPart <= 0 ||
        size.QuadPart > static_cast<LONGLONG>(kMaxLog)) return false;
    std::vector<BYTE> bytes(static_cast<size_t>(size.QuadPart));
    LARGE_INTEGER start{};
    if (!SetFilePointerEx(journal_, start, nullptr, FILE_BEGIN)) return false;
    size_t read = 0;
    while (read < bytes.size()) {
      DWORD count = 0;
      if (!ReadFile(journal_, bytes.data() + read,
                    static_cast<DWORD>(bytes.size() - read), &count, nullptr) || count == 0)
        return false;
      read += count;
    }
    size_t offset = 0;
    uint64_t sequence = 0;
    json record = nullptr;
    while (offset < bytes.size()) {
      if (bytes.size() - offset < kHeader) return false;
      const size_t length = static_cast<size_t>(bytes[offset]) |
          (static_cast<size_t>(bytes[offset + 1]) << 8) |
          (static_cast<size_t>(bytes[offset + 2]) << 16) |
          (static_cast<size_t>(bytes[offset + 3]) << 24);
      if (length == 0 || length > kMaxLog || length > bytes.size() - offset - kHeader)
        return false;
      std::array<BYTE, 32> digest{};
      if (!Digest(bytes.data() + offset + kHeader, length, digest) ||
          std::memcmp(digest.data(), bytes.data() + offset + 4, digest.size()) != 0)
        return false;
      const std::string body(reinterpret_cast<const char*>(bytes.data() + offset + kHeader), length);
      json frame = json::parse(body, nullptr, false);
      if (!frame.is_object() || !frame.contains("sequence") ||
          !frame["sequence"].is_number_unsigned() ||
          frame["sequence"].get<uint64_t>() != sequence + 1 ||
          !frame.contains("record") ||
          (!frame["record"].is_null() && !ValidRecord(frame["record"], sequence == 0)))
        return false;
      if (sequence == 0 && frame["record"].is_null()) return false;
      if (sequence > 0) {
        if (record.is_null()) {
          if (frame["record"].is_null() || frame["record"]["phase"] != "prepared")
            return false;
        } else if (frame["record"].is_null()) {
          if (record["phase"] != "storeCommitted") return false;
        } else if (!frame["record"].is_null() &&
                   (!SameOperation(record, frame["record"]) ||
                    !AllowedPhase(record["phase"], frame["record"]["phase"]))) {
          return false;
        }
      }
      sequence++;
      record = frame["record"];
      offset += kHeader + length;
    }
    sequence_ = sequence;
    record_ = std::move(record);
    return true;
  }

  json Append(const json& next) {
    if (journal_ == INVALID_HANDLE_VALUE && !OpenFile(true)) {
      poisoned_ = true;
      return Failure("JOURNAL_WRITE_FAILED", "Cannot create journal safely");
    }
    const std::string body = json{{"sequence", sequence_ + 1}, {"record", next}}.dump();
    LARGE_INTEGER size{};
    if (!GetFileSizeEx(journal_, &size) || size.QuadPart < 0 ||
        static_cast<uint64_t>(size.QuadPart) + kHeader + body.size() > kMaxLog) {
      poisoned_ = true;
      return Failure("JOURNAL_FULL", "Journal size limit requires manual recovery");
    }
    std::array<BYTE, 32> digest{};
    if (!Digest(reinterpret_cast<const BYTE*>(body.data()), body.size(), digest)) {
      poisoned_ = true;
      return Failure("JOURNAL_WRITE_FAILED", "Cannot hash journal frame");
    }
    std::vector<BYTE> frame;
    frame.reserve(kHeader + body.size());
    const auto length = static_cast<uint32_t>(body.size());
    for (int shift = 0; shift < 32; shift += 8)
      frame.push_back(static_cast<BYTE>((length >> shift) & 0xff));
    frame.insert(frame.end(), digest.begin(), digest.end());
    frame.insert(frame.end(), body.begin(), body.end());
    LARGE_INTEGER end{};
    DWORD written = 0;
    if (!SetFilePointerEx(journal_, end, nullptr, FILE_END) ||
        !WriteFile(journal_, frame.data(), static_cast<DWORD>(frame.size()), &written, nullptr) ||
        written != frame.size() || !FlushFileBuffers(journal_)) {
      poisoned_ = true;
      return Failure("JOURNAL_WRITE_FAILED", "Journal frame was not confirmed durable");
    }
    record_ = next;
    sequence_++;
    return Success({{"sequence", sequence_}, {"record", record_}});
  }

  vault::RootHandles handles_;
  vault::RootHandles vaultHandles_;
  vault::RootIdentity identity_;
  std::string root_;
  mutable std::string recordVaultRoot_;
  HANDLE mutex_ = nullptr;
  HANDLE journal_ = INVALID_HANDLE_VALUE;
  bool owned_ = false;
  bool opened_ = false;
  bool resumed_ = false;
  bool poisoned_ = false;
  uint64_t sequence_ = 0;
  json record_ = nullptr;
};

}  // namespace

int main() {
  Session session;
  std::string line;
  while (std::getline(std::cin, line)) {
    json response;
    if (line.size() > 256 * 1024) {
      response = Failure("REQUEST_TOO_LARGE", "Journal request exceeds 256 KiB");
    } else {
      const json request = json::parse(line, nullptr, false);
      if (!request.is_object() || !request.contains("protocol") || request["protocol"] != 1 ||
          !request.contains("operation") || !request["operation"].is_string()) {
        response = Failure("INVALID_REQUEST", "Invalid journal request");
      } else if (request["operation"] == "open") {
        response = session.Open(request);
      } else {
        response = session.Command(request);
      }
    }
    std::cout << response.dump() << std::endl;
    if (!std::cout) break;
  }
  return 0;
}
