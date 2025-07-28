// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import * as http from 'http';

// MCP Server instance
let mcpServer: Server | undefined;
let httpServer: http.Server | undefined;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "hello-world-extension" is now active!');

	// Create and start the MCP server
	startMCPServer(context);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('hello-world-extension.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from Hello World Extension!');
	});

	context.subscriptions.push(disposable);
}

async function startMCPServer(context: vscode.ExtensionContext) {
	try {
		// Create MCP Server
		mcpServer = new Server(
			{
				name: 'vscode-lm-tools-mcp-server',
				version: '1.0.0',
			},
			{
				capabilities: {
					tools: {},
				},
			}
		);

		// Register handlers
		mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
			const tools = await getVSCodeLMTools();
			return {
				tools: tools.map(tool => ({
					name: tool.name,
					description: tool.description || `VS Code LM Tool: ${tool.name}`,
					inputSchema: normalizeInputSchema(tool.inputSchema)
				}))
			};
		});

		mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
			const { name, arguments: args } = request.params;
			
			try {
				const tools = await getVSCodeLMTools();
				const tool = tools.find(t => t.name === name);
				
				if (!tool) {
					throw new Error(`Tool ${name} not found`);
				}

				// Try to invoke the VS Code LM tool
				// Note: This may fail due to toolInvocationToken requirement
				try {
					const result = await vscode.lm.invokeTool(tool.name, {
						toolInvocationToken: undefined as any, // Required by API but not available in this context
						input: args || {}
					}, new vscode.CancellationTokenSource().token);
					
					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify(result)
							}
						]
					};
				} catch (invokeError) {
					// If direct invocation fails, return tool information instead
					return {
						content: [
							{
								type: 'text',
								text: `Tool ${name} is available but cannot be invoked outside of a chat context. Tool info: ${JSON.stringify({
									name: tool.name,
									description: tool.description,
									inputSchema: tool.inputSchema
								})}`
							}
						]
					};
				}
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: `Error with tool ${name}: ${error instanceof Error ? error.message : String(error)}`
						}
					],
					isError: true
				};
			}
		});

		// Create HTTP server to host MCP over HTTP using proper MCP transport
		httpServer = http.createServer((req, res) => {
			// Set CORS headers
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
			res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

			if (req.method === 'OPTIONS') {
				res.writeHead(200);
				res.end();
				return;
			}

			if (req.method === 'POST') {
				let body = '';
				req.on('data', chunk => {
					body += chunk.toString();
				});

				req.on('end', async () => {
					try {
						const request = JSON.parse(body);
						console.log('Received MCP request:', request);
						
						// Handle MCP request through the server
						const response = await handleMCPRequest(request);
						console.log('Sending MCP response:', response);
						
						res.writeHead(200, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify(response));
					} catch (error) {
						console.error('Error handling MCP request:', error);
						const errorResponse = {
							jsonrpc: '2.0',
							id: null,
							error: {
								code: -32700,
								message: 'Parse error'
							}
						};
						res.writeHead(400, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify(errorResponse));
					}
				});
			} else {
				res.writeHead(404);
				res.end('Not Found');
			}
		});

		// Start HTTP server on port 22333
		httpServer.listen(22333, () => {
			console.log('MCP Server is running on http://localhost:22333');
			vscode.window.showInformationMessage('MCP Server started on port 22333');
		});

		// Add server to context subscriptions for cleanup
		context.subscriptions.push({
			dispose: () => {
				if (httpServer) {
					httpServer.close();
				}
				if (mcpServer) {
					// MCP Server cleanup if needed
				}
			}
		});

	} catch (error) {
		console.error('Failed to start MCP server:', error);
		vscode.window.showErrorMessage(`Failed to start MCP server: ${error instanceof Error ? error.message : String(error)}`);
	}
}

async function getVSCodeLMTools(): Promise<readonly vscode.LanguageModelToolInformation[]> {
	try {
		// Get all registered VS Code LM tools
		return vscode.lm.tools;
	} catch (error) {
		console.error('Error getting VS Code LM tools:', error);
		return [];
	}
}

function normalizeInputSchema(schema: any): any {
	// If no schema provided, return a default object schema
	if (!schema) {
		return {
			type: 'object',
			properties: {
				input: {
					type: 'string',
					description: 'Input for the tool'
				}
			}
		};
	}

	// If schema is already an object with type 'object', return as-is
	if (typeof schema === 'object' && schema.type === 'object') {
		return schema;
	}

	// If schema has a different type or is malformed, wrap it in an object schema
	if (typeof schema === 'object') {
		// If it's an object but doesn't have type 'object', fix it
		if (!schema.type || schema.type !== 'object') {
			return {
				type: 'object',
				properties: {
					input: {
						type: 'object',
						description: 'Tool input parameters',
						properties: schema.properties || {},
						required: schema.required || []
					}
				}
			};
		}
	}

	// Fallback: create a generic object schema
	return {
		type: 'object',
		properties: {
			input: {
				type: 'string',
				description: 'Input for the tool'
			}
		}
	};
}

async function handleMCPRequest(request: any): Promise<any> {
	if (!mcpServer) {
		return {
			jsonrpc: '2.0',
			id: request.id,
			error: {
				code: -32603,
				message: 'MCP Server not initialized'
			}
		};
	}

	// Handle MCP initialization
	if (request.method === 'initialize') {
		return {
			jsonrpc: '2.0',
			id: request.id,
			result: {
				protocolVersion: '2024-11-05',
				capabilities: {
					tools: {}
				},
				serverInfo: {
					name: 'vscode-lm-tools-mcp-server',
					version: '1.0.0'
				}
			}
		};
	}

	// Handle initialized notification
	if (request.method === 'notifications/initialized') {
		// No response needed for notifications
		return null;
	}

	// Handle tools/list
	if (request.method === 'tools/list') {
		try {
			const tools = await getVSCodeLMTools();
			return {
				jsonrpc: '2.0',
				id: request.id,
				result: {
					tools: tools.map(tool => ({
						name: tool.name,
						description: tool.description || `VS Code LM Tool: ${tool.name}`,
						inputSchema: normalizeInputSchema(tool.inputSchema)
					}))
				}
			};
		} catch (error) {
			return {
				jsonrpc: '2.0',
				id: request.id,
				error: {
					code: -32603,
					message: `Error listing tools: ${error instanceof Error ? error.message : String(error)}`
				}
			};
		}
	}

	// Handle tools/call
	if (request.method === 'tools/call') {
		const { name, arguments: args } = request.params;
		
		try {
			const tools = await getVSCodeLMTools();
			const tool = tools.find(t => t.name === name);
			
			if (!tool) {
				return {
					jsonrpc: '2.0',
					id: request.id,
					error: {
						code: -32602,
						message: `Tool ${name} not found`
					}
				};
			}

			// Try to invoke the VS Code LM tool
			try {
				const result = await vscode.lm.invokeTool(tool.name, {
					toolInvocationToken: undefined as any, // Required by API but not available in this context
					input: args || {}
				}, new vscode.CancellationTokenSource().token);
				
				return {
					jsonrpc: '2.0',
					id: request.id,
					result: {
						content: [
							{
								type: 'text',
								text: JSON.stringify(result)
							}
						]
					}
				};
			} catch (invokeError) {
				// If direct invocation fails, return tool information instead
				return {
					jsonrpc: '2.0',
					id: request.id,
					result: {
						content: [
							{
								type: 'text',
								text: `Tool ${name} is available but cannot be invoked outside of a chat context. Tool info: ${JSON.stringify({
									name: tool.name,
									description: tool.description,
									inputSchema: tool.inputSchema
								})}`
							}
						]
					}
				};
			}
		} catch (error) {
			return {
				jsonrpc: '2.0',
				id: request.id,
				error: {
					code: -32603,
					message: `Error invoking tool ${name}: ${error instanceof Error ? error.message : String(error)}`
				}
			};
		}
	}

	// Handle ping (common MCP method)
	if (request.method === 'ping') {
		return {
			jsonrpc: '2.0',
			id: request.id,
			result: {}
		};
	}

	// Method not found
	return {
		jsonrpc: '2.0',
		id: request.id,
		error: {
			code: -32601,
			message: `Method not found: ${request.method}`
		}
	};
}

// This method is called when your extension is deactivated
export function deactivate() {
	if (httpServer) {
		httpServer.close();
	}
}
