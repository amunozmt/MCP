# MCP
https://github.com/aaddrick/claude-desktop-debian


curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.4/install.sh | bash
source ~/.bashrc   # o source ~/.zshrc, según tu shell


nvm install --lts     # instala la última LTS (por ejemplo, v20.x)
nvm use --lts         # la activa en tu sesión actual



claude_desktop_config.json >>>

{
  "mcpServers": {
    "file-operations": {
      "command": "/home/amunoz/.nvm/versions/node/v20.19.2/bin/node",
      "args": ["/home/amunoz/mcp-file-server/server.js"],
      "env": {}
    }
  }
}

<<<<<
