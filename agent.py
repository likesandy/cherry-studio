import argparse
import asyncio
import logging
import os

from claude_code_sdk import ClaudeCodeOptions, ClaudeSDKClient, Message
from claude_code_sdk.types import (
    SystemMessage,
    UserMessage,
    ResultMessage,
    AssistantMessage,
    TextBlock,
    ToolUseBlock,
    ToolResultBlock
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def display_message(msg: Message):
    """Standardized message display function.

    - UserMessage: "User: <content>"
    - AssistantMessage: "Claude: <content>"
    - SystemMessage: ignored
    - ResultMessage: "Result ended" + cost if available
    """
    if isinstance(msg, UserMessage):
        for block in msg.content:
            if isinstance(block, TextBlock):
                print(f"User: {block.text}")
    elif isinstance(msg, AssistantMessage):
        for block in msg.content:
            if isinstance(block, TextBlock):
                print(f"Claude: {block.text}")
            elif isinstance(block, ToolUseBlock):
                print(f"Tool: {block}")
            elif isinstance(block, ToolResultBlock):
                print(f"Tool Result: {block}")
    elif isinstance(msg, SystemMessage):
        print(f"--- Started session: {msg.data['session_id']} ---")
        pass
    elif isinstance(msg, ResultMessage):
        print(f"--- Finished session: {msg.session_id} ---")
        pass


async def run_claude_query(prompt: str, opts: ClaudeCodeOptions = ClaudeCodeOptions()):
    """Initializes the Claude SDK client and handles the query-response loop."""
    try:
        async with ClaudeSDKClient(opts) as client:
            await client.query(prompt)
            async for msg in client.receive_response():
                display_message(msg)
    except Exception as e:
        logger.error(f"An error occurred: {e}")


async def main():
    """Parses command-line arguments and runs the Claude query."""
    parser = argparse.ArgumentParser(description="Claude Code SDK Example")
    parser.add_argument(
        "--prompt",
        "-p",
        required=True,
        help="User prompt",
    )
    parser.add_argument(
        "--cwd",
        type=str,
        default=os.path.join(os.getcwd(), "sessions"),
        help="Working directory for the session. Defaults to './sessions'.",
    )
    parser.add_argument(
        "--system-prompt",
        type=str,
        default="You are a helpful assistant.",
        help="System prompt",
    )
    parser.add_argument(
        "--permission-mode",
        type=str,
        default="default",
        choices=["default", "acceptEdits", "bypassPermissions"],
        help="Permission mode for file edits.",
    )
    parser.add_argument(
        "--max-turns",
        type=int,
        default=10,
        help="Maximum number of conversation turns.",
    )
    parser.add_argument(
        "--session-id",
        "-s",
        default=None,
        help="The session ID to resume an existing session.",
    )
    args = parser.parse_args()

    # Ensure the working directory exists
    os.makedirs(args.cwd, exist_ok=True)

    opts = ClaudeCodeOptions(
        system_prompt=args.system_prompt,
        max_turns=args.max_turns,
        permission_mode=args.permission_mode,
        cwd=args.cwd,
        resume=args.session_id,
    )

    await run_claude_query(args.prompt, opts)


if __name__ == "__main__":
    asyncio.run(main())

