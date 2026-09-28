#include "vault-path.hpp"
#include "vault-ops.hpp"
#include "third_party/json.hpp"

#include <array>
#include <iostream>
#include <string>

namespace {

constexpr size_t kMaxRequest = 8 * 1024 * 1024;
constexpr size_t kMaxResponse = 16 * 1024 * 1024;
using nlohmann::json;

json Failure(const char* code, const char* message) {
  return {{"ok", false}, {"error", {{"code", code}, {"message", message}}}};
}

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
  if (operation != "probe" && operation != "list" && operation != "read") {
    return Failure("UNSUPPORTED_OPERATION", "Operation is not available");
  }
  if (!request.contains("root") || !request["root"].is_string()) {
    return Failure("INVALID_ROOT", "Root must be a string");
  }
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
    const bool success = operation == "list"
        ? vault::List(root, identity, result, error)
        : request.contains("relativePath") && request["relativePath"].is_string()
            ? vault::Read(root, identity, request["relativePath"].get<std::string>(), result, error)
            : false;
    if (!success) {
      if (error.code.empty()) return Failure("INVALID_PATH", "Relative path is required");
      return { {"ok", false}, {"error", {{"code", error.code}, {"message", error.message}}} };
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
