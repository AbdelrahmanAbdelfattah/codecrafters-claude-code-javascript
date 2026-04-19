import OpenAI from "openai";

import fs from "fs";

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

  // stage (Advertise the read tool)
  const response = await client.chat.completions.create({
    model: "anthropic/claude-haiku-4.5",
    messages: [{role: "user", content: prompt}],
    tools: [
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
    ],
  });

  if (!response.choices || response.choices.length === 0) {
    throw new Error("no choices in response");
  }

  // the format of the response when the model calls a tool will look like this:
  //   {
  //   "choices": [
  //     {
  //       "index": 0,
  //       "message": {
  //         "role": "assistant",
  //         "content": null,
  //         "tool_calls": [
  //           {
  //             "id": "call_abc123",
  //             "type": "function",
  //             "function": {
  //               "name": "Read",
  //               "arguments": "{\"file_path\": \"/path/to/file.txt\"}"
  //             }
  //           }
  //         ]
  //       },
  //       "finish_reason": "tool_calls"
  //     }
  //   ]
  // }

  if (response.choices[0].message.tool_calls[0]) {
    const toolCall = response.choices[0].tool_calls[0];
    const args = JSON.parse(toolCall.function.arguments);
    const file_Buffer = fs.readFileSync(args.file_path, "utf-8");
    console.log(file_Buffer);
  } else {
    console.log(response.choices[0].message.content);
  }
  // You can use print statements as follows for debugging, they'll be visible when running tests.
  console.error("Logs from your program will appear here!");

  // TODO: Uncomment the lines below to pass the first stage
  console.log(response.choices[0].message.content);
}

main();
