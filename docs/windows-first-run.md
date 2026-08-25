# Windows 第一版操作方式

## 正式入口

安裝並開啟 Codex Taskboard Windows 應用程式。程式會啟動內建的本機 Taskboard 服務，就緒後顯示獨立的原生視窗。瀏覽器網址只用於除錯。

第一版不依賴、不重啟、不結束、不啟動、也不注入官方 Codex 桌面應用程式。

## 任務狀態

- 構想：只記錄，不允許 Agent 執行。
- 待辦：使用者已授權 Codex 認領。
- 處理中：Codex 已認領並綁定工作對話。
- 等待確認：Codex 已完成直接驗證，等待使用者驗收。
- 完成：只有使用者確認後才能進入。

## 每日操作

1. 把想法記在構想欄。
2. 想清楚後拖到待辦欄。
3. Codex Automation 每五分鐘檢查一次待辦。
4. 在等待確認欄檢查結果；接受後才移到完成。
5. 需要返工時留言並移回待辦，保留原任務與對話歷史。

## 資料位置

- 任務資料：`%APPDATA%\Codex Taskboard`
- 啟動日誌：`%LOCALAPPDATA%\Codex Taskboard\Logs`
- Skill 與 CLI：安裝時會放入 `%USERPROFILE%\.agents\skills\manage-taskboard` 與內建 `taskctl.cmd`

## 第一版不使用

Cloudflare 協作、Jira、SSH 遠端專案、AI Chat、甘特圖、流程畫布及 Codex iframe 注入不屬於第一版驗收範圍。
