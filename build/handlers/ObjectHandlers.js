"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectHandlers = void 0;
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const BaseHandler_1 = require("./BaseHandler");
class ObjectHandlers extends BaseHandler_1.BaseHandler {
    getTools() {
        return [
            {
                name: 'readObject',
                description: 'Read ABAP object details',
                inputSchema: {
                    type: 'object',
                    properties: {
                        object: {
                            type: 'string',
                            description: 'Name or URL of the ABAP object'
                        },
                        preauditRequested: {
                            type: 'boolean',
                            description: 'Whether to perform pre-audit checks',
                            optional: true
                        }
                    },
                    required: ['object']
                }
            },
            {
                name: 'inactiveObjects',
                description: 'Get list of inactive objects',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                name: 'mainPrograms',
                description: 'Get main programs for include',
                inputSchema: {
                    type: 'object',
                    properties: {
                        includeUrl: {
                            type: 'string',
                            description: 'URL of the include program'
                        }
                    },
                    required: ['includeUrl']
                }
            },
            {
                name: 'lock',
                description: 'Lock an object',
                inputSchema: {
                    type: 'object',
                    properties: {
                        objectUrl: {
                            type: 'string',
                            description: 'URL of the object to lock'
                        },
                        accessMode: {
                            type: 'string',
                            description: 'Access mode for the lock',
                            optional: true
                        }
                    },
                    required: ['objectUrl']
                }
            },
            {
                name: 'unLock',
                description: 'Unlock an object',
                inputSchema: {
                    type: 'object',
                    properties: {
                        objectUrl: {
                            type: 'string',
                            description: 'URL of the object to unlock'
                        },
                        lockHandle: {
                            type: 'string',
                            description: 'Lock handle from the lock operation'
                        }
                    },
                    required: ['objectUrl', 'lockHandle']
                }
            },
            {
                name: 'getObjectSource',
                description: 'Retrieve object source code',
                inputSchema: {
                    type: 'object',
                    properties: {
                        objectSourceUrl: {
                            type: 'string',
                            description: 'URL of the object source'
                        },
                        options: {
                            type: 'object',
                            description: 'Additional options for source retrieval',
                            optional: true
                        }
                    },
                    required: ['objectSourceUrl']
                }
            },
            {
                name: 'setObjectSource',
                description: 'Update object source code',
                inputSchema: {
                    type: 'object',
                    properties: {
                        objectName: {
                            type: 'string',
                            description: 'Name of the ABAP object to register'
                        },
                        objectType: {
                            type: 'string',
                            description: 'ABAP object type (e.g. CLAS/INTF)'
                        },
                        packageName: {
                            type: 'string',
                            description: 'Transport package name',
                            optional: true
                        }
                    },
                    required: ['objectName', 'objectType']
                }
            },
            {
                name: 'searchObject',
                description: 'Search for objects',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'Search query string'
                        },
                        objType: {
                            type: 'string',
                            description: 'Object type filter',
                            optional: true
                        },
                        max: {
                            type: 'number',
                            description: 'Maximum number of results',
                            optional: true
                        }
                    },
                    required: ['query']
                }
            },
            {
                name: 'findObjectPath',
                description: 'Find path for an object',
                inputSchema: {
                    type: 'object',
                    properties: {
                        objectUrl: {
                            type: 'string',
                            description: 'URL of the object to find path for'
                        }
                    },
                    required: ['objectUrl']
                }
            },
            {
                name: 'validateNewObject',
                description: 'Validate new object parameters',
                inputSchema: {
                    type: 'object',
                    properties: {
                        options: {
                            type: 'object',
                            description: 'Validation options'
                        }
                    },
                    required: ['options']
                }
            },
            {
                name: 'createObject',
                description: 'Create new object',
                inputSchema: {
                    type: 'object',
                    properties: {
                        objtype: {
                            type: 'string',
                            description: 'Type of object to create'
                        },
                        name: {
                            type: 'string',
                            description: 'Name of the new object'
                        },
                        parentName: {
                            type: 'string',
                            description: 'Name of parent object'
                        },
                        description: {
                            type: 'string',
                            description: 'Description of the new object'
                        },
                        parentPath: {
                            type: 'string',
                            description: 'Path of parent object'
                        },
                        responsible: {
                            type: 'string',
                            description: 'Responsible user',
                            optional: true
                        },
                        transport: {
                            type: 'string',
                            description: 'Transport request',
                            optional: true
                        }
                    },
                    required: ['objtype', 'name', 'parentName', 'description', 'parentPath']
                }
            },
            {
                name: 'deleteObject',
                description: 'Delete an object',
                inputSchema: {
                    type: 'object',
                    properties: {
                        objectUrl: {
                            type: 'string',
                            description: 'URL of the object to delete'
                        },
                        lockHandle: {
                            type: 'string',
                            description: 'Lock handle from the lock operation'
                        },
                        transport: {
                            type: 'string',
                            description: 'Transport request',
                            optional: true
                        }
                    },
                    required: ['objectUrl', 'lockHandle']
                }
            }
        ];
    }
    handle(toolName, args) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (toolName) {
                case 'objectStructure':
                    return this.handleObjectStructure(args);
                case 'getObjectSource':
                    return this.handleGetObjectSource(args);
                case 'setObjectSource':
                    return this.handleSetObjectSource(args);
                case 'findObjectPath':
                    return this.handleFindObjectPath(args);
                case 'validateNewObject':
                    return this.handleValidateNewObject(args);
                case 'createObject':
                    return this.handleCreateObject(args);
                case 'deleteObject':
                    return this.handleDeleteObject(args);
                case 'activate':
                    return this.handleActivate(args);
                case 'inactiveObjects':
                    return this.handleInactiveObjects(args);
                case 'mainPrograms':
                    return this.handleMainPrograms(args);
                case 'lock':
                    return this.handleLock(args);
                case 'unLock':
                    return this.handleUnLock(args);
                case 'searchObject':
                    return this.handleSearchObject(args);
                default:
                    throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Unknown object tool: ${toolName}`);
            }
        });
    }
    handleObjectStructure(args) {
        return __awaiter(this, void 0, void 0, function* () {
            this.validateArgs(args, {
                type: 'object',
                properties: {
                    objectUrl: { type: 'string' },
                    version: { type: 'string', optional: true }
                },
                required: ['objectUrl']
            });
            // TODO: Implement object structure retrieval
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            structure: {}
                        })
                    }]
            };
        });
    }
    handleGetObjectSource(args) {
        return __awaiter(this, void 0, void 0, function* () {
            this.validateArgs(args, {
                type: 'object',
                properties: {
                    objectSourceUrl: { type: 'string' },
                    options: { type: 'object', optional: true }
                },
                required: ['objectSourceUrl']
            });
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            source: yield this.adtclient.getObjectSource(args.objectSourceUrl)
                        })
                    }]
            };
        });
    }
    handleSetObjectSource(args) {
        return __awaiter(this, void 0, void 0, function* () {
            this.validateArgs(args, {
                type: 'object',
                properties: {
                    objectSourceUrl: { type: 'string' },
                    source: { type: 'string' },
                    lockHandle: { type: 'string' },
                    transport: { type: 'string', optional: true }
                },
                required: ['objectSourceUrl', 'source', 'lockHandle']
            });
            // TODO: Implement object source update
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            updated: true
                        })
                    }]
            };
        });
    }
    handleFindObjectPath(args) {
        return __awaiter(this, void 0, void 0, function* () {
            this.validateArgs(args, {
                type: 'object',
                properties: {
                    objectUrl: { type: 'string' }
                },
                required: ['objectUrl']
            });
            // TODO: Implement object path finding
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            path: '/path/to/object'
                        })
                    }]
            };
        });
    }
    handleValidateNewObject(args) {
        return __awaiter(this, void 0, void 0, function* () {
            this.validateArgs(args, {
                type: 'object',
                properties: {
                    options: { type: 'object' }
                },
                required: ['options']
            });
            // TODO: Implement new object validation
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            valid: true
                        })
                    }]
            };
        });
    }
    handleCreateObject(args) {
        return __awaiter(this, void 0, void 0, function* () {
            this.validateArgs(args, {
                type: 'object',
                properties: {
                    objtype: { type: 'string' },
                    name: { type: 'string' },
                    parentName: { type: 'string' },
                    description: { type: 'string' },
                    parentPath: { type: 'string' },
                    responsible: { type: 'string', optional: true },
                    transport: { type: 'string', optional: true }
                },
                required: ['objtype', 'name', 'parentName', 'description', 'parentPath']
            });
            // TODO: Implement object creation
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            objectUrl: 'new/object/url'
                        })
                    }]
            };
        });
    }
    handleDeleteObject(args) {
        return __awaiter(this, void 0, void 0, function* () {
            this.validateArgs(args, {
                type: 'object',
                properties: {
                    objectUrl: { type: 'string' },
                    lockHandle: { type: 'string' },
                    transport: { type: 'string', optional: true }
                },
                required: ['objectUrl', 'lockHandle']
            });
            // TODO: Implement object deletion
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            deleted: true
                        })
                    }]
            };
        });
    }
    handleActivate(args) {
        return __awaiter(this, void 0, void 0, function* () {
            this.validateArgs(args, {
                type: 'object',
                properties: {
                    object: { type: ['object', 'array'] },
                    preauditRequested: { type: 'boolean', optional: true }
                },
                required: ['object']
            });
            // TODO: Implement object activation
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            activated: true
                        })
                    }]
            };
        });
    }
    handleInactiveObjects(args) {
        return __awaiter(this, void 0, void 0, function* () {
            this.validateArgs(args, {
                type: 'object',
                properties: {}
            });
            // TODO: Implement inactive objects retrieval
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            inactiveObjects: []
                        })
                    }]
            };
        });
    }
    handleMainPrograms(args) {
        return __awaiter(this, void 0, void 0, function* () {
            this.validateArgs(args, {
                type: 'object',
                properties: {
                    includeUrl: { type: 'string' }
                },
                required: ['includeUrl']
            });
            // TODO: Implement main programs retrieval
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            programs: []
                        })
                    }]
            };
        });
    }
    handleLock(args) {
        return __awaiter(this, void 0, void 0, function* () {
            this.validateArgs(args, {
                type: 'object',
                properties: {
                    objectUrl: { type: 'string' },
                    accessMode: { type: 'string', optional: true }
                },
                required: ['objectUrl']
            });
            // TODO: Implement object locking
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            lockHandle: 'lock-handle'
                        })
                    }]
            };
        });
    }
    handleUnLock(args) {
        return __awaiter(this, void 0, void 0, function* () {
            this.validateArgs(args, {
                type: 'object',
                properties: {
                    objectUrl: { type: 'string' },
                    lockHandle: { type: 'string' }
                },
                required: ['objectUrl', 'lockHandle']
            });
            // TODO: Implement object unlocking
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            unlocked: true
                        })
                    }]
            };
        });
    }
    handleSearchObject(args) {
        return __awaiter(this, void 0, void 0, function* () {
            this.validateArgs(args, {
                type: 'object',
                properties: {
                    query: { type: 'string' },
                    objType: { type: 'string', optional: true },
                    max: { type: 'number', optional: true }
                },
                required: ['query']
            });
            // TODO: Implement object search
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            results: yield this.adtclient.searchObject(args.query)
                        })
                    }]
            };
        });
    }
}
exports.ObjectHandlers = ObjectHandlers;
