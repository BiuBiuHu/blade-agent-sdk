# Skills 系统

Skills 是可复用的指令模板，以 `SKILL.md` 文件形式存在，支持 YAML 前置元数据和内联命令。

## 目录结构

```
~/.blade/skills/           # 用户全局 Skills
  my-skill/
    SKILL.md
    scripts/
      helper.sh

.blade/skills/             # 项目级 Skills
  deploy/
    SKILL.md
    scripts/
      deploy.sh
```

SDK 按 **用户级 → 项目级** 的优先级加载 Skills。

## SKILL.md 格式

```markdown
---
name: deploy-staging
description: 部署到 staging 环境
tags: [deploy, staging]
---

# 部署到 Staging

1. 运行测试：!`npm test`
2. 构建项目：!`npm run build`
3. 部署到 staging：!`./scripts/deploy.sh staging`
```

### 前置元数据

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | Skill 名称 |
| `description` | `string` | 描述 |
| `tags` | `string[]` | 标签（用于搜索和分类） |

### 内联命令

使用 `` !`command` `` 语法标记可执行命令，SDK 会自动执行这些命令。

### scripts/ 目录

每个 Skill 可以包含一个 `scripts/` 目录，SDK 会自动发现并告知 LLM 可用的脚本文件。

## 工作机制

1. 内置 `Skill` 工具让 LLM 可以发现和调用 Skills
2. LLM 读取 SKILL.md 内容，按照其中的指令执行
3. 内联命令 `` !`command` `` 会被 SDK 自动执行
4. `scripts/` 目录中的脚本会被列为可用资源
