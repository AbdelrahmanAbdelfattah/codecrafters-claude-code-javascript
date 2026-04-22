import OpenAI from "openai";

import fs from "fs";
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
async function main() {
  const [, , flag, prompt] = process.argv;
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseURL =
    process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }
  if (flag !== "-p" || !prompt) {
    throw new Error("error: -p flag is required");
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
  });

  // 1. Initialize the messages array outside the loop
  const messages = [{ role: "user", content: prompt }];

  // 2. Define the tools
  const tools = [
    {
      type: "function",
      function: {
        name: "Read_File",
        description: "Read and return the contents of a file",
        parameters: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "The path to the file to read",
            },
          },
          required: ["file_path"],
        },
      },
    },
    {
      "type": "function",
      "function": {
        "name": "Write_File",
        "description": "Write content to a file",
        "parameters": {
          "type": "object",
          "required": ["file_path", "content"],
          "properties": {
            "file_path": {
              "type": "string",
              "description": "The path of the file to write to"
            },
            "content": {
              "type": "string",
              "description": "The content to write to the file"
            }
          }
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "Bash",
        "description": "Execute a shell command",
        "parameters": {
          "type": "object",
          "required": ["command"],
          "properties": {
            "command": {
              "type": "string",
              "description": "The command to execute"
            }
          }
        }
      }
    }
  ];

  // 3. Start the agent loop
  while (true) {
    const response = await client.chat.completions.create({
      model: "anthropic/claude-haiku-4.5",
      messages: messages,
      tools: tools,
    });

    if (!response.choices || response.choices.length === 0) {
      throw new Error("no choices in response");
    }

    // 4. Always add the assistant's response to the conversation history
    const message = response.choices[0].message;
    messages.push(message);

    // 5. Exit Condition: If the model didn't use any tools, it has the final answer
    if (!message.tool_calls || message.tool_calls.length === 0) {
      if (message.content) {
        console.log(message.content); // Print the final answer
      }
      break; // Stop the loop
    }

    // 6. Handle tool execution: Iterate through requested tools
    for (const toolCall of message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments);
      let fileContent = "";
      if (toolCall.function.name === "Read_File") {
        fileContent = fs.readFileSync(args.file_path, "utf-8");
      }
      else if (toolCall.function.name === "Write_File") {
        const path = args.file_path;
        const content = args.content;
        fs.writeFileSync(path, content);
        fileContent = `Wrote to ${path}`;
      }
      else if (toolCall.function.name === "Bash") {
        try {

          const { stdout, stderr } = await execAsync(args.command);
          fileContent = stderr || stdout || "";
        } catch (error) {
          fileContent = error.message;
        }
      }

      // 7. Push the tool result back into messages (do not print to stdout)
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: fileContent,
      });
    }
  }
  // You can use print statements as follows for debugging, they'll be visible when running tests.
  console.error("Logs from your program will appear here!");
}

main();
