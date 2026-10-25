# Getting started with TOSO

_TOSO: Token Optimizer & Session Orchestrator._

One guide, in the order you walk it: from a clean machine to your first agent reply.
(Arabic version: [setup-and-usage.md](setup-and-usage.md).)

**In five lines**

1. Install the requirements, run `npm install`, then `npm run start:all`.
2. Open **Settings** and paste your free Google AI Studio key.
3. Install at least one CLI agent and log in to it once from your normal terminal.
4. In the agent's tab: project folder → ① **Check folder** → ④ **Start session**.
5. Type in that agent's prompt box → **Process** → **Send**.

---

## 1. Requirements

| Need                   | Details                                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Node.js                | 22.12 or newer                                                                                                         |
| Operating system       | Windows and macOS work out of the box (`node-pty` ships prebuilt binaries). Linux: see below.                          |
| Gemini key             | Optional but recommended: free from [AI Studio](https://aistudio.google.com/). Without it only the local cleanup runs. |
| At least one CLI agent | To receive the prompt and answer — see [section 3](#3-install-and-log-in-to-a-cli-agent).                              |

### Linux

The embedded terminal uses `node-pty`, which has no prebuilt binary for Linux. Install a C/C++ toolchain
(`build-essential` and `python3` on Debian/Ubuntu) before `npm install`. Without it TOSO still works: the bridge falls back
to one-shot runs (`gemini -p`, `claude -p`, `codex exec`, …) instead of live terminals.

## 2. Install and run

```bash
git clone https://github.com/khaledaalharbi/TOSO.git
cd TOSO
npm install
npm run start:all
```

`start:all` builds the app once (if there is no build yet), then starts the app and the local agent bridge together,
pairs them automatically and opens your browser. `Ctrl+C` stops both.

| Command             | When                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `npm run start:all` | **Daily use** — optimized build. Delete the `.next` folder after changing code to rebuild. |
| `npm run dev:all`   | Hacking on TOSO itself (hot reload).                                                       |
| `npm run bridge`    | The bridge alone, if the app is already running.                                           |
| `npm run dev`       | The app alone — no sending to agents.                                                      |

Both the app and the bridge listen on `127.0.0.1` only. `npm run start:all -- -p 4000` changes the app port;
`-- -H 0.0.0.0` exposes the app (never the bridge) on your network at your own risk. If port `8676` already has a bridge
answering, TOSO reuses it instead of starting a second one.

### Optional: a server key

Create `.env.local` in the project root:

```env
AGENT_PLATFORM_API_KEY=your-key
```

Read on the server only, never sent to the browser. Normally you do **not** need it — paste your personal key in Settings
instead. It uses Google's billed Agent Platform, so leave it unset unless you run a private copy for your own team.
If an old system environment variable has the same name it will shadow the file ([troubleshooting](#7-troubleshooting)).

## 3. Install and log in to a CLI agent

The only requirement: the agent's command is on your `PATH`.

| Agent       | Install                                                                             | Log in                                                |
| ----------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Gemini CLI  | `npm i -g @google/gemini-cli`                                                       | API key (personal Google sign-in no longer supported) |
| Claude Code | `irm https://claude.ai/install.ps1 \| iex` or `winget install Anthropic.ClaudeCode` | run `claude`, then `/login`                           |
| Codex       | `npm i -g @openai/codex`                                                            | `codex login`                                         |
| Devin       | official installer                                                                  | `devin auth login`                                    |
| Hermes      | official installer                                                                  | configure a model provider                            |

**Log in to each agent once from your normal terminal** before using it in TOSO; otherwise TOSO shows the agent's real
message (for example `Not logged in`). Check that the commands are visible (PowerShell):

```powershell
Get-Command gemini, claude, codex, devin, hermes -ErrorAction SilentlyContinue
```

> **Restart TOSO after installing a new agent.** The bridge copies `PATH` when it starts, so it cannot see anything
> installed afterwards. An agent outside `PATH`? Set `TOSO_AGENT_CMD_<ID>` (for example `TOSO_AGENT_CMD_CLAUDE`) before
> starting the bridge.

## 4. Settings

Open **Settings** (top of the page). Language: the **العربية | English** toggle next to it switches the whole interface and
its direction; your choice is remembered.

- **Key and access.** Paste your AI Studio key (stored in your browser only) — or leave it empty to use the server key.
  No key at all = local cleanup only. `gemini-3.8-flash` (default) and `gemini-3.5-flash-lite` are free on the Gemini free
  tier; `gemini-3.1-pro-preview` is not. **Privacy:** on the free tier Google may use content to improve its products — keep
  confidential code out of prompts.
- **Model.** Pick the Gemini model. **Check models** tests which models your key can actually use (via `countTokens`, no
  generation cost) and marks unavailable ones.
- **CLI agent bridge.** Leave the address and token alone while the bridge runs on your machine with default settings —
  detected values appear greyed out. Type them only if you changed the port or token. **Default agent** = the tab that
  opens first; it does not decide where prompts go.
- **Agent replies (OUT view).** _Smart output cleanup through Gemini_ is an optional second pass over the captured
  terminal text. (In Arabic the same section also offers automatic translation of every reply.)

Trust and folder settings are **per agent**, in its own tab (next section).

## 5. Set up an agent

Every agent has a tab. Enter the path of the project folder it must work in, then go through the steps in order:

| Step | Name            | Required? | What it does                                                                                       |
| ---- | --------------- | --------- | -------------------------------------------------------------------------------------------------- |
| ①    | Check folder    | **Yes**   | Confirms the folder exists. **Unlocks the other steps.**                                           |
| ②    | Permanent trust | Optional  | Records the folder as trusted in the agent's own settings file (affects your manual sessions too). |
| ③    | Per-run trust   | Optional  | A temporary switch planted in the agent's process that dies with it; no file written.              |
| ④    | Start session   | Last step | Starts the agent's interactive UI inside the checked folder.                                       |

Each success turns green. Steps ① and ② are tied to the path they succeeded on — change the path and they lock again.
Nothing runs before ① succeeds, and a session never starts just because you opened a tab.

Capability badges on ② and ③: **Supported** (TOSO drives it), **Automatic** (the agent never asks about folder trust),
**Not wired** (the agent has the mechanism, TOSO has not connected it), **Unsupported** (answer its question in the terminal).

| Agent        | ② Permanent trust | ③ Per-run trust |
| ------------ | ----------------- | --------------- |
| Gemini CLI   | Supported         | Supported       |
| Devin        | Supported         | Unsupported     |
| Claude Code  | Supported         | Unsupported     |
| OpenAI Codex | Supported         | Unsupported     |
| Hermes       | Automatic         | Automatic       |

**Permission questions** (such as "Allow execution of…" or "Do you trust this folder?") are answered by you **inside the
embedded terminal**. TOSO never treats the question as the agent's reply; it tells you the agent is waiting for a decision.

## 6. Use it

The page has: the **bridge badge** at the top (its real address and a status dot; click to open _Bridge sessions_); the
**agent column** (tabs, setup steps, three views — **Terminal / IN log / OUT log** — and the prompt box underneath);
the **gauges** beside it; and **Instructions and details** across the bottom.

1. **Write your prompt** in the agent's own prompt box. Every agent has its own box, so a prompt cannot reach the wrong agent.
2. **Process.** Your draft is replaced in place by the concise English version; the badge changes from _Draft — your
   language_ to _Ready — English_ and the status line shows tokens before and after. You can edit the English before sending.
   _Show original_ and _Undo_ bring your text back until you send. If you wrote English to begin with, processing is the
   same minus translation (local cleanup, then a free English rewrite).
3. **Send to [agent].** The prompt box empties and both versions land in the IN / OUT log. **Agents receive English only**
   (every send also ends with `Respond in English.`). If a send is refused (for example, an unchecked folder) your text stays
   in the box and the reason is shown in the agent's tab.
4. **Read the result** in the **IN log** (what you wrote beside what was sent) and the **OUT log** (the captured reply). In
   Arabic you can translate the reply back; in the English interface replies are already in your language, so OUT is one
   column. A yellow dot on _OUT log_ means a reply arrived while you were on another view — the view never switches by itself.
5. **Gauges.** Two dials on one shared scale — _Original_ and _Output_ — with the saving, send cost before/after, and badges
   for entities and the quality check. They describe the last processing of any agent. "No entities needing protection" means
   your text had no numbers, links or variables to protect.

### Send straight after processing

Each agent's prompt box has a **Send right after processing** switch, stored per agent. Off: _Process_, review, _Send_.
On: one button, _Process and send to [agent]_. If the send is refused your processed text stays in the box.

### Also send (re-send to another agent)

To send prompts you already processed to another agent **with no new processing and no extra cost**: open the **IN log**,
press **Also send**, tick one or more English texts, pick the receiving agent and press **Send to [agent]**. The bar tells you
the target's state _before_ you press: unchecked folder (blocked), same project, **different project** (you must tick a
confirmation — nothing is sent to another project silently), session will start automatically, or the agent is busy (texts
are sent in order after it finishes).

### Bridge sessions

Agent sessions live **in the bridge, not in the page**: they keep running after you close the browser and across a TOSO
restart (the bridge is reused). The **Bridge sessions** panel lists live sessions (_Connect to session_, _End session_) and
recently closed ones (_Open session_ starts a new session in the same folder; the old conversation is not restored). The
bridge allows 8 live sessions. TOSO never ends a session on a timer — a long task stays yours to end. Stopping the bridge
ends all its sessions.

## 7. Troubleshooting

| Symptom                                                         | Cause                                                             | Fix                                                                                                                    |
| --------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| "Bridge offline" badge                                          | The bridge is not running                                         | `npm run start:all` (or `npm run bridge`)                                                                              |
| "Token rejected"                                                | An old manual token in Settings                                   | Clear the address and token fields so automatic pairing returns                                                        |
| A newly installed agent does not show up                        | The bridge has the old `PATH`                                     | Restart TOSO                                                                                                           |
| `Not logged in` (Devin, Claude…)                                | You never logged in                                               | Log in once from your normal terminal                                                                                  |
| Everything fails with `http_403` although `.env.local` is right | An old system variable with the same name shadows the file        | Remove it from your user environment, or `Remove-Item Env:AGENT_PLATFORM_API_KEY` before starting                      |
| `fatal: unable to access 'NUL'` inside Gemini CLI (Windows)     | Gemini CLI vs Git for Windows 2.56.0 (`git-for-windows/git#6449`) | Update Git to `2.56.0.windows.2` or newer (`winget upgrade --id Git.Git -e`)                                           |
| "The bridge reached its limit (8 live sessions)"                | Sessions outlive the page                                         | End unneeded ones in _Bridge sessions_, or restart the bridge                                                          |
| Hermes replies `HTTP 429: Token quota exhausted`                | Hermes' own model provider has no credit (not TOSO)               | `hermes config set model.default gemini-3.8-flash` then `hermes config set model.provider gemini`; restart its session |
| No embedded terminals on Linux                                  | `node-pty` has no prebuilt binary                                 | Install build tools and reinstall; otherwise one-shot runs are used                                                    |
| The session will not start                                      | ① has not succeeded for the current path                          | Check the folder                                                                                                       |
| Unwanted UI text in OUT                                         | A new agent UI pattern                                            | Open `raw capture` on that turn and report it with the agent's name                                                    |

## 8. Security in two lines

- The bridge listens on `127.0.0.1` only, every request needs the session token, and the agent list is a fixed allowlist.
- TOSO never enables auto-approve modes (`--yolo`, `--dangerously-skip-permissions`); "trust" here means the folder only.
  Details: [SECURITY.md](../SECURITY.md).
