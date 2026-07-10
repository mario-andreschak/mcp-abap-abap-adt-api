DISCLAIMER: This server is still in experimental status! Use it with caution!

# ABAP-ADT-API MCP-Server

## Description

The MCP-Server `mcp-abap-abap-adt-api` is a Model Context Protocol (MCP) server designed to facilitate seamless communication between ABAP systems and MCP clients. It is a wrapper for [abap-adt-api](https://github.com/marcellourbani/abap-adt-api/) and provides a suite of tools and resources for managing ABAP objects, handling transport requests, performing code analysis, and more, enhancing the efficiency and effectiveness of ABAP development workflows.

The server is published on npm as [`mcp-abap-abap-adt-api`](https://www.npmjs.com/package/mcp-abap-abap-adt-api) and listed in the [MCP Registry](https://registry.modelcontextprotocol.io) as `io.github.mario-andreschak/mcp-abap-abap-adt-api`, so most MCP clients can install it with a single command (or a single click — see [FLUJO](#integrating-with-flujo-recommended) below).

> **Related project:** For higher-level, read-oriented ABAP tools (`GetProgram`, `GetClass`, `GetTable`, …) see the separate [`mcp-abap-adt`](https://github.com/mario-andreschak/mcp-abap-adt) server. **This** server (`mcp-abap-abap-adt-api`) exposes the lower-level ADT API (lock/unlock, edit source, transports, activation, syntax checks, DDIC access, …) for full read/write development workflows.

## Features

- **Authentication**: Securely authenticate with ABAP systems using the `login` tool.
- **Object Management**: Create, read, update, and delete ABAP objects seamlessly.
- **Transport Handling**: Manage transport requests with tools like `createTransport` and `transportInfo`.
- **Code Analysis**: Perform syntax checks and retrieve code completion suggestions.
- **Extensibility**: Easily extend the server with additional tools and resources as needed.
- **Session Management**: Handle session caching and termination using `dropSession` and `logout`.

## Prerequisites

- **An SAP ABAP System** reachable via ADT (ABAP Development Tools). You'll need the system URL, a username and password, and the client number. Ensure the `/sap/bc/adt` service is active in transaction `SICF` (your basis administrator can help).
- **Node.js and npm** — download the LTS version from [nodejs.org](https://nodejs.org/). Verify with `node -v` and `npm -v`.

## Installation

There are three ways to use this server, from easiest to most manual:

### Integrating with FLUJO (recommended)

[FLUJO](https://github.com/mario-andreschak/FLUJO) is the easiest way to use this server — no cloning, building, or hand-editing JSON config:

1. In FLUJO, navigate to **MCP**.
2. Click **Add Server**.
3. On the **Marketplace** tab, search for **`mcp-abap-abap-adt-api`** and select it.
4. FLUJO fetches the npm package automatically and opens the **Local Server** tab. Enter your SAP **URL**, **User**, **Password** (and optionally client/language), then click **Save**.

That's it — FLUJO downloads and runs the npm package for you and keeps your SAP credentials with the installed server.

#### Streamable HTTP transport (via FLUJO)

`mcp-abap-abap-adt-api` runs over **stdio**. If you need to reach it over **streamable HTTP** — for example from another app on your machine or a client that only speaks HTTP — let FLUJO re-host it: install the server in FLUJO as above, then toggle **"Expose to external apps"** on the server. FLUJO's built-in mcp-proxy then serves it over HTTP at `http://localhost:4200/mcp-proxy/mcp-abap-abap-adt-api`, and any HTTP-capable MCP client can connect with a config like:

```json
{
  "mcpServers": {
    "mcp-abap-abap-adt-api": {
      "type": "http",
      "url": "http://localhost:4200/mcp-proxy/mcp-abap-abap-adt-api"
    }
  }
}
```

FLUJO keeps your SAP credentials with the installed server, so the HTTP config itself carries none.

### Quick start with npx (any MCP client)

The server is published on npm, so you don't need to clone or build anything — most MCP clients can launch it directly via `npx`. Add it to your MCP client configuration (e.g. Cline, Claude Desktop, Claude Code):

```json
{
  "mcpServers": {
    "mcp-abap-abap-adt-api": {
      "command": "npx",
      "args": ["-y", "mcp-abap-abap-adt-api"],
      "env": {
        "SAP_URL": "https://your-sap-server.com:44300",
        "SAP_USER": "YOUR_SAP_USERNAME",
        "SAP_PASSWORD": "YOUR_SAP_PASSWORD",
        "SAP_CLIENT": "100",
        "SAP_LANGUAGE": "EN"
      }
    }
  }
}
```

If your SAP system uses a self-signed certificate, add `"NODE_TLS_REJECT_UNAUTHORIZED": "0"` to the `env` block (development only).

> **Windows tip:** if `npx` isn't found, set `"command": "npx.cmd"`, or use the full path to `node` with the absolute path to `dist/index.js` from a source install (see below).

### Build from source

1. **Clone the Repository**

   ```cmd
   git clone https://github.com/mario-andreschak/mcp-abap-abap-adt-api.git
   cd mcp-abap-abap-adt-api
   ```

2. **Install Dependencies**

   ```cmd
   npm install
   ```

3. **Configure Environment Variables**

   An `.env.example` file is provided in the root directory as a template for the required environment variables. To set up your environment:

   a. Copy the `.env.example` file and rename it to `.env`:
      ```bash
      cp .env.example .env
      ```

   b. Open the `.env` file and replace the placeholder values with your actual SAP connection details:

      ```env
      SAP_URL=https://your-sap-server.com:44300
      SAP_USER=YOUR_SAP_USERNAME
      SAP_PASSWORD=YOUR_SAP_PASSWORD
      SAP_CLIENT=YOUR_SAP_CLIENT
      SAP_LANGUAGE=YOUR_SAP_LANGUAGE
      ```

   Note: The SAP_CLIENT and SAP_LANGUAGE variables are optional but recommended.

   If you're using self-signed certificates, you can also set:

   ```env
   NODE_TLS_REJECT_UNAUTHORIZED="0"
   ```

   IMPORTANT: Never commit your `.env` file to version control. It's already included in `.gitignore` to prevent accidental commits.

4. **Build the Project**

   ```cmd
   npm run build
   ```

5. **Run the Server**

   ```cmd
   npm run start
   ```

   When integrating a source build into an MCP client, point `command` at `node` with an absolute path to the build output:

   ```json
   {
     "mcpServers": {
       "mcp-abap-abap-adt-api": {
         "command": "node",
         "args": ["PATH_TO_YOUR/mcp-abap-abap-adt-api/dist/index.js"],
         "disabled": false,
         "autoApprove": []
       }
     }
   }
   ```

## Custom Instruction
Use this Custom Instruction to explain the tool to your model:
```
## mcp-abap-abap-adt-api Server

This server provides tools for interacting with an SAP system via ADT (ABAP Development Tools) APIs. It allows you to retrieve information about ABAP objects, modify source code, and manage transports.

**Key Tools and Usage:**

*   **`searchObject`:** Finds ABAP objects based on a query string (e.g., class name).
    *   `query`: (string, required) The search term.
    *   Returns the object's URI.  Example: `/sap/bc/adt/oo/classes/zcl_invoice_xml_gen_model`

*   **`transportInfo`:** Retrieves transport information for a given object.
    *   `objSourceUrl`: (string, required) The object's URI (obtained from `searchObject`).
    *   Returns transport details, including the transport request number (`TRKORR` or `transportInfo.LOCKS.HEADER.TRKORR` in the JSON response).

*   **`lock`:** Locks an ABAP object for editing.
    *   `objectUrl`: (string, required) The object's URI.
    *   Returns a `lockHandle`, which is required for subsequent modifications.

*   **`unLock`:** Unlocks a previously locked ABAP object.
    *   `objectUrl`: (string, required) The object's URI.
    *   `lockHandle`: (string, required) The lock handle obtained from the `lock` operation.

*   **`setObjectSource`:** Modifies the source code of an ABAP object.
    *   `objectSourceUrl`: (string, required) The object's URI *with the suffix `/source/main`*.  Example: `/sap/bc/adt/oo/classes/zcl_invoice_xml_gen_model/source/main`
    *   `lockHandle`: (string, required) The lock handle obtained from the `lock` operation.
    *   `source`: (string, required) The complete, modified ABAP source code.
    *   `transport`: (string, optional) The transport request number.

*   **`syntaxCheckCode`:** Performs a syntax check on a given ABAP source code.
    *   `code`: (string, required) The ABAP source code to check.
    *   `url`: (string, optional) The URL of the object.
    *   `mainUrl`: (string, optional) The main URL.
    *   `mainProgram`: (string, optional) The main program.
    *   `version`: (string, optional) The version.
    *   Returns syntax check results, including any errors.

*   **`activate`:** Activates an ABAP object. (See notes below on activation/unlocking.)
    *    `object`: The object to be activated.

*   **`getObjectSource`:** Retrieves the source code of an ABAP object.
    *   `objectSourceUrl`: (string, required) The object's URI *with the suffix `/source/main`*.

**Workflow for Modifying ABAP Code:**

1.  **Find the object URI:** Use `searchObject`.
2.  **Read the original source code:** Use `getObjectSource` (with the `/source/main` suffix).
3.  **Clone and Modify the source code locally:** (e.g., `write_to_file` for creating a local copy, and using `read_file`, `replace_in_file` for modifying this local copy).
4.  **Get transport information:** Use `transportInfo`.
5.  **Lock the object:** Use `lock`.
6.  **Set the modified source code:** Use `setObjectSource` (with the `/source/main` suffix).
7.  **Perform a syntax check:** Use `syntaxCheckCode`.
8.  **Activate** the object, Use `activate`..
9.  **unLock the object:** Use `unLock`.

**Important Notes:**
*   **File Handling:** SAP is completly de-coupled from the local file system. Reading source code will only return the code as tool result - it has no effect on file. Files are not synchronized with SAP but merely a local copy for our reference. FYI: It's not strictly necessary for you to create local copies of source codes, as they have no effect on SAP, but it helps us track changes. 
*   **File Handling:** The local filenames you will use will not contain any paths, but only a filename! It's preferable to use a pattern like "[ObjectName].[ObjectType].abap". (e.g., SAPMV45A.prog.abap for a ABAP Program SAPMV45A, CL_IXML.clas.abap for a Class CL_IXML)
*   **URL Suffix:**  Remember to add `/source/main` to the object URI when using `setObjectSource` and `getObjectSource`.
*   **Transport Request:** Obtain the transport request number (e.g., from `transportInfo` or from the user) and include it in relevant operations.
*   **Lock Handle:**  The `lockHandle` obtained from the `lock` operation is crucial for `setObjectSource` and `unLock`. Ensure you are using a valid `lockHandle`. If a lock fails, you may need to re-acquire the lock. Locks can expire or be released by other users.
*   **Activation/Unlocking Order:** The exact order of `activate` and `unLock` operations might need clarification. Refer to the tool descriptions or ask the user. It appears `activate` can be used without unlocking first.
* **Error Handling:** The tools return JSON responses. Check for error messages within these responses.
```

## Efficient Database Access

SAP systems contain vast amounts of data.  It's crucial to write ABAP code that accesses the database efficiently to minimize performance impact and network traffic.  Avoid selecting entire tables or using broad `WHERE` clauses when you only need specific data.

*   **Use `WHERE` clauses:** Always use `WHERE` clauses in your `SELECT` statements to filter the data retrieved from the database.  Select only the specific rows you need.
*   **`UP TO 1 ROWS`:** If you only need a single record, use the `SELECT SINGLE` statement, if you can guarantee that you can provide ALL the key fields for the `SELECT SINGLE` statement. Otherwise, use the `SELECT` statement with the `UP TO 1 ROWS` addition. This tells the database to stop searching after finding the first matching record, improving performance. Example:

    ```abap
    SELECT vgbel FROM vbrp WHERE vbeln = @me->lv_vbeln INTO @DATA(lv_vgbel) UP TO 1 ROWS.
      EXIT. " Exit any loop after this.
    ENDSELECT.
    ```
## Checking Table and Structure Definitions

When working with ABAP objects, you may encounter errors related to unknown field names or incorrect table usage. Use the following tools to inspect DDIC (Data Dictionary) objects:

*   **`objectStructure`:** Retrieves the structure/metadata of an ABAP object (including DDIC tables and structures) from its object URI. Use `searchObject` first to resolve the object name to a URI.
*   **`ddicElement`:** Retrieves details of a DDIC element (e.g. a data element or domain).
*   **`ddicRepositoryAccess`:** Reads DDIC repository information for a given path.
*   **`tableContents`:** Retrieves the *contents* (rows) of a table, not its definition. Use `runQuery` for ad-hoc `SELECT`s.

> **Note:** Earlier versions of this README listed `GetTable`, `GetStructure`, and `GetTypeInfo`. Those tools are **not** part of this server — they belong to the separate [`mcp-abap-adt`](https://github.com/mario-andreschak/mcp-abap-adt) project. This server (`mcp-abap-abap-adt-api`) exposes the lower-level ADT API tools listed above instead.

## Troubleshooting

*   **`npx` can't find the package / client won't start it:** ensure Node.js is installed and on your PATH (`node -v`, `npm -v`). On Windows try `"command": "npx.cmd"`, or use a source build with an absolute path to `node dist/index.js`.
*   **SAP connection errors:** verify your credentials (`SAP_URL`, `SAP_USER`, `SAP_PASSWORD`, `SAP_CLIENT`), confirm the system is reachable, that your user has ADT authorizations, and that `/sap/bc/adt` is active in `SICF`.
*   **TLS / self-signed certificate errors:** for development only, set `NODE_TLS_REJECT_UNAUTHORIZED=0` (env var or in the client `env` block).

## Contributing

Contributions are welcome! Please follow these steps to contribute:

1. **Fork the Repository**
2. **Create a New Branch**

   ```cmd
   git checkout -b feature/your-feature-name
   ```

3. **Commit Your Changes**

   ```cmd
   git commit -m "Add some feature"
   ```

4. **Push to the Branch**

   ```cmd
   git push origin feature/your-feature-name
   ```

5. **Open a Pull Request**

## License

This project is licensed under the [MIT License](LICENSE).
