# Changes


## 1.0.0
- Project init (pendindg docs)

## 1.0.1

- Added shutdown method to PingService
- Added isShuttingDown flag
- Added graceful shutdown handling
- Added shutdown status check
- Added safe guards around database operations

- Moved cleanup logic to a separate method
- Added proper timeout handling
- Better WebSocket connection management
- Fixed race conditions in shutdown
- Added error handling for message parsing
- Better status reporting