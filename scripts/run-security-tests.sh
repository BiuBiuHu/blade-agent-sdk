#!/bin/bash
set -euo pipefail

echo "Running security tests..."

echo "Running bun audit..."
bun audit --audit-level=moderate

echo "Checking for outdated dependencies..."
bun outdated

echo "Inspecting installed dependency tree..."
bun pm ls --all

echo "Running runtime security checks..."
# 这里可以添加运行时安全检查命令

echo "Security tests completed."
