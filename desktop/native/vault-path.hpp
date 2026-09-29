#pragma once

#include <windows.h>

#include <string>
#include <vector>

namespace vault {

struct Error {
  std::string code;
  std::string message;
};

struct RootIdentity {
  std::string volumeId;
  std::string fileId;
  std::string filesystem;
};

class RootHandles {
 public:
  RootHandles() = default;
  ~RootHandles();
  RootHandles(const RootHandles&) = delete;
  RootHandles& operator=(const RootHandles&) = delete;

  bool Open(const std::string& utf8Root, RootIdentity& identity, Error& error);
  HANDLE Root() const { return handles_.empty() ? INVALID_HANDLE_VALUE : handles_.back(); }

 private:
  std::vector<HANDLE> handles_;
};

}  // namespace vault
