#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs-extra";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const server = new Server(
  {
    name: "file-operations-server",
    version: "0.3.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Función auxiliar para buscar texto en archivos
async function searchTextInFiles(searchText, basePath, options = {}) {
  const {
    caseSensitive = false,
    includeLineNumbers = true,
    fileExtensions = null, // null = todos los archivos, array = solo esas extensiones
    maxResults = 100,
    maxFileSize = 10 * 1024 * 1024 // 10MB máximo por archivo
  } = options;

  const results = [];
  const searchPattern = caseSensitive ? searchText : searchText.toLowerCase();

  async function searchInDirectory(dirPath) {
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        
        if (item.isDirectory()) {
          // Buscar recursivamente en subdirectorios
          await searchInDirectory(fullPath);
        } else if (item.isFile()) {
          // Filtrar por extensiones si se especifica
          if (fileExtensions && fileExtensions.length > 0) {
            const ext = path.extname(item.name).toLowerCase();
            if (!fileExtensions.includes(ext)) {
              continue;
            }
          }

          try {
            const stats = await fs.stat(fullPath);
            if (stats.size > maxFileSize) {
              continue; // Saltar archivos muy grandes
            }

            const content = await fs.readFile(fullPath, "utf-8");
            const contentToSearch = caseSensitive ? content : content.toLowerCase();
            
            if (contentToSearch.includes(searchPattern)) {
              const matches = [];
              
              if (includeLineNumbers) {
                const lines = content.split('\n');
                lines.forEach((line, index) => {
                  const lineToSearch = caseSensitive ? line : line.toLowerCase();
                  if (lineToSearch.includes(searchPattern)) {
                    matches.push({
                      lineNumber: index + 1,
                      content: line.trim(),
                      // Resaltar la coincidencia
                      highlighted: line.replace(
                        new RegExp(searchText, caseSensitive ? 'g' : 'gi'),
                        `**${searchText}**`
                      ).trim()
                    });
                  }
                });
              }

              results.push({
                file: fullPath,
                relativePath: path.relative(basePath, fullPath),
                matches: matches,
                totalMatches: matches.length
              });

              // Limitar resultados
              if (results.length >= maxResults) {
                return;
              }
            }
          } catch (error) {
            // Saltar archivos que no se pueden leer (binarios, etc.)
            continue;
          }
        }
      }
    } catch (error) {
      // Saltar directorios inaccesibles
      return;
    }
  }

  await searchInDirectory(basePath);
  return results;
}

async function editLine(filePath, lineNumber, newContent) {
  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.split("\n");
  if (lineNumber < 1 || lineNumber > lines.length) {
    throw new Error("Número de línea fuera de rango");
  }
  lines[lineNumber - 1] = newContent;
  await fs.writeFile(filePath, lines.join("\n"));
}

async function fileManage(action, filePath, content = "", newName) {
  switch (action) {
    case "create":
      await fs.ensureFile(filePath);
      break;
    case "read":
      return await fs.readFile(filePath, "utf-8");
    case "write":
      await fs.writeFile(filePath, content);
      break;
    case "delete":
      await fs.remove(filePath);
      break;
    case "rename":
      if (!newName) {
        throw new Error("new_name requerido para rename");
      }
      await fs.rename(filePath, newName);
      break;
    default:
      throw new Error(`Acción no soportada: ${action}`);
  }
}

async function shellExecute(command, timeout = 60000) {
  const { stdout, stderr } = await execAsync(command, { timeout });
  return { stdout, stderr };
}

async function dbQuery(connectionString, query) {
  const cmd = `sqlite3 ${connectionString} "${query.replace(/"/g, '\\"')}"`;
  const { stdout, stderr } = await execAsync(cmd);
  if (stderr) {
    return stderr;
  }
  return stdout;
}

async function httpRequest(method, url, headers = {}, body = null) {
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  return {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    body: text,
  };
}

async function summarizeDocument(filePath, length = 100) {
  const content = await fs.readFile(filePath, "utf-8");
  const words = content.split(/\s+/).slice(0, length);
  return words.join(" ");
}

// Herramienta para listar archivos
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "read_file",
        description: "Lee el contenido de un archivo",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Ruta del archivo a leer",
            },
          },
          required: ["file_path"],
        },
      },
      {
        name: "write_file",
        description: "Escribe contenido en un archivo",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Ruta del archivo donde escribir",
            },
            content: {
              type: "string",
              description: "Contenido a escribir en el archivo",
            },
            mode: {
              type: "string",
              description: "Modo de escritura: 'write' (sobrescribir) o 'append' (añadir)",
              enum: ["write", "append"],
              default: "write",
            },
          },
          required: ["file_path", "content"],
        },
      },
      {
        name: "create_directory",
        description: "Crea un directorio",
        inputSchema: {
          type: "object",
          properties: {
            dir_path: {
              type: "string",
              description: "Ruta del directorio a crear",
            },
          },
          required: ["dir_path"],
        },
      },
      {
        name: "list_directory",
        description: "Lista el contenido de un directorio",
        inputSchema: {
          type: "object",
          properties: {
            dir_path: {
              type: "string",
              description: "Ruta del directorio a listar",
            },
          },
          required: ["dir_path"],
        },
      },
      {
        name: "delete_file",
        description: "Elimina un archivo",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Ruta del archivo a eliminar",
            },
          },
          required: ["file_path"],
        },
      },
      {
        name: "search_text",
        description: "Busca una cadena de texto en archivos dentro de un directorio (recursivamente)",
        inputSchema: {
          type: "object",
          properties: {
            search_text: {
              type: "string",
              description: "Texto a buscar",
            },
            directory: {
              type: "string",
              description: "Directorio donde buscar",
            },
            case_sensitive: {
              type: "boolean",
              description: "Si la búsqueda debe ser sensible a mayúsculas/minúsculas",
              default: false,
            },
            file_extensions: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Extensiones de archivo a incluir (ej: ['.js', '.py', '.txt']). Si no se especifica, busca en todos los archivos",
              default: null,
            },
            max_results: {
              type: "number",
              description: "Número máximo de archivos a retornar",
              default: 50,
            },
            include_line_numbers: {
              type: "boolean",
              description: "Si incluir números de línea y contenido de las coincidencias",
              default: true,
            }
          },
          required: ["search_text", "directory"],
        },
      },
      {
        name: "find_files",
        description: "Busca archivos por nombre o patrón en un directorio",
        inputSchema: {
          type: "object",
          properties: {
            pattern: {
              type: "string",
              description: "Patrón de nombre de archivo a buscar (ej: '*.js', 'config*', 'test.txt')",
            },
            directory: {
              type: "string",
              description: "Directorio donde buscar",
            },
            case_sensitive: {
              type: "boolean",
              description: "Si la búsqueda debe ser sensible a mayúsculas/minúsculas",
              default: false,
            },
            max_results: {
              type: "number",
              description: "Número máximo de archivos a retornar",
              default: 100,
            }
          },
          required: ["pattern", "directory"],
        },
      },
      {
        name: "edit_line",
        description: "Modifica una línea específica de un archivo de texto",
        inputSchema: {
          type: "object",
          properties: {
            file_path: { type: "string", description: "Ruta del archivo" },
            line_number: { type: "number", description: "Número de línea" },
            new_content: { type: "string", description: "Nuevo contenido" }
          },
          required: ["file_path", "line_number", "new_content"]
        }
      },
      {
        name: "file_manage",
        description: "Operaciones genéricas con archivos",
        inputSchema: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["create", "read", "write", "delete", "rename"],
              description: "Acción a realizar"
            },
            path: { type: "string", description: "Ruta del archivo" },
            content: { type: "string", description: "Contenido opcional" },
            new_name: { type: "string", description: "Nuevo nombre para rename" }
          },
          required: ["action", "path"]
        }
      },
      {
        name: "shell_execute",
        description: "Ejecuta un comando de shell y devuelve la salida",
        inputSchema: {
          type: "object",
          properties: {
            command: { type: "string", description: "Comando a ejecutar" },
            timeout: { type: "number", description: "Tiempo máximo en segundos", default: 60 }
          },
          required: ["command"]
        }
      },
      {
        name: "db_query",
        description: "Ejecuta consultas SQL utilizando sqlite3",
        inputSchema: {
          type: "object",
          properties: {
            connection_string: { type: "string", description: "Ruta de la base de datos" },
            query: { type: "string", description: "Consulta a ejecutar" }
          },
          required: ["connection_string", "query"]
        }
      },
      {
        name: "http_request",
        description: "Realiza una petición HTTP básica",
        inputSchema: {
          type: "object",
          properties: {
            method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"], default: "GET" },
            url: { type: "string", description: "URL destino" },
            headers: { type: "object", description: "Cabeceras" },
            body: { type: "string", description: "Cuerpo de la petición" }
          },
          required: ["method", "url"]
        }
      },
      {
        name: "doc_summarize",
        description: "Resume un documento de texto devolviendo las primeras palabras",
        inputSchema: {
          type: "object",
          properties: {
            file_path: { type: "string", description: "Ruta del documento" },
            length: { type: "number", description: "Número de palabras", default: 100 }
          },
          required: ["file_path"]
        }
      },
    ],
  };
});

// Función auxiliar para buscar archivos por nombre
async function findFilesByPattern(pattern, basePath, options = {}) {
  const { caseSensitive = false, maxResults = 100 } = options;
  const results = [];
  
  // Convertir patrón a regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  
  const regex = new RegExp(`^${regexPattern}$`, caseSensitive ? '' : 'i');

  async function searchInDirectory(dirPath) {
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        
        if (item.isDirectory()) {
          await searchInDirectory(fullPath);
        } else if (item.isFile()) {
          if (regex.test(item.name)) {
            results.push({
              name: item.name,
              path: fullPath,
              relativePath: path.relative(basePath, fullPath),
              directory: path.dirname(fullPath)
            });
            
            if (results.length >= maxResults) {
              return;
            }
          }
        }
      }
    } catch (error) {
      return;
    }
  }

  await searchInDirectory(basePath);
  return results;
}

// Manejador de herramientas
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "read_file": {
        const { file_path } = args;
        const content = await fs.readFile(file_path, "utf-8");
        return {
          content: [
            {
              type: "text",
              text: `Contenido del archivo ${file_path}:\n\n${content}`,
            },
          ],
        };
      }

      case "write_file": {
        const { file_path, content, mode = "write" } = args;
        
        await fs.ensureDir(path.dirname(file_path));
        
        if (mode === "append") {
          await fs.appendFile(file_path, content);
        } else {
          await fs.writeFile(file_path, content);
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Archivo ${file_path} ${mode === "append" ? "actualizado" : "creado"} exitosamente`,
            },
          ],
        };
      }

      case "create_directory": {
        const { dir_path } = args;
        await fs.ensureDir(dir_path);
        return {
          content: [
            {
              type: "text",
              text: `Directorio ${dir_path} creado exitosamente`,
            },
          ],
        };
      }

      case "list_directory": {
        const { dir_path } = args;
        const items = await fs.readdir(dir_path, { withFileTypes: true });
        const itemList = items
          .map((item) => `${item.isDirectory() ? "📁" : "📄"} ${item.name}`)
          .join("\n");
        
        return {
          content: [
            {
              type: "text",
              text: `Contenido del directorio ${dir_path}:\n\n${itemList}`,
            },
          ],
        };
      }

      case "delete_file": {
        const { file_path } = args;
        await fs.remove(file_path);
        return {
          content: [
            {
              type: "text",
              text: `Archivo/directorio ${file_path} eliminado exitosamente`,
            },
          ],
        };
      }

      case "search_text": {
        const { 
          search_text, 
          directory, 
          case_sensitive = false,
          file_extensions = null,
          max_results = 50,
          include_line_numbers = true
        } = args;

        // Verificar que el directorio existe
        const dirExists = await fs.pathExists(directory);
        if (!dirExists) {
          throw new Error(`El directorio ${directory} no existe`);
        }

        const results = await searchTextInFiles(search_text, directory, {
          caseSensitive: case_sensitive,
          includeLineNumbers: include_line_numbers,
          fileExtensions: file_extensions,
          maxResults: max_results
        });

        if (results.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No se encontró "${search_text}" en ningún archivo del directorio ${directory}`,
              },
            ],
          };
        }

        let responseText = `🔍 Búsqueda de "${search_text}" en ${directory}\n`;
        responseText += `📊 Encontrado en ${results.length} archivo(s):\n\n`;

        results.forEach((result, index) => {
          responseText += `${index + 1}. 📄 ${result.relativePath}\n`;
          responseText += `   └─ ${result.totalMatches} coincidencia(s)\n`;
          
          if (include_line_numbers && result.matches.length > 0) {
            // Mostrar solo las primeras 3 coincidencias por archivo
            const matchesToShow = result.matches.slice(0, 3);
            matchesToShow.forEach(match => {
              responseText += `   └─ Línea ${match.lineNumber}: ${match.highlighted}\n`;
            });
            
            if (result.matches.length > 3) {
              responseText += `   └─ ... y ${result.matches.length - 3} coincidencia(s) más\n`;
            }
          }
          responseText += "\n";
        });

        return {
          content: [
            {
              type: "text",
              text: responseText,
            },
          ],
        };
      }

      case "find_files": {
        const {
          pattern,
          directory,
          case_sensitive = false,
          max_results = 100
        } = args;

        const dirExists = await fs.pathExists(directory);
        if (!dirExists) {
          throw new Error(`El directorio ${directory} no existe`);
        }

        const results = await findFilesByPattern(pattern, directory, {
          caseSensitive: case_sensitive,
          maxResults: max_results
        });

        if (results.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No se encontraron archivos que coincidan con el patrón "${pattern}" en ${directory}`,
              },
            ],
          };
        }

        let responseText = `🔍 Archivos que coinciden con "${pattern}" en ${directory}\n`;
        responseText += `📊 Encontrados ${results.length} archivo(s):\n\n`;

        results.forEach((result, index) => {
          responseText += `${index + 1}. 📄 ${result.relativePath}\n`;
        });

        return {
          content: [
            {
              type: "text",
              text: responseText,
            },
          ],
        };
      }

      case "edit_line": {
        const { file_path, line_number, new_content } = args;
        await editLine(file_path, line_number, new_content);
        return {
          content: [
            { type: "text", text: `Línea ${line_number} de ${file_path} actualizada` }
          ]
        };
      }

      case "file_manage": {
        const { action, path: filePath, content = "", new_name } = args;
        const result = await fileManage(action, filePath, content, new_name);
        const response = result !== undefined ? `Resultado: ${result}` : `Acción ${action} completada`;
        return {
          content: [ { type: "text", text: response } ]
        };
      }

      case "shell_execute": {
        const { command, timeout = 60 } = args;
        const { stdout, stderr } = await shellExecute(command, timeout * 1000);
        return { content: [ { type: "text", text: `STDOUT:\n${stdout}\nSTDERR:\n${stderr}` } ] };
      }

      case "db_query": {
        const { connection_string, query } = args;
        const output = await dbQuery(connection_string, query);
        return { content: [ { type: "text", text: output } ] };
      }

      case "http_request": {
        const { method, url, headers = {}, body = null } = args;
        const result = await httpRequest(method, url, headers, body);
        return {
          content: [
            {
              type: "text",
              text: `Status: ${result.status}\n${JSON.stringify(result.headers)}\n\n${result.body}`
            }
          ]
        };
      }

      case "doc_summarize": {
        const { file_path, length = 100 } = args;
        const summary = await summarizeDocument(file_path, length);
        return { content: [ { type: "text", text: summary } ] };
      }

      default:
        throw new Error(`Herramienta desconocida: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Servidor MCP de archivos iniciado (v0.3.0 con herramientas ampliadas)");
}

main().catch(console.error);
