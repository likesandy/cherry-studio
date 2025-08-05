#!/usr/bin/env -S uv run --script
# /// script
# requires-python = "==3.10"
# dependencies = [
#     "claude-code-sdk",
# ]
# ///
import argparse
import asyncio
import json
import logging
import os
from datetime import datetime, timezone

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


def log_structured_event(event_type: str, data: dict):
    """Output structured log event as JSON to stdout for AgentExecutionService to parse."""
    event = {
        "__CHERRY_AGENT_LOG__": True,
        "timestamp": datetime.now(timezone.utc) .isoformat(),
        "event_type": event_type,
        "data": data
    }
    print(json.dumps(event), flush=True)


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
        print(f"--- Started session: {msg.data.get('session_id', 'unknown')} ---")
        pass
    elif isinstance(msg, ResultMessage):
        cost_info = f" (${msg.total_cost_usd:.4f})" if msg.total_cost_usd else ""
        print(f"--- Finished session: {msg.session_id}{cost_info} ---")
        pass


async def run_claude_query(prompt: str, opts: ClaudeCodeOptions = ClaudeCodeOptions()):
    """Initializes the Claude SDK client and handles the query-response loop."""
    try:
        # Log session initialization
        log_structured_event("session_init", {
            "system_prompt": opts.system_prompt,
            "max_turns": opts.max_turns,
            "permission_mode": opts.permission_mode,
            "cwd": str(opts.cwd) if opts.cwd else None
        })

        # Note: User query is already logged by AgentExecutionService, no need to duplicate

        async with ClaudeSDKClient(opts) as client:
            await client.query(prompt)
            async for msg in client.receive_response():
                # Log structured events for important message types
                if isinstance(msg, SystemMessage):
                    log_structured_event("session_started", {
                        "session_id": msg.data.get('session_id')
                    })
                elif isinstance(msg, AssistantMessage):
                    # Log Claude's response content
                    text_content = []
                    for block in msg.content:
                        if isinstance(block, TextBlock):
                            text_content.append(block.text)
                    
                    if text_content:
                        log_structured_event("assistant_response", {
                            "content": "\n".join(text_content)
                        })
                elif isinstance(msg, ResultMessage):
                    log_structured_event("session_result", {
                        "session_id": msg.session_id,
                        "success": not msg.is_error,
                        "duration_ms": msg.duration_ms,
                        "num_turns": msg.num_turns,
                        "total_cost_usd": msg.total_cost_usd,
                        "usage": msg.usage
                    })

                display_message(msg)
    except Exception as e:
        log_structured_event("error", {
            "error_type": type(e).__name__,
            "error_message": str(e)
        })
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
        # resume=args.session_id,
        continue_conversation=True
    )

    await run_claude_query(args.prompt, opts)


if __name__ == "__main__":
    asyncio.run(main())
