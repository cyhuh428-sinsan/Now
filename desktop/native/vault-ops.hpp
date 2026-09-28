#pragma once

#include "vault-path.hpp"
#include "third_party/json.hpp"

#include <string>

namespace vault {

bool List(const std::string& root, const RootIdentity& expected, nlohmann::json& result,
          Error& error);
bool Read(const std::string& root, const RootIdentity& expected,
          const std::string& relativePath, nlohmann::json& result, Error& error);

}  // namespace vault
