# 🌉 Bridge

**A modern, single-binary Kubernetes dashboard for platform teams.**

Bridge provides RBAC-scoped kubeconfig generation with built-in expiration and cleanup, making it easy to grant temporary access to your clusters without the overhead of traditional identity providers.

![Bridge Dashboard](https://img.shields.io/badge/Kubernetes-Dashboard-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white)
![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?style=for-the-badge&logo=go&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

---

## ✨ Features

### 🎫 Access Control
- **Scoped Kubeconfig Generation** — Create time-limited kubeconfigs with precise RBAC permissions
- **Namespace-Level Isolation** — Grant access to specific namespaces only
- **Automatic Expiration** — Built-in janitor cleans up expired ServiceAccounts, Roles, and RoleBindings
- **Zero Database** — Purely stateless, uses Kubernetes as the source of truth

### 📊 Dashboard
- **Mission Control** — Real-time cluster health, active users, and expiring tokens at a glance
- **Workload Explorer** — Browse Pods, Deployments, StatefulSets, DaemonSets, and CronJobs
- **Network View** — Services, Ingresses, and Network Policies
- **Storage Management** — PVCs, PVs, and Storage Classes
- **Configuration** — ConfigMaps and Secrets with reveal functionality
- **RBAC Viewer** — ServiceAccounts, Roles, RoleBindings, ClusterRoles

### 🗺️ Visualization
- **Topology Map** — Interactive visualization of Ingress → Service → Deployment → Pod relationships
- **Context Switching** — Seamlessly switch between multiple Kubernetes clusters
- **Real-time Logs** — Stream pod logs via WebSocket

### ⚡ Developer Experience
- **Single Binary** — No external dependencies, just download and run
- **Embedded UI** — Frontend compiled into the Go binary
- **Port Forwarding** — Built-in tunnel management for local development

---

## 🚀 Quick Start

### Download

Grab the latest release for your platform:

| Platform | Download |
|----------|----------|
| Linux (AMD64) | `bridge-linux-amd64` |
| Linux (ARM64) | `bridge-linux-arm64` |
| macOS (Intel) | `bridge-darwin-amd64` |
| macOS (Apple Silicon) | `bridge-darwin-arm64` |
| Windows | `bridge-windows-amd64.exe` |

### Run

```bash
# Linux / macOS
chmod +x bridge-*
./bridge-linux-amd64  # or your platform

# Windows
.\bridge-windows-amd64.exe
```

Open **http://localhost:8080** in your browser.

> **Note:** Bridge uses your local `~/.kube/config` to connect to clusters. Make sure you have a valid kubeconfig.

---

## 🏗️ Building from Source

### Prerequisites

- Go 1.21+
- Node.js 18+
- npm

### Development

```bash
# Clone the repo
git clone https://github.com/yourusername/bridge.git
cd bridge

# Start frontend dev server (Terminal 1)
cd frontend && npm install && npm run dev

# Start backend (Terminal 2)
cd backend && go run .
```

Frontend runs on `http://localhost:3000` with hot reload.
Backend API runs on `http://localhost:8080`.

### Production Build

```bash
# Build single binary for current platform
make build
./backend/bridge

# Build release binaries for all platforms
make release
ls -la bin/
```

---

## 🎛️ Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `KUBECONFIG` | `~/.kube/config` | Path to kubeconfig file |

---

## 📸 Screenshots

<details>
<summary>Click to expand screenshots</summary>

### Mission Control Dashboard
Real-time overview of cluster health, active access grants, and quick actions.

### Team Access Control
Generate scoped kubeconfigs with specific permissions and expiration times.

### Topology Map
Interactive visualization of your cluster's network topology.

### Workload Explorer
Browse and manage pods, deployments, and other workloads.

</details>

---

## 🔐 How Access Control Works

1. **Admin creates access grant** with:
   - User label (for identification)
   - Target namespace
   - Permission level (read-only, power-user, or custom)
   - Expiration duration (or permanent)

2. **Bridge creates Kubernetes resources**:
   - `ServiceAccount` with labels and annotations
   - `Role` with specified permissions
   - `RoleBinding` to connect them
   - Token via `TokenRequest` API

3. **User receives kubeconfig** that works immediately

4. **Janitor cleans up** expired resources every 10 minutes

All state lives in Kubernetes — Bridge itself is completely stateless.

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Go, Gin, client-go |
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui |
| State | TanStack Query, Zustand |
| Visualization | ReactFlow, Dagre |

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

<p align="center">
  <sub>Built with ❤️ for platform engineers who value simplicity</sub>
</p>
