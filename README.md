# MCP – Claude Desktop en Debian

[![Repositorio GitHub](https://img.shields.io/badge/Repositorio-GitHub-blue.svg)](https://github.com/aaddrick/claude-desktop-debian)

## 📖 Descripción

MCP (My Claude Platform) es una pequeña plataforma de servicios para integrar el cliente desktop de Claude en sistemas Debian. En este repositorio encontrarás:

* Scripts de instalación de dependencias (Node.js vía NVM).
* Configuración del servidor de operaciones de ficheros (`file-operations`).
* Ejemplo de fichero de configuración JSON para arrancar tu servidor.

## 🛠️ Requisitos

* **Debian** (o derivado compatible).
* **cURL** instalado.
* **Git** para clonar este repositorio.
* **ZSH** o **Bash** (se usará NVM).

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
      "command": "/home/amunoz/.nvm/versions/node/v20.19.2/bin/node",
      "args": ["/home/amunoz/mcp-file-server/server.js"],
      "env": {}
    }
  }
}
```
