# Bridge - AI Context File

> **Note to AI Agents:** This file, `LLM.md`, is your primary source of truth for understanding the Bridge architecture. Read this first to ground yourself in the codebase.

## Project Overview
**Bridge** is a local-first, single-binary Kubernetes dashboard designed to simplify access to EKS clusters.
-   **Philosophy:** "Local-first". No complex server installs. Runs on the user's machine.
-   **Key Feature:** Proxies Kubernetes API requests using the user's local `kubeconfig` and AWS SSO credentials. It replaces the need for `aws-iam-authenticator` by generating EKS tokens natively within the backend.

## Tech Stack

### Backend
-   **Language:** Go (v1.24+)
-   **Framework:** Gin (`github.com/gin-gonic/gin`)
-   **Kubernetes:** `k8s.io/client-go` (v0.34.2)
-   **AWS:** `github.com/aws/aws-sdk-go-v2` (SSO, SSOOIDC, STS)
-   **Architecture:** REST API + WebSockets (for logs/shells).
-   **Key Libraries:** `gorilla/websocket`, `helm.sh/helm/v3`.

### Frontend
-   **Build Tool:** Vite
-   **Framework:** React (v18+) with TypeScript
-   **State Management:**
    -   **Server State:** `@tanstack/react-query` (v5)
    -   **Global UI State:** `zustand` (v4) (e.g., `namespaceStore`, `uiStore`)
-   **Styling:** Tailwind CSS + Shadcn UI (`lucide-react` icons)
-   **Routing:** `react-router-dom` (though typically single-page feel)

## Repository Map

```text
/
├── backend/
│   ├── main.go                 # Entry point. Sets up Gin router & K8s service.
│   ├── internal/
│   │   ├── api/
│   │   │   ├── router.go       # Route definitions grouping handlers
│   │   │   └── handlers/       # HTTP Handlers (Logic layer)
│   │   │       ├── cluster.go  # K8s resources (Pods, Events, etc.)
│   │   │       ├── aws_sso.go  # AWS SSO & Context Mapping logic
│   │   │       └── ...
│   │   └── k8s/
│   │       ├── service.go      # Core Service struct. Wraps client-go.
│   │       ├── client.go       # Client creation & config loading.
│   │       └── manager.go      # Context/Cluster management.
│   └── types/                  # Shared Go structs (often mirrored in TS)
│
├── frontend/
│   ├── src/
│   │   ├── api/                # Fetch wrappers (e.g., pods.ts, nodes.ts)
│   │   ├── hooks/              # React Query hooks (e.g., useCluster.ts)
│   │   ├── store/              # Zustand stores (useNamespaceStore)
│   │   ├── components/         # React components
│   │   │   ├── ui/             # Shadcn UI primitives
│   │   │   ├── pods/           # Feature-specific (PodDetailSheet, etc.)
│   │   │   └── ...
│   │   ├── pages/              # Page views (PodsPage, NodesPage)
│   │   └── types/              # TS interfaces (mirrors backend structs)
│   └── index.css               # Tailwind directives
│
└── dev.sh                      # Helper script to run backend backend
```

## Critical Workflows

### 1. Data Fetching Cycle "The Bridge Pattern"
Data flows from K8s to the UI in a strict path:
1.  **Kubernetes:** Resource exists (e.g., a Pod).
2.  **Backend (Service):** `internal/k8s/service.go` fetches via `client-go`.
3.  **Backend (Handler):** `internal/api/handlers/cluster.go` calls Service, formats JSON.
4.  **Frontend (API):** `src/api/pods.ts` makes `fetch('/api/v1/...')` call.
5.  **Frontend (Hook):** `src/hooks/useCluster.ts` wraps API in `useQuery`.
6.  **Frontend (UI):** Component (e.g., `PodsPage.tsx`) consumes hook data.

### 2. AWS SSO Authentication Flow
Bridge handles AWS Auth internally to avoid external dependencies.
-   **Start:** User triggers login via UI (`IntegrationSettings.tsx` -> `aws_sso.go`).
-   **Device Code:** Backend calls `sso.StartDeviceAuthorization`.
-   **Token:** Backend polls `sso.CreateToken`.
-   **Mapping:** `MapContext` handler links a K8s Context (e.g., `arn:aws:eks...`) to an AWS Role.
-   **EKS Access:** When accessing a cluster, `k8s/client.go` uses the mapped AWS credentials to generate a **native EKS Bearer Token** (signed URL) to authenticate with the K8s API server.

## Development Standards

### Naming Conventions
-   **Go:** `CamelCase` for structs/fields (exported). `snake_case` for filenames.
-   **TS:** `PascalCase` for Components/Interfaces. `camelCase` for functions/variables.
-   **Files:** `kebab-case` for frontend files (e.g., `data-table.tsx`), or `PascalCase` for Components (`PodDetailSheet.tsx`).

### Type Safety
-   Always check `backend/internal/api/types` (if exists) or struct definitions in `service.go`.
-   Ensure `frontend/src/types/api.ts` is manually kept in sync with Backend JSON responses.
-   **Diffs:** When adding a field to a Go struct, immediately add it to the TS interface.

### State Rules
-   **Global UI State:** Use `src/store/*.ts` (Zustand). Example: Selected ID, Namespace filter.
-   **Data Caching:** Use `React Query` hooks. Do NOT manually store API data in Zustand/Context/State unless absolutely necessary.

## Operational Commands

-   **Run Dev (Backend):** `./dev.sh` (or `go run main.go`)
-   **Run Dev (Frontend):** `cd frontend && npm run dev`
-   **Build Binary:** `./build.sh`
