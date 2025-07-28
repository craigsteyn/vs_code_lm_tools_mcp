# VS Code LM Tools MCP Server Extension

A VS Code extension that creates an MCP (Model Context Protocol) server to expose VS Code Language Model tools over HTTP, enabling external applications to access and utilize VS Code's built-in LM tools.

## Features

This extension provides the following functionality:

- **MCP Server**: Creates a Model Context Protocol server that runs on `http://localhost:22333`
- **VS Code LM Tools Integration**: Automatically discovers and exposes all registered VS Code Language Model tools
- **HTTP API**: Provides a REST-like interface for external applications to interact with VS Code LM tools
- **Tool Discovery**: Lists all available VS Code LM tools with their descriptions and input schemas
- **Tool Invocation**: Attempts to invoke VS Code LM tools (with limitations outside chat context)

## How to Use

### Starting the MCP Server

1. Install and activate the extension
2. The MCP server will automatically start on port 22333 when the extension activates
3. You'll see a notification: "MCP Server started on port 22333"

### Accessing the MCP Server

The server exposes the following MCP protocol endpoints:

- **Initialize**: `POST http://localhost:22333` with `{"method": "initialize", ...}`
- **List Tools**: `POST http://localhost:22333` with `{"method": "tools/list", ...}`
- **Call Tool**: `POST http://localhost:22333` with `{"method": "tools/call", ...}`
- **Ping**: `POST http://localhost:22333` with `{"method": "ping", ...}`


## Requirements

- VS Code version 1.102.0 or higher
- Node.js and npm for development
- Network access to localhost port 22333

## Technical Details

### MCP Protocol Implementation

The extension implements a subset of the Model Context Protocol (MCP) v2024-11-05:

- **Server Info**: `vscode-lm-tools-mcp-server` v1.0.0
- **Capabilities**: Supports tools discovery and invocation
- **Transport**: HTTP with JSON-RPC 2.0 format
- **CORS**: Enabled for cross-origin requests

### VS Code LM Tools Integration

- Automatically discovers all registered [`vscode.lm.tools`](src/extension.ts:194)
- Normalizes tool input schemas to ensure MCP compatibility
- Handles tool invocation with proper error handling
- Provides detailed tool information when direct invocation fails

### Limitations

- Tool invocation requires a `toolInvocationToken` which is only available in chat contexts
- Outside of chat contexts, the server returns tool metadata instead of execution results
- Some VS Code LM tools may not be accessible depending on the current workspace and context

## Extension Settings

This extension does not currently contribute any VS Code settings.

## Known Issues

- Direct tool invocation may fail outside of VS Code chat contexts due to `toolInvocationToken` requirements
- Tool availability depends on other installed extensions and workspace configuration
- Server runs on a fixed port (22333) which may conflict with other applications

## Release Notes

### 0.0.1

Initial release featuring:
- MCP server implementation with HTTP transport
- VS Code LM tools discovery and exposure
- Basic tool invocation with fallback to metadata

## Development

### Building the Extension

```bash
npm install
npm run compile
```

### Running Tests

```bash
npm test
```

### Packaging

```bash
npm run package
```

## MCP Client Usage

To connect to this MCP server from an MCP client, add the following configuration to your `mcp.json` file:

### Streamable HTTP Transport (Recommended)

```json
{
  "servers": {
    "vscode": {
      "type": "streamable-http",
      "url": "http://localhost:22333"
    }
  }
}
```

### Standard HTTP Transport

```json
{
  "servers": {
    "vscode": {
      "type": "http",
      "url": "http://localhost:22333"
    }
  }
}
```

### Prerequisites

1. Ensure this VS Code extension is installed and active
2. The MCP server will automatically start on port 22333
3. Your MCP client should be configured to connect to the above URL

### Available Operations

Once connected, your MCP client will have access to:
- **Tool Discovery**: Automatically list all VS Code LM tools
- **Tool Invocation**: Execute VS Code LM tools (with context limitations)
- **Schema Information**: Access input schemas for each tool

## Dependencies

- [`@modelcontextprotocol/sdk`](package.json:52): Core MCP SDK for server implementation
- VS Code API: For accessing Language Model tools and extension functionality

## Contributing

This extension follows VS Code extension development best practices:

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
* [VS Code API Documentation](https://code.visualstudio.com/api)

## License

See the [LICENSE](LICENSE) file for details.
