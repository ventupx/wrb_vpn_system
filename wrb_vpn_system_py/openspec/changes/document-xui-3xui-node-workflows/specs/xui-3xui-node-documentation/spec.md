## ADDED Requirements

### Requirement: Documentation SHALL identify panel prerequisites and authentication inputs
The project SHALL provide a reference document that identifies the panel fields and runtime connection parameters required before any x-ui or 3x-ui node creation or update request can be sent.

#### Scenario: Reader checks required panel fields
- **WHEN** a maintainer reads the document before tracing node creation logic
- **THEN** the document SHALL list the relevant `AgentPanel` fields and the runtime `panel_info` or `host_config` fields used for login and authenticated requests

### Requirement: Documentation SHALL describe node creation payloads for x-ui and 3x-ui
The project SHALL provide a reference document that describes the payload structure used to create nodes on x-ui and 3x-ui panels, including shared fields, protocol-specific fields, and how nested JSON is transformed before submission.

#### Scenario: Reader traces protocol-specific create payload
- **WHEN** a maintainer looks up how `vmess`, `vless`, `shadowsocks`, `socks`, or `http` nodes are created
- **THEN** the document SHALL describe the key fields in `settings`, `streamSettings`, `sniffing`, and any protocol-specific differences between x-ui and 3x-ui

### Requirement: Documentation SHALL describe node update and migration submissions
The project SHALL provide a reference document that explains how existing node configuration is reused for renewals, updates, and panel migration, including update endpoints, `config_text` reuse, nested field serialization, and node ID recovery.

#### Scenario: Reader checks how node update is sent
- **WHEN** a maintainer looks up the renew or migrate flow
- **THEN** the document SHALL identify the update or add endpoints used by x-ui and 3x-ui, the request submission mode, and how `panel_node_id` is obtained after migration

### Requirement: Documentation SHALL describe x-ui vless version branching
The project SHALL provide a reference document that captures the x-ui version check behavior used for `vless` nodes, including the `/server/status` request, the inspected version field, and the resulting `flow` assignment.

#### Scenario: Reader checks version-based vless behavior
- **WHEN** a maintainer needs to understand why x-ui `vless` settings differ across flows
- **THEN** the document SHALL state that the code checks the Xray version and sets `flow` to an empty string for `25.3.6`, otherwise sets `flow` to `xtls-rprx-direct`
