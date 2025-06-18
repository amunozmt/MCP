# MCP – Claude Desktop en Debian

## 🚀 Instalación

1. **Clonar el repositorio**

   ```bash
   git clone https://github.com/aaddrick/claude-desktop-debian.git
   cd claude-desktop-debian
   ```

2. **Instalar NVM (Node Version Manager)**

   ```bash
   curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.4/install.sh | bash
   source ~/.bashrc   # o source ~/.zshrc, según tu shell
   ```

3. **Instalar y usar la última LTS de Node.js**

   ```bash
   nvm install --lts     # Instala la última LTS (por ejemplo, v20.x)
   nvm use --lts         # La activa en tu sesión actual
   ```

## ⚙️ Configuración del servidor de operaciones de ficheros

Crea un archivo llamado `claude_desktop_config.json` con el siguiente contenido en /.config/Claude:

```json
{
  "mcpServers": {
    "file-operations": {
      "args": ["/home/amunoz/mcp-file-server/server.js"],
      "env": {}
    }
  }
}
```
Clonar este repositorio y poner en el archivo `claude_desktop_config.json` la url de la ubicacion server.js
