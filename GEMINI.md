# GEMINI.md - Fireside Project Mandates

This document serves as the foundational mandate for all AI development within the `fireside` workspace. These instructions take absolute precedence over general defaults.

## Project Vision
**Fireside** is a specialized AI desktop assistant platform where multiple specialized agents (Librarian, Chef, Postman, Repairman, Cleaner) collaborate around a "campfire" UI to help users manage their personal knowledge (Neurostars) and system tasks.

## Technical Architecture

### Tech Stack
- **Framework:** Electron + React (TypeScript)
- **Build System:** `electron-vite`
- **AI Integration:** OpenAI SDK via OpenRouter (Primary model: `openrouter/free`)
- **Animations:** Framer Motion
- **State Management:** Custom React hooks + IPC-based persistence

### Core Components
- **Main Process (`src/main`):** Handles LLM orchestration, tool execution (filesystem/terminal), and IPC.
- **Renderer Process (`src/renderer`):** Handles the campfire UI, agent bubbles, and chat panels.
- **Agents (`src/main/agents.ts`):** Defines agent personalities and the Orchestrator logic.
- **Tools (`src/main/index.ts`):** Agents have access to a suite of `FS_TOOLS` for markdown note management in the `NEUROSTARS_PATH`.

## Engineering Standards

### 1. IPC and API Bridge
- All communication between Renderer and Main must go through the context-isolated bridge in `src/preload/index.ts`.
- Use `window.api` for IPC calls in the React frontend.
- **Never** expose sensitive Node.js APIs directly to the renderer.

### 2. AI Agent Implementation
- Agents are defined by `AgentDefinition` in `src/main/agents.ts`.
- When adding a new agent, ensure it has a unique emoji, color, and a clearly defined `systemPrompt` in Korean.
- The Orchestrator (`ORCHESTRATOR_PROMPT`) must be updated if the agent pool changes.

### 3. File System & Tools
- All note-related operations must happen within the `NEUROSTARS_PATH` (defaults to `~/Documents/Neurostars`).
- Tool calls are handled via an iterative loop in `chat:send` within `src/main/index.ts`.
- Ensure all tool-calling logic remains robust and handles JSON parsing errors gracefully.

### 4. UI/UX Style
- The application uses a "floating overlay" design (small initial window size, transparent, always on top).
- Follow the CSS Modules pattern (`*.module.css`) for component styling.
- Maintain the "cozy campfire" aesthetic using Framer Motion animations and specific agent colors.

### 5. Code Quality
- Strictly use TypeScript for both Main and Renderer processes.
- Adhere to the existing project structure: `components`, `hooks`, `store`, `types`.
- All user-facing agent dialogue and prompts should be in **Korean**.

## Development Workflow
- **Run Dev:** `pnpm dev`
- **Build:** `pnpm build`
- **Note Management:** All markdown notes are stored in the path defined by `NEUROSTARS_PATH` in `.env`.
