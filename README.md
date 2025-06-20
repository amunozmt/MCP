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

## 🛠 Herramientas disponibles

La versión 0.4.0 del servidor expone varias herramientas MCP para facilitar operaciones locales:

- `read_file`, `write_file`, `create_directory`, `list_directory`, `delete_file`
- `search_text`, `find_files`
- `edit_line` para modificar una línea concreta de un archivo
- `file_manage` con acciones *create*, *read*, *write*, *delete* y *rename*
- `shell_execute` para lanzar comandos de shell
- `db_query` que ejecuta consultas SQL usando `sqlite3`
- `http_request` para realizar peticiones HTTP
- `doc_summarize` que resume documentos de texto
- `copy_path` y `move_path` para copiar o mover archivos y carpetas
- `file_info` para obtener metadatos de archivos
- `insert_line` y `delete_line` para modificar archivos línea a línea
- `replace_text` para buscar y reemplazar texto en archivos
- `compute_hash` que devuelve el hash de un archivo
