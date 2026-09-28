#include "vault-path.hpp"
#include "vault-ops.hpp"
#include "third_party/json.hpp"

#include <algorithm>
#include <array>
#include <iostream>
#ifdef NOW_VAULT_MUTATION_EXPERIMENT
#include <optional>
#include <vector>
#endif
#include <string>

namespace {

constexpr size_t kMaxRequest = 8 * 1024 * 1024;
constexpr size_t kMaxResponse = 16 * 1024 * 1024;
using nlohmann::json;

json Failure(const char* code, const char* message) {
  return {{"ok", false}, {"error", {{"code", code}, {"message", message}}}};
}

#ifdef NOW_VAULT_MUTATION_EXPERIMENT
bool IsIsolatedFixture(const std::string& path) {
  static const std::string prefix = "D:\\tmp\\nownote-239-vault-qa\\";
  return path.size() > prefix.size() && path.compare(0, prefix.size(), prefix) == 0;
}
#endif

json Handle(const std::string& input, bool tooLarge) {
  if (tooLarge) return Failure("REQUEST_TOO_LARGE", "Request exceeds 8 MiB");
  const json request = json::parse(input, nullptr, false);
  if (!request.is_object()) return Failure("INVALID_JSON", "Request must be a JSON object");
  if (!request.contains("protocol") || !request["protocol"].is_number_integer() ||
      request["protocol"] != 1) {
    return Failure("INVALID_PROTOCOL", "Unsupported protocol version");
  }
  if (!request.contains("operation") || !request["operation"].is_string()) {
    return Failure("INVALID_OPERATION", "Operation is required");
  }
  const auto operation = request["operation"].get<std::string>();
  if (operation != "probe" && operation != "list" && operation != "read"
#ifdef NOW_VAULT_MUTATION_EXPERIMENT
      && operation != "write" && operation != "rollback" && operation != "move" &&
      operation != "removeEmptyDirs"
#endif
      ) {
    return Failure("UNSUPPORTED_OPERATION", "Operation is not available");
  }
  if (!request.contains("root") || !request["root"].is_string()) {
    return Failure("INVALID_ROOT", "Root must be a string");
  }
#ifdef NOW_VAULT_MUTATION_EXPERIMENT
  if ((operation == "write" || operation == "rollback" || operation == "move" ||
       operation == "removeEmptyDirs") &&
      !IsIsolatedFixture(request["root"].get<std::string>())) {
    return Failure("EXPERIMENT_FIXTURE_ONLY", "Mutation experiment is limited to the QA fixture");
  }
#endif
  vault::RootHandles handles;
  vault::RootIdentity identity;
  vault::Error error;
  if (!handles.Open(request["root"].get<std::string>(), identity, error)) {
    return {{"ok", false}, {"error", {{"code", error.code}, {"message", error.message}}}};
  }
  if (operation != "probe") {
    if (!request.contains("rootIdentity") || !request["rootIdentity"].is_object() ||
        !request["rootIdentity"].contains("volumeId") ||
        !request["rootIdentity"].contains("fileId") ||
        !request["rootIdentity"]["volumeId"].is_string() ||
        !request["rootIdentity"]["fileId"].is_string()) {
      return Failure("INVALID_IDENTITY", "Root identity is required");
    }
    const auto expected = request["rootIdentity"];
    if (identity.volumeId != expected["volumeId"].get<std::string>() ||
        identity.fileId != expected["fileId"].get<std::string>()) {
      return Failure("ROOT_CHANGED", "Vault root identity changed");
    }
    json result;
    const auto root = request["root"].get<std::string>();
    bool success = false;
    if (operation == "list") {
      success = vault::List(root, identity, result, error);
    }
#ifdef NOW_VAULT_MUTATION_EXPERIMENT
    else if (operation == "move" && request.contains("from") && request["from"].is_string() &&
             request.contains("to") && request["to"].is_string() &&
             request.contains("expectedHash") && request["expectedHash"].is_string() &&
             request.contains("backupDir") && request["backupDir"].is_string() &&
             IsIsolatedFixture(request["backupDir"].get<std::string>())) {
      success = vault::Move(root, identity, request["from"].get<std::string>(),
                            request["to"].get<std::string>(),
                            request["expectedHash"].get<std::string>(),
                            request["backupDir"].get<std::string>(), result, error);
    }
    else if (operation == "removeEmptyDirs" && request.contains("createdDirs") &&
             request["createdDirs"].is_array() && request["createdDirs"].size() <= 128 &&
             std::all_of(request["createdDirs"].begin(), request["createdDirs"].end(),
                         [](const auto& value) { return value.is_string(); })) {
      success = vault::RemoveEmptyDirs(root, identity,
          request["createdDirs"].get<std::vector<std::string>>(), result, error);
    }
#endif
    else if (request.contains("relativePath") && request["relativePath"].is_string()) {
      const auto relativePath = request["relativePath"].get<std::string>();
      if (operation == "read") {
        success = vault::Read(root, identity, relativePath, result, error);
      }
#ifdef NOW_VAULT_MUTATION_EXPERIMENT
      else if (operation == "write" && IsIsolatedFixture(root) &&
               request.contains("expectedHash") &&
               (request["expectedHash"].is_null() || request["expectedHash"].is_string()) &&
               request.contains("contentBase64") && request["contentBase64"].is_string() &&
               request.contains("backupDir") && request["backupDir"].is_string() &&
               IsIsolatedFixture(request["backupDir"].get<std::string>())) {
        const auto hash = request["expectedHash"].is_null()
            ? std::optional<std::string>{}
            : std::optional<std::string>{request["expectedHash"].get<std::string>()};
        success = vault::Write(root, identity, relativePath, hash,
                               request["contentBase64"].get<std::string>(),
                               request["backupDir"].get<std::string>(), result, error);
      }
      else if (operation == "rollback" && IsIsolatedFixture(root) &&
               request.contains("expectedHash") && request["expectedHash"].is_string() &&
               request.contains("backupDir") && request["backupDir"].is_string() &&
               IsIsolatedFixture(request["backupDir"].get<std::string>())) {
        success = vault::Rollback(root, identity, relativePath,
                                  request["expectedHash"].get<std::string>(),
                                  request["backupDir"].get<std::string>(), result, error);
      }
#endif
    }
    if (!success) {
      if (error.code.empty()) return Failure("INVALID_REQUEST", "Required operation fields are missing");
      json failure = {{"ok", false}, {"error", {{"code", error.code}, {"message", error.message}}}};
#ifdef NOW_VAULT_MUTATION_EXPERIMENT
      if ((operation == "write" || operation == "rollback" || operation == "move" ||
           operation == "removeEmptyDirs") &&
          result.is_object())
        failure["recovery"] = result;
#endif
      return failure;
    }
    return {{"ok", true}, {"result", result}};
  }
  return {{"ok", true},
          {"result", {{"rootIdentity", {{"volumeId", identity.volumeId},
                                        {"fileId", identity.fileId}}},
                      {"filesystem", identity.filesystem}}}};
}

}  // namespace

int main() {
  std::string input;
  std::array<char, 8192> buffer{};
  bool tooLarge = false;
  while (std::cin) {
    std::cin.read(buffer.data(), buffer.size());
    const auto count = std::cin.gcount();
    if (count <= 0) break;
    if (!tooLarge && input.size() + static_cast<size_t>(count) <= kMaxRequest) {
      input.append(buffer.data(), static_cast<size_t>(count));
    } else {
      tooLarge = true;
      input.clear();
    }
  }
  std::string output;
  try {
    output = Handle(input, tooLarge).dump();
  } catch (...) {
    output = Failure("INVALID_REQUEST", "Request could not be processed").dump();
  }
  if (output.size() > kMaxResponse) {
    output = Failure("RESPONSE_TOO_LARGE", "Response exceeds 16 MiB").dump();
  }
  std::cout << output << '\n';
  return 0;
}
