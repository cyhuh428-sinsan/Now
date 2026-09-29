#pragma once

#include "vault-path.hpp"
#include "third_party/json.hpp"

#include <string>
#include <optional>
#include <vector>

namespace vault {

bool List(const std::string& root, const RootIdentity& expected, nlohmann::json& result,
          Error& error);
bool Read(const std::string& root, const RootIdentity& expected,
          const std::string& relativePath, nlohmann::json& result, Error& error);
bool Write(const std::string& root, const RootIdentity& expected,
           const std::string& relativePath, const std::optional<std::string>& expectedHash,
           const std::string& contentBase64, const std::string& backupDir,
           nlohmann::json& result, Error& error);
bool Rollback(const std::string& root, const RootIdentity& expected,
              const std::string& relativePath, const std::string& expectedHash,
              const std::string& backupDir, nlohmann::json& result, Error& error);
bool Move(const std::string& root, const RootIdentity& expected,
          const std::string& from, const std::string& to,
          const std::string& expectedHash, const std::string& backupDir,
          nlohmann::json& result, Error& error);
bool RemoveEmptyDirs(const std::string& root, const RootIdentity& expected,
                     const std::vector<std::string>& createdDirs,
                     nlohmann::json& result, Error& error);

}  // namespace vault
