import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { BaseHandler } from './BaseHandler.js';
import type { ToolDefinition } from '../types/tools.js';
import { GitRepo, GitStaging } from 'abap-adt-api';
import { shrinkToFit, SAFE_OUTPUT_CHARS } from '../lib/responseSizing.js';

export class GitHandlers extends BaseHandler {
    getTools(): ToolDefinition[] {
        return [
            {
                name: 'gitRepos',
                description: 'Retrieves a list of Git repositories.',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                name: 'gitExternalRepoInfo',
                description: 'Retrieves information about an external Git repository.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        repourl: {
                            type: 'string',
                            description: 'The URL of the repository.'
                        },
                        user: {
                            type: 'string',
                            description: 'The username.',
                            optional: true
                        },
                        password: {
                            type: 'string',
                            description: 'The password.',
                            optional: true
                        }
                    },
                    required: ['repourl']
                }
            },
            {
                name: 'gitCreateRepo',
                description: 'Creates a new Git repository.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        packageName: {
                            type: 'string',
                            description: 'The name of the package.'
                        },
                        repourl: {
                            type: 'string',
                            description: 'The URL of the repository.'
                        },
                        branch: {
                            type: 'string',
                            description: 'The branch name.',
                            optional: true
                        },
                        transport: {
                            type: 'string',
                            description: 'The transport.',
                            optional: true
                        },
                        user: {
                            type: 'string',
                            description: 'The username.',
                            optional: true
                        },
                        password: {
                            type: 'string',
                            description: 'The password.',
                            optional: true
                        }
                    },
                    required: ['packageName', 'repourl']
                }
            },
            {
                name: 'gitPullRepo',
                description: 'Pulls changes from a Git repository. For repos with many changed objects, use startIndex/maxItems to page through the list of imported/changed objects returned in the response instead of retrieving it all at once.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        repoId: {
                            type: 'string',
                            description: 'The ID of the repository.'
                        },
                        branch: {
                            type: 'string',
                            description: 'The branch name.',
                            optional: true
                        },
                        transport: {
                            type: 'string',
                            description: 'The transport.',
                            optional: true
                        },
                        user: {
                            type: 'string',
                            description: 'The username.',
                            optional: true
                        },
                        password: {
                            type: 'string',
                            description: 'The password.',
                            optional: true
                        },
                        startIndex: {
                            type: 'number',
                            description: '0-based index of the imported/changed object to start from (default 0). Use with maxItems to page through a large pull result. Note: the pull itself already happened by the time this pages the result - this only limits what is reported back.',
                            optional: true
                        },
                        maxItems: {
                            type: 'number',
                            description: 'Maximum number of imported/changed objects to return from startIndex. Omit to return the rest.',
                            optional: true
                        }
                    },
                    required: ['repoId']
                }
            },
            {
                name: 'gitUnlinkRepo',
                description: 'Unlinks a Git repository.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        repoId: {
                            type: 'string',
                            description: 'The ID of the repository.'
                        }
                    },
                    required: ['repoId']
                }
            },
            {
                name: 'stageRepo',
                description: 'Stages changes in a Git repository. For a large initial package push, use startIndex/maxItems to page through the staged/unstaged/ignored object lists instead of retrieving them all at once.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        repo: {
                            type: 'object',
                            description: 'The Git repository object.'
                        },
                        user: {
                            type: 'string',
                            description: 'The username.',
                            optional: true
                        },
                        password: {
                            type: 'string',
                            description: 'The password.',
                            optional: true
                        },
                        startIndex: {
                            type: 'number',
                            description: '0-based index into each of the staged/unstaged/ignored lists to start from (default 0). Use with maxItems to page through large staging results.',
                            optional: true
                        },
                        maxItems: {
                            type: 'number',
                            description: 'Maximum number of items per list (staged/unstaged/ignored) to return from startIndex. Omit to return the rest.',
                            optional: true
                        }
                    },
                    required: ['repo']
                }
            },
            {
                name: 'pushRepo',
                description: 'Pushes changes to a Git repository.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        repo: {
                            type: 'object',
                            description: 'The Git repository object.'
                        },
                        staging: {
                            type: 'object',
                            description: 'The staging information object.'
                        },
                        user: {
                            type: 'string',
                            description: 'The username.',
                            optional: true
                        },
                        password: {
                            type: 'string',
                            description: 'The password.',
                            optional: true
                        }
                    },
                    required: ['repo', 'staging']
                }
            },
            {
                name: 'checkRepo',
                description: 'Checks a Git repository.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        repo: {
                            type: 'string',
                            description: 'The Git repository.'
                        },
                        user: {
                            type: 'string',
                            description: 'The username.',
                            optional: true
                        },
                        password: {
                            type: 'string',
                            description: 'The password.',
                            optional: true
                        }
                    },
                    required: ['repo']
                }
            },
            {
                name: 'remoteRepoInfo',
                description: 'Retrieves information about a remote Git repository.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        repo: {
                            type: 'string',
                            description: 'The Git repository.'
                        },
                        user: {
                            type: 'string',
                            description: 'The username.',
                            optional: true
                        },
                        password: {
                            type: 'string',
                            description: 'The password.',
                            optional: true
                        }
                    },
                    required: ['repo']
                }
            },
            {
                name: 'switchRepoBranch',
                description: 'Switches the branch of a Git repository.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        repo: {
                            type: 'string',
                            description: 'The Git repository.'
                        },
                        branch: {
                            type: 'string',
                            description: 'The branch name.'
                        },
                        create: {
                            type: 'boolean',
                            description: 'Whether to create the branch if it doesn\'t exist.',
                            optional: true
                        },
                        user: {
                            type: 'string',
                            description: 'The username.',
                            optional: true
                        },
                        password: {
                            type: 'string',
                            description: 'The password.',
                            optional: true
                        }
                    },
                    required: ['repo', 'branch']
                }
            }
        ];
    }

    async handle(toolName: string, args: any): Promise<any> {
        switch (toolName) {
            case 'gitRepos':
                return this.handleGitRepos(args);
            case 'gitExternalRepoInfo':
                return this.handleGitExternalRepoInfo(args);
            case 'gitCreateRepo':
                return this.handleGitCreateRepo(args);
            case 'gitPullRepo':
                return this.handleGitPullRepo(args);
            case 'gitUnlinkRepo':
                return this.handleGitUnlinkRepo(args);
            case 'stageRepo':
                return this.handleStageRepo(args);
            case 'pushRepo':
                return this.handlePushRepo(args);
            case 'checkRepo':
                return this.handleCheckRepo(args);
            case 'remoteRepoInfo':
                return this.handleRemoteRepoInfo(args);
            case 'switchRepoBranch':
                return this.handleSwitchRepoBranch(args);
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown git tool: ${toolName}`);
        }
    }

    async handleGitRepos(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const repos = await this.adtclient.gitRepos();
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            repos
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get git repos: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleGitExternalRepoInfo(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const repoInfo = await this.adtclient.gitExternalRepoInfo(
                args.repourl,
                args.user,
                args.password
            );
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            repoInfo
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get external repo info: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleGitCreateRepo(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.gitCreateRepo(
                args.packageName,
                args.repourl,
                args.branch,
                args.transport,
                args.user,
                args.password
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
                `Failed to create git repo: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleGitPullRepo(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.gitPullRepo(
                args.repoId,
                args.branch,
                args.transport,
                args.user,
                args.password
            );
            this.trackRequest(startTime, true);

            const requestedPaging = args.startIndex !== undefined || args.maxItems !== undefined;

            if (!requestedPaging) {
                const text = JSON.stringify({ status: 'success', result });
                if (text.length <= SAFE_OUTPUT_CHARS) {
                    return { content: [{ type: 'text', text }] };
                }
            }

            // The pull itself already happened by the time we get here - paging
            // below only limits what is reported back, not what was imported.
            const allObjects: any[] = Array.isArray(result) ? result : [];
            const totalObjects = allObjects.length;
            const startIndex = Math.max(0, Number(args.startIndex) || 0);
            const initialMaxItems = args.maxItems !== undefined
                ? Math.max(0, Number(args.maxItems))
                : totalObjects - startIndex;

            const text = shrinkToFit(initialMaxItems, (count, capped) => {
                const endIndex = Math.min(startIndex + count, totalObjects);
                const payload: any = {
                    status: 'success',
                    result: allObjects.slice(startIndex, endIndex),
                    totalObjects,
                    startIndex,
                    returnedObjects: Math.max(0, endIndex - startIndex),
                    hasMore: endIndex < totalObjects
                };
                if (!requestedPaging) {
                    payload.autoPaged = true;
                }
                if (capped) {
                    payload.capped = true;
                    payload.note = 'Requested/default range exceeded the safe response size and was shrunk to fit. Pass a smaller maxItems (or a later startIndex) to continue. The pull itself already completed - this only limits what is reported back.';
                }
                return payload;
            });

            return { content: [{ type: 'text', text }] };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to pull git repo: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleGitUnlinkRepo(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.gitUnlinkRepo(args.repoId);
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
                `Failed to unlink git repo: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleStageRepo(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result: GitStaging = await this.adtclient.stageRepo(
                args.repo,
                args.user,
                args.password
            );
            this.trackRequest(startTime, true);

            const requestedPaging = args.startIndex !== undefined || args.maxItems !== undefined;

            if (!requestedPaging) {
                const text = JSON.stringify({ status: 'success', result });
                if (text.length <= SAFE_OUTPUT_CHARS) {
                    return { content: [{ type: 'text', text }] };
                }
            }

            const staged: any[] = Array.isArray(result.staged) ? result.staged : [];
            const unstaged: any[] = Array.isArray(result.unstaged) ? result.unstaged : [];
            const ignored: any[] = Array.isArray(result.ignored) ? result.ignored : [];
            const startIndex = Math.max(0, Number(args.startIndex) || 0);
            const largestList = Math.max(staged.length, unstaged.length, ignored.length);
            const initialMaxItems = args.maxItems !== undefined
                ? Math.max(0, Number(args.maxItems))
                : largestList - startIndex;

            const text = shrinkToFit(initialMaxItems, (count, capped) => {
                const page = (arr: any[]) => {
                    const endIndex = Math.min(startIndex + count, arr.length);
                    return {
                        items: arr.slice(startIndex, endIndex),
                        total: arr.length,
                        returned: Math.max(0, endIndex - startIndex),
                        hasMore: endIndex < arr.length
                    };
                };
                const stagedPage = page(staged);
                const unstagedPage = page(unstaged);
                const ignoredPage = page(ignored);
                const paged = {
                    ...result,
                    staged: stagedPage.items,
                    unstaged: unstagedPage.items,
                    ignored: ignoredPage.items
                };
                const payload: any = {
                    status: 'success',
                    result: paged,
                    startIndex,
                    totals: { staged: stagedPage.total, unstaged: unstagedPage.total, ignored: ignoredPage.total },
                    returned: { staged: stagedPage.returned, unstaged: unstagedPage.returned, ignored: ignoredPage.returned },
                    hasMore: stagedPage.hasMore || unstagedPage.hasMore || ignoredPage.hasMore
                };
                if (!requestedPaging) {
                    payload.autoPaged = true;
                }
                if (capped) {
                    payload.capped = true;
                    payload.note = 'Requested/default range exceeded the safe response size and was shrunk to fit. Pass a smaller maxItems (or a later startIndex) to continue.';
                }
                return payload;
            });

            return { content: [{ type: 'text', text }] };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to stage repo: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handlePushRepo(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.pushRepo(
                args.repo,
                args.staging,
                args.user,
                args.password
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
                `Failed to push repo: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleCheckRepo(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.checkRepo(
                args.repo,
                args.user,
                args.password
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
                `Failed to check repo: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleRemoteRepoInfo(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const repoInfo = await this.adtclient.remoteRepoInfo(
                args.repo,
                args.user,
                args.password
            );
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            repoInfo
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get remote repo info: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleSwitchRepoBranch(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.switchRepoBranch(
                args.repo,
                args.branch,
                args.create,
                args.user,
                args.password
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
                `Failed to switch repo branch: ${error.message || 'Unknown error'}`
            );
        }
    }
}
