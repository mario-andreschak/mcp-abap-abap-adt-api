import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { BaseHandler } from './BaseHandler.js';
import type { ToolDefinition } from '../types/tools.js';
import { ADTClient, PackageValueHelpType } from 'abap-adt-api';

export class DdicHandlers extends BaseHandler {
    getTools(): ToolDefinition[] {
        return [
            {
                name: 'annotationDefinitions',
                description: 'Retrieves annotation definitions.',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                name: 'ddicElement',
                description: 'Retrieves information about a DDIC element.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: {
                            type: 'string',
                            description: 'The path to the DDIC element.'
                        },
                        getTargetForAssociation: {
                            type: 'boolean',
                            description: 'Whether to get the target for association.',
                            optional: true
                        },
                        getExtensionViews: {
                            type: 'boolean',
                            description: 'Whether to get extension views.',
                            optional: true
                        },
                        getSecondaryObjects: {
                            type: 'boolean',
                            description: 'Whether to get secondary objects.',
                            optional: true
                        }
                    },
                    required: ['path']
                }
            },
            {
                name: 'ddicRepositoryAccess',
                description: 'Accesses the DDIC repository.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: {
                            type: 'string',
                            description: 'The path to the DDIC element.'
                        }
                    },
                    required: ['path']
                }
            },
            {
                name: 'packageSearchHelp',
                description: 'Performs a package search help.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        type: {
                            type: 'string',
                            description: 'The package value help type.'
                        },
                        name: {
                            type: 'string',
                            description: 'The package name.',
                            optional: true
                        }
                    },
                    required: ['type']
                }
            },
            {
                name: 'setDomainProperties',
                description: 'Set DDIC domain properties via PUT request. This is used after creating a domain to set its data type, length, output format, etc.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        domainUrl: {
                            type: 'string',
                            description: 'Domain object URL (e.g., /sap/bc/adt/ddic/domains/zdomain_name)'
                        },
                        properties: {
                            type: 'object',
                            description: 'Domain properties to set',
                            properties: {
                                typeInformation: {
                                    type: 'object',
                                    description: 'Data type information',
                                    properties: {
                                        datatype: {
                                            type: 'string',
                                            description: 'Data type (CHAR, NUMC, DEC, DATS, TIMS, etc.)'
                                        },
                                        length: {
                                            type: 'number',
                                            description: 'Field length'
                                        },
                                        decimals: {
                                            type: 'number',
                                            description: 'Number of decimal places (for DEC type)'
                                        }
                                    },
                                    required: ['datatype', 'length', 'decimals']
                                },
                                outputInformation: {
                                    type: 'object',
                                    description: 'Output format information',
                                    properties: {
                                        length: {
                                            type: 'number',
                                            description: 'Output length'
                                        },
                                        style: {
                                            type: 'string',
                                            description: 'Output style (optional)'
                                        },
                                        conversionExit: {
                                            type: 'string',
                                            description: 'Conversion exit (optional)'
                                        },
                                        signExists: {
                                            type: 'boolean',
                                            description: 'Whether sign exists'
                                        },
                                        lowercase: {
                                            type: 'boolean',
                                            description: 'Whether lowercase is allowed'
                                        },
                                        ampmFormat: {
                                            type: 'boolean',
                                            description: 'AM/PM format for time fields'
                                        }
                                    },
                                    required: ['length', 'signExists', 'lowercase', 'ampmFormat']
                                },
                                valueInformation: {
                                    type: 'object',
                                    description: 'Value table information (optional)',
                                    properties: {
                                        valueTableRef: {
                                            type: 'string',
                                            description: 'Value table name'
                                        },
                                        appendExists: {
                                            type: 'boolean',
                                            description: 'Whether value append exists'
                                        },
                                        fixValues: {
                                            type: 'array',
                                            description: 'Fixed values for the domain',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    low: {
                                                        type: 'string',
                                                        description: 'Low value'
                                                    },
                                                    high: {
                                                        type: 'string',
                                                        description: 'High value (optional, for ranges)'
                                                    },
                                                    text: {
                                                        type: 'string',
                                                        description: 'Description text for the value'
                                                    }
                                                },
                                                required: ['low']
                                            }
                                        }
                                    }
                                }
                            },
                            required: ['typeInformation', 'outputInformation']
                        },
                        metaData: {
                            type: 'object',
                            description: 'Domain metadata',
                            properties: {
                                name: {
                                    type: 'string',
                                    description: 'Domain name'
                                },
                                description: {
                                    type: 'string',
                                    description: 'Domain description'
                                },
                                language: {
                                    type: 'string',
                                    description: 'Language code (e.g., ZH for Chinese)'
                                },
                                masterLanguage: {
                                    type: 'string',
                                    description: 'Master language code'
                                },
                                masterSystem: {
                                    type: 'string',
                                    description: 'Master system ID'
                                },
                                responsible: {
                                    type: 'string',
                                    description: 'Responsible user'
                                },
                                packageName: {
                                    type: 'string',
                                    description: 'Package name'
                                }
                            },
                            required: ['name', 'description', 'language', 'masterLanguage', 'masterSystem', 'responsible', 'packageName']
                        },
                        lockHandle: {
                            type: 'string',
                            description: 'Lock handle from lock operation'
                        },
                        transport: {
                            type: 'string',
                            description: 'Transport request number (optional)',
                            optional: true
                        }
                    },
                    required: ['domainUrl', 'properties', 'metaData', 'lockHandle']
                }
            },
            {
                name: 'setDataElementProperties',
                description: 'Set DDIC data element properties via PUT request. This is used after creating a data element to set its domain/type reference, field labels, etc.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        dataElementUrl: {
                            type: 'string',
                            description: 'Data element object URL (e.g., /sap/bc/adt/ddic/dataelements/zdata_element)'
                        },
                        properties: {
                            type: 'object',
                            description: 'Data element properties to set',
                            properties: {
                                typeKind: {
                                    type: 'string',
                                    description: 'Type kind: domain (reference to domain) or datatype (direct type)'
                                },
                                typeName: {
                                    type: 'string',
                                    description: 'Domain name or datatype name'
                                },
                                dataType: {
                                    type: 'string',
                                    description: 'Data type (CHAR, NUMC, DEC, DATS, etc.)'
                                },
                                dataTypeLength: {
                                    type: 'number',
                                    description: 'Field length'
                                },
                                dataTypeDecimals: {
                                    type: 'number',
                                    description: 'Number of decimal places (for DEC type)'
                                },
                                fieldLabels: {
                                    type: 'object',
                                    description: 'Field labels for different contexts',
                                    properties: {
                                        shortFieldLabel: { type: 'string', description: 'Short field label (max 10 chars)' },
                                        shortFieldLength: { type: 'number', description: 'Short field length' },
                                        mediumFieldLabel: { type: 'string', description: 'Medium field label (max 20 chars)' },
                                        mediumFieldLength: { type: 'number', description: 'Medium field length' },
                                        longFieldLabel: { type: 'string', description: 'Long field label (max 40 chars)' },
                                        longFieldLength: { type: 'number', description: 'Long field length' },
                                        headingFieldLabel: { type: 'string', description: 'Heading field label (max 55 chars)' },
                                        headingFieldLength: { type: 'number', description: 'Heading field length' }
                                    },
                                    required: ['shortFieldLabel', 'mediumFieldLabel', 'longFieldLabel', 'headingFieldLabel']
                                },
                                searchHelp: {
                                    type: 'string',
                                    description: 'Search help name (optional)'
                                },
                                searchHelpParameter: {
                                    type: 'string',
                                    description: 'Search help parameter (optional)'
                                },
                                setGetParameter: {
                                    type: 'string',
                                    description: 'SET/GET parameter name (optional)'
                                },
                                defaultComponentName: {
                                    type: 'string',
                                    description: 'Default component name (optional)'
                                },
                                deactivateInputHistory: {
                                    type: 'boolean',
                                    description: 'Deactivate input history'
                                },
                                changeDocument: {
                                    type: 'boolean',
                                    description: 'Create change documents'
                                },
                                leftToRightDirection: {
                                    type: 'boolean',
                                    description: 'Left to right direction'
                                },
                                deactivateBIDIFiltering: {
                                    type: 'boolean',
                                    description: 'Deactivate BIDI filtering'
                                }
                            },
                            required: ['typeKind', 'typeName', 'dataType', 'dataTypeLength', 'fieldLabels']
                        },
                        metaData: {
                            type: 'object',
                            description: 'Data element metadata',
                            properties: {
                                name: {
                                    type: 'string',
                                    description: 'Data element name'
                                },
                                description: {
                                    type: 'string',
                                    description: 'Data element description'
                                },
                                language: {
                                    type: 'string',
                                    description: 'Language code (e.g., ZH for Chinese)'
                                },
                                masterLanguage: {
                                    type: 'string',
                                    description: 'Master language code'
                                },
                                masterSystem: {
                                    type: 'string',
                                    description: 'Master system ID'
                                },
                                responsible: {
                                    type: 'string',
                                    description: 'Responsible user'
                                },
                                packageName: {
                                    type: 'string',
                                    description: 'Package name'
                                }
                            },
                            required: ['name', 'description', 'language', 'masterLanguage', 'masterSystem', 'responsible', 'packageName']
                        },
                        lockHandle: {
                            type: 'string',
                            description: 'Lock handle from lock operation'
                        },
                        transport: {
                            type: 'string',
                            description: 'Transport request number (optional)',
                            optional: true
                        }
                    },
                    required: ['dataElementUrl', 'properties', 'metaData', 'lockHandle']
                }
            }
        ];
    }

    async handle(toolName: string, args: any): Promise<any> {
        switch (toolName) {
            case 'annotationDefinitions':
                return this.handleAnnotationDefinitions(args);
            case 'ddicElement':
                return this.handleDdicElement(args);
            case 'ddicRepositoryAccess':
                return this.handleDdicRepositoryAccess(args);
            case 'packageSearchHelp':
                return this.handlePackageSearchHelp(args);
            case 'setDomainProperties':
                return this.handleSetDomainProperties(args);
            case 'setDataElementProperties':
                return this.handleSetDataElementProperties(args);
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown DDIC tool: ${toolName}`);
        }
    }

    async handleAnnotationDefinitions(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.annotationDefinitions();
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            result
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get annotation definitions: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleDdicElement(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.ddicElement(
                args.path,
                args.getTargetForAssociation,
                args.getExtensionViews,
                args.getSecondaryObjects
            );
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            result
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get DDIC element: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleDdicRepositoryAccess(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.ddicRepositoryAccess(args.path);
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            result
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to access DDIC repository: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handlePackageSearchHelp(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.packageSearchHelp(args.type, args.name);
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            result
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get package search help: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleSetDomainProperties(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            await this.adtclient.setDomainProperties(
                args.domainUrl,
                args.properties,
                args.metaData,
                args.lockHandle,
                args.transport
            );
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            message: 'Domain properties set successfully'
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to set domain properties: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleSetDataElementProperties(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            await this.adtclient.setDataElementProperties(
                args.dataElementUrl,
                args.properties,
                args.metaData,
                args.lockHandle,
                args.transport
            );
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            message: 'Data element properties set successfully'
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to set data element properties: ${error.message || 'Unknown error'}`
            );
        }
    }
}
