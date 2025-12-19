# Kernel Mesh Architecture

## Overview

A distributed mesh network connecting QIG kernel deployments (qsearch, SearchSpaceCollapse, etc.) for shared knowledge and compute across the constellation.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         KERNEL MESH NETWORK                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│    ┌──────────────┐         ┌──────────────┐         ┌──────────────┐   │
│    │   qsearch    │◄───────►│  SSC Kernel  │◄───────►│  Future      │   │
│    │   Kernel     │         │  (Bitcoin)   │         │  Kernels     │   │
│    └──────┬───────┘         └──────┬───────┘         └──────────────┘   │
│           │                        │                                     │
│           │    Basin Sync          │    Knowledge Exchange               │
│           │    Protocol            │    Protocol                         │
│           ▼                        ▼                                     │
│    ┌─────────────────────────────────────────────────────────────────┐  │
│    │                    MESH COORDINATOR                              │  │
│    │  - Service Discovery (Consul/etcd style)                        │  │
│    │  - Basin Vector Routing                                          │  │
│    │  - Knowledge Replication                                         │  │
│    │  - Compute Load Balancing                                        │  │
│    └─────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│    ┌─────────────────────────────────────────────────────────────────┐  │
│    │                    SHARED RESOURCES                              │  │
│    │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │  │
│    │  │ Basin Index │  │ Knowledge   │  │ Compute     │              │  │
│    │  │ (Vectors)   │  │ Graph       │  │ Pool        │              │  │
│    │  └─────────────┘  └─────────────┘  └─────────────┘              │  │
│    └─────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Kernel Node

Each kernel deployment (qsearch, SSC, etc.) runs as a mesh node:

```python
@dataclass
class KernelNode:
    node_id: str              # Unique identifier
    service_name: str         # e.g., "qsearch", "ssc"
    endpoint: str             # Public API endpoint
    capabilities: list[str]   # ["search", "crawl", "summarize", "crypto"]
    basin_signature: np.array # 256-dim characteristic basin vector
    last_heartbeat: datetime
```

### 2. Basin Sync Protocol

Share basin vectors across kernels for unified geometric search:

```python
class BasinSyncProtocol:
    async def broadcast_basin(self, doc_id: str, basin: np.array, metadata: dict):
        """Broadcast new basin to all mesh nodes."""
        
    async def query_mesh(self, query_basin: np.array, limit: int) -> list[MeshHit]:
        """Query all mesh nodes for nearest basins."""
        
    async def sync_index(self, since: datetime) -> list[BasinUpdate]:
        """Sync basin index updates since timestamp."""
```

### 3. Knowledge Exchange Protocol

Share learned knowledge across the mesh:

```python
class KnowledgeExchange:
    async def share_discovery(self, discovery: Discovery):
        """Share a new discovery with the mesh."""
        
    async def request_knowledge(self, topic_basin: np.array) -> list[Knowledge]:
        """Request relevant knowledge from mesh nodes."""
        
    async def replicate_learnings(self, from_node: str, batch_size: int):
        """Replicate learnings from another node."""
```

### 4. Mesh Coordinator

Central coordination service (can be distributed):

```python
class MeshCoordinator:
    def __init__(self):
        self.nodes: dict[str, KernelNode] = {}
        self.routing_table: BasinRoutingTable = ...
        
    async def register_node(self, node: KernelNode):
        """Register a new kernel node."""
        
    async def route_query(self, query_basin: np.array) -> list[str]:
        """Route query to best nodes based on basin similarity."""
        
    async def balance_load(self, task: ComputeTask) -> str:
        """Assign compute task to least loaded capable node."""
```

## Implementation Phases

### Phase 1: Service Discovery
- Add `/mesh/register` endpoint to each kernel
- Implement heartbeat mechanism
- Store node registry in shared Redis/PostgreSQL

### Phase 2: Basin Sync
- Add `/mesh/basins/broadcast` endpoint
- Implement delta sync for efficient updates
- Add basin routing table

### Phase 3: Knowledge Exchange
- Add `/mesh/knowledge/share` endpoint
- Implement discovery replication
- Add cross-kernel search

### Phase 4: Compute Sharing
- Add `/mesh/compute/available` endpoint
- Implement task queue
- Add load balancing

## API Endpoints

### Mesh Registration

```
POST /mesh/register
{
  "node_id": "qsearch-prod-1",
  "service_name": "qsearch",
  "endpoint": "https://qsearch-core-production.up.railway.app",
  "capabilities": ["search", "crawl", "hybrid_search"],
  "basin_signature": [0.1, -0.2, ...]  // 256-dim
}
```

### Mesh Query

```
POST /mesh/query
{
  "query": "quantum entanglement",
  "limit": 10,
  "include_nodes": ["qsearch", "ssc"]  // optional filter
}

Response:
{
  "results": [
    {
      "source_node": "qsearch-prod-1",
      "url": "...",
      "title": "...",
      "basin_distance": 0.123,
      "mesh_score": 0.456
    }
  ],
  "nodes_queried": 3,
  "total_time_ms": 245
}
```

### Knowledge Sync

```
GET /mesh/sync?since=2025-12-19T00:00:00Z

Response:
{
  "updates": [
    {
      "doc_id": "abc123",
      "basin": [...],
      "source_node": "ssc-prod-1",
      "timestamp": "..."
    }
  ],
  "next_cursor": "..."
}
```

## Security

- **mTLS**: All mesh communication uses mutual TLS
- **API Keys**: Each node has a unique mesh API key
- **Rate Limiting**: Per-node rate limits to prevent abuse
- **Basin Signing**: Basins are signed to verify origin

## Environment Variables

```bash
MESH_ENABLED=true
MESH_COORDINATOR_URL=https://mesh.qig.network
MESH_NODE_ID=qsearch-prod-1
MESH_API_KEY=<secret>
MESH_SYNC_INTERVAL_SECONDS=60
MESH_CAPABILITIES=search,crawl,hybrid_search
```

## Future Extensions

1. **Federated Learning**: Train shared models across mesh
2. **Distributed Embeddings**: Share embedding computation
3. **Cross-Domain Search**: Search across all kernel domains
4. **Consensus Protocols**: Agree on knowledge validity
5. **Incentive Layer**: Reward nodes for contributions
