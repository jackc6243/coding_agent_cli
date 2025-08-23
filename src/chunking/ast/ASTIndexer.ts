import { Parser, Language, Tree, Node } from 'web-tree-sitter';
import { readFileSync } from 'fs';
import { extname, join } from 'path';
import { ConsoleLogger } from '../../logging/ConsoleLogger.js';

export interface ASTNode {
    id: string;
    type: string;
    name?: string;
    signature?: string;
    content: string;
    filePath: string;
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
    language: string;
    metadata: Record<string, any>;
}

export interface ParsedFile {
    filePath: string;
    language: string;
    nodes: ASTNode[];
    lastModified: number;
    tree: Tree;
    hasErrors: boolean;
}

export class ASTIndexer {
    private parsers: Map<string, Parser> = new Map();
    private languages: Map<string, Language> = new Map();
    private isInitialized = false;
    private logger = new ConsoleLogger("info");
    private supportedExtensions: Record<string, string> = {
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.py': 'python',
        '.java': 'java',
        '.rs': 'rust',
        '.go': 'go',
        '.cpp': 'cpp',
        '.cc': 'cpp',
        '.cxx': 'cpp',
        '.c': 'c',
        '.h': 'c'
    };

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        await Parser.init();

        // Load available language parsers
        await this.loadLanguageParsers();

        this.isInitialized = true;
    }

    private async loadLanguageParsers(): Promise<void> {
        // Use a relative path from the project root for WASM files
        const grammarsDir = join(process.cwd(), 'src/rag/ast/grammars');

        const languageConfigs = [
            { name: 'javascript', path: join(grammarsDir, 'tree-sitter-javascript.wasm') },
            { name: 'python', path: join(grammarsDir, 'tree-sitter-python.wasm') },
            { name: 'typescript', path: join(grammarsDir, 'tree-sitter-typescript.wasm') },
            // { name: 'java', path: join(grammarsDir, 'tree-sitter-java.wasm') },
            // { name: 'rust', path: join(grammarsDir, 'tree-sitter-rust.wasm') },
            // { name: 'go', path: join(grammarsDir, 'tree-sitter-go.wasm') },
            // { name: 'cpp', path: join(grammarsDir, 'tree-sitter-cpp.wasm') },
            // { name: 'c', path: join(grammarsDir, 'tree-sitter-c.wasm') }
        ];

        for (const config of languageConfigs) {
            try {
                const language = await Language.load(config.path);
                const parser = new Parser();
                parser.setLanguage(language);

                this.parsers.set(config.name, parser);
                this.languages.set(config.name, language);

                this.logger.log(`✓ Loaded ${config.name} parser`, "success");
            } catch (error) {
                this.logger.log(`⚠ Failed to load ${config.name} parser`, "warn");
                // Create a basic parser without language for error-tolerant parsing
                const parser = new Parser();
                this.parsers.set(config.name, parser);
            }
        }
    }

    /**
     * Parse a single file and extract AST nodes
     */
    async parseFile(filePath: string, content?: string): Promise<ParsedFile> {
        if (!this.isInitialized) {
            throw new Error('ASTIndexer not initialized. Call initialize() first.');
        }

        const fileContent = content || readFileSync(filePath, 'utf-8');
        const extension = extname(filePath);
        const language = this.supportedExtensions[extension];

        if (!language) {
            throw new Error(`Unsupported file extension: ${extension}`);
        }

        const parser = this.parsers.get(language);
        if (!parser) {
            throw new Error(`Parser not available for language: ${language}`);
        }

        // Parse with tree-sitter (error-tolerant)
        const tree = parser.parse(fileContent);

        if (!tree) {
            throw new Error(`Failed to parse ${filePath} - tree is null`);
        }

        const hasErrors = this.hasParseErrors(tree.rootNode);

        if (hasErrors) {
            this.logger.log(`Parse errors detected in ${filePath}, but continuing with error-tolerant parsing`, "warn");
        }

        const nodes = this.extractNodesFromTree(tree, filePath, fileContent, language);

        return {
            filePath,
            language,
            nodes,
            lastModified: Date.now(),
            tree,
            hasErrors
        };
    }

    /**
     * Check if the parsed tree has syntax errors
     */
    private hasParseErrors(node: Node): boolean {
        if (node.hasError) {
            return true;
        }

        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child && this.hasParseErrors(child)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Extract semantic nodes from a tree-sitter AST
     */
    private extractNodesFromTree(tree: Tree, filePath: string, content: string, language: string): ASTNode[] {
        const nodes: ASTNode[] = [];
        const lines = content.split('\n');

        const traverse = (node: Node) => {
            // Extract different types of nodes based on their type
            const nodeType = node.type;

            if (this.isSemanticNode(nodeType, language)) {
                const astNode = this.createASTNodeFromSyntaxNode(node, filePath, content, language, lines);
                if (astNode) {
                    nodes.push(astNode);
                }
            }

            // Recursively traverse children
            for (let i = 0; i < node.childCount; i++) {
                const child = node.child(i);
                if (child) {
                    traverse(child);
                }
            }
        };

        traverse(tree.rootNode);
        return nodes;
    }

    /**
     * Check if a syntax node type should be extracted as a semantic chunk
     */
    private isSemanticNode(nodeType: string, language: string): boolean {
        const semanticTypes = {
            typescript: [
                'function_declaration',
                'method_definition',
                'arrow_function',
                'function_expression',
                'class_declaration',
                'interface_declaration',
                'type_alias_declaration',
                'enum_declaration',
                'namespace_declaration',
                'variable_declaration',
                'lexical_declaration',
                'export_statement',
                'import_statement'
            ],
            javascript: [
                'function_declaration',
                'method_definition',
                'arrow_function',
                'function_expression',
                'class_declaration',
                'variable_declaration',
                'lexical_declaration',
                'export_statement',
                'import_statement'
            ],
            python: [
                'function_definition',
                'class_definition',
                'assignment',
                'import_statement',
                'import_from_statement',
                'decorated_definition'
            ],
            java: [
                'method_declaration',
                'class_declaration',
                'interface_declaration',
                'field_declaration',
                'constructor_declaration',
                'enum_declaration',
                'import_declaration',
                'package_declaration'
            ],
            rust: [
                'function_item',
                'struct_item',
                'enum_item',
                'impl_item',
                'trait_item',
                'mod_item',
                'use_declaration',
                'const_item',
                'static_item'
            ],
            go: [
                'function_declaration',
                'method_declaration',
                'type_declaration',
                'var_declaration',
                'const_declaration',
                'import_declaration',
                'package_clause'
            ],
            cpp: [
                'function_definition',
                'function_declarator',
                'class_specifier',
                'struct_specifier',
                'namespace_definition',
                'template_declaration',
                'using_declaration',
                'preproc_include'
            ],
            c: [
                'function_definition',
                'function_declarator',
                'struct_specifier',
                'typedef_definition',
                'preproc_include',
                'declaration'
            ]
        };

        return semanticTypes[language as keyof typeof semanticTypes]?.includes(nodeType) || false;
    }

    /**
     * Create an ASTNode from a tree-sitter SyntaxNode
     */
    private createASTNodeFromSyntaxNode(
        node: Node,
        filePath: string,
        content: string,
        language: string,
        lines: string[]
    ): ASTNode | null {
        const startPosition = node.startPosition;
        const endPosition = node.endPosition;
        const nodeText = node.text;

        // Extract name based on node type using tree-sitter traversal
        const name = this.extractNodeName(node, language);
        const type = this.mapNodeTypeToSemanticType(node.type, language);

        // Extract signature using tree-sitter structure
        const signature = this.extractSignature(node, language);

        return {
            id: `${filePath}-${type}-${name || 'anonymous'}-${startPosition.row}`,
            type,
            name,
            signature,
            content: nodeText,
            filePath,
            startLine: startPosition.row + 1,
            endLine: endPosition.row + 1,
            startColumn: startPosition.column,
            endColumn: endPosition.column,
            language,
            metadata: {
                nodeType: node.type,
                hasChildren: node.childCount > 0,
                declarationType: type,
                hasErrors: node.hasError,
                isNamed: node.isNamed,
                parentType: node.parent?.type
            }
        };
    }

    /**
     * Extract the name identifier from a syntax node using tree-sitter traversal
     */
    private extractNodeName(node: Node, language: string): string | undefined {
        // Define identifier node types by language
        const identifierTypes = {
            typescript: ['identifier', 'property_identifier', 'type_identifier'],
            javascript: ['identifier', 'property_identifier'],
            python: ['identifier'],
            java: ['identifier'],
            rust: ['identifier', 'type_identifier'],
            go: ['identifier', 'type_identifier', 'field_identifier'],
            cpp: ['identifier', 'type_identifier'],
            c: ['identifier', 'type_identifier']
        };

        const validIdentifiers = identifierTypes[language as keyof typeof identifierTypes] || ['identifier'];

        // Recursively search for identifier nodes
        const findIdentifier = (searchNode: Node, depth: number = 0): string | undefined => {
            // Limit recursion depth to avoid infinite loops
            if (depth > 3) return undefined;

            // Check if current node is an identifier
            if (validIdentifiers.includes(searchNode.type)) {
                return searchNode.text;
            }

            // Search in named children first (more likely to contain the name)
            for (let i = 0; i < searchNode.namedChildCount; i++) {
                const child = searchNode.namedChild(i);
                if (child) {
                    const result = findIdentifier(child, depth + 1);
                    if (result) return result;
                }
            }

            return undefined;
        };

        return findIdentifier(node);
    }

    /**
     * Map tree-sitter node types to semantic types
     */
    private mapNodeTypeToSemanticType(nodeType: string, language: string): string {
        const typeMap: Record<string, string> = {
            // Functions
            'function_declaration': 'function',
            'function_definition': 'function',
            'method_definition': 'function',
            'method_declaration': 'function',
            'arrow_function': 'function',
            'function_expression': 'function',
            'function_item': 'function',
            'constructor_declaration': 'function',

            // Classes and structures
            'class_declaration': 'class',
            'class_definition': 'class',
            'class_specifier': 'class',
            'struct_specifier': 'struct',
            'struct_item': 'struct',

            // Interfaces and traits
            'interface_declaration': 'interface',
            'trait_item': 'trait',

            // Types
            'type_alias_declaration': 'type',
            'type_declaration': 'type',
            'typedef_definition': 'type',

            // Enums
            'enum_declaration': 'enum',
            'enum_item': 'enum',

            // Namespaces and modules
            'namespace_declaration': 'namespace',
            'namespace_definition': 'namespace',
            'mod_item': 'module',

            // Variables and constants
            'variable_declaration': 'variable',
            'lexical_declaration': 'variable',
            'field_declaration': 'variable',
            'assignment': 'variable',
            'var_declaration': 'variable',
            'const_declaration': 'constant',
            'const_item': 'constant',
            'static_item': 'constant',

            // Imports and exports
            'import_statement': 'import',
            'import_declaration': 'import',
            'import_from_statement': 'import',
            'export_statement': 'export',
            'use_declaration': 'import',
            'preproc_include': 'include',

            // Other
            'impl_item': 'implementation',
            'template_declaration': 'template',
            'package_declaration': 'package',
            'package_clause': 'package',
            'decorated_definition': 'decorator'
        };

        return typeMap[nodeType] || 'unknown';
    }

    /**
     * Extract signature from a node using tree-sitter structure
     */
    private extractSignature(node: Node, language: string): string {
        // For different node types, we want different parts of the signature
        const nodeType = node.type;

        // Function signatures: include parameters and return type if available
        if (nodeType.includes('function') || nodeType.includes('method')) {
            return this.extractFunctionSignature(node, language);
        }

        // Class signatures: include inheritance if available
        if (nodeType.includes('class') || nodeType.includes('struct')) {
            return this.extractClassSignature(node, language);
        }

        // Type signatures: include the type definition
        if (nodeType.includes('type') || nodeType.includes('interface')) {
            return this.extractTypeSignature(node, language);
        }

        // Default: return the first line of the node
        return node.text.split('\n')[0].trim();
    }

    private extractFunctionSignature(node: Node, language: string): string {
        // Find parameter list and return type
        let signature = '';

        // Find the function name and parameters
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (!child) continue;

            if (child.type === 'identifier' || child.type === 'property_identifier') {
                signature += child.text;
            } else if (child.type.includes('parameter') || child.type === 'formal_parameters') {
                signature += child.text;
            } else if (child.type.includes('type') && !child.type.includes('type_parameter')) {
                signature += ': ' + child.text;
            }
        }

        return signature || node.text.split('\n')[0].trim();
    }

    private extractClassSignature(node: Node, language: string): string {
        // Find class name and inheritance
        let signature = '';

        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (!child) continue;

            if (child.type === 'identifier' || child.type === 'type_identifier') {
                signature += child.text;
            } else if (child.type.includes('extends') || child.type.includes('implements') || child.type.includes('heritage')) {
                signature += ' ' + child.text;
                break; // Stop after inheritance clause
            }
        }

        return signature || node.text.split('\n')[0].trim();
    }

    private extractTypeSignature(node: Node, language: string): string {
        // For type declarations, include the full type definition up to a reasonable limit
        const lines = node.text.split('\n');

        // If it's a simple type, return the whole thing
        if (lines.length <= 3) {
            return node.text.trim();
        }

        // For complex types, return the first few lines
        return lines.slice(0, 2).join(' ').replace(/\s+/g, ' ').trim() + '...';
    }

    /**
     * Get statistics about the parsed AST
     */
    getParseStats(parsedFile: ParsedFile): {
        nodeTypes: Record<string, number>;
        totalNodes: number;
        hasErrors: boolean;
        errorNodes: number;
    } {
        const nodeTypes: Record<string, number> = {};
        let errorNodes = 0;

        for (const node of parsedFile.nodes) {
            nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
            if (node.metadata.hasErrors) {
                errorNodes++;
            }
        }

        return {
            nodeTypes,
            totalNodes: parsedFile.nodes.length,
            hasErrors: parsedFile.hasErrors,
            errorNodes
        };
    }

    getSupportedLanguages(): string[] {
        return Object.values(this.supportedExtensions);
    }

    isSupported(extension: string): boolean {
        return extension in this.supportedExtensions;
    }

    getLanguageForExtension(extension: string): string | undefined {
        return this.supportedExtensions[extension];
    }

    getAvailableParsers(): string[] {
        return Array.from(this.parsers.keys());
    }
}