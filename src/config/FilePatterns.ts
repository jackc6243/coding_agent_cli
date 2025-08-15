// File pattern configurations
export const FILE_PATTERNS = {
    // Directories to ignore when scanning files
    IGNORE_DIRECTORIES: [
        "node_modules", ".git", "dist", "build", ".next", 
        "coverage", ".nyc_output", ".vscode", ".idea",
        "__pycache__", ".pytest_cache", "target", "vendor"
    ],
    
    // Patterns to ignore when watching files
    WATCH_IGNORE_PATTERNS: [
        "**/node_modules/**",
        "**/.git/**", 
        "**/dist/**",
        "**/build/**"
    ],
    
    // Supported file extensions for processing
    SUPPORTED_EXTENSIONS: [
        ".ts", ".tsx", ".js", ".jsx", ".py", ".java", ".cpp", ".c", ".h", 
        ".cs", ".go", ".rs", ".php", ".rb", ".swift", ".kt", ".scala", 
        ".clj", ".hs", ".ml", ".elm", ".dart", ".lua", ".perl", ".r",
        ".md", ".txt", ".json", ".yaml", ".yml", ".xml", ".html", ".css"
    ],
    
    // Language mappings for file extensions
    LANGUAGE_MAPPINGS: {
        'ts': 'typescript',
        'tsx': 'typescript',
        'js': 'javascript',
        'jsx': 'javascript',
        'py': 'python',
        'java': 'java',
        'cpp': 'cpp',
        'c': 'c',
        'h': 'c',
        'hpp': 'cpp',
        'go': 'go',
        'rs': 'rust',
        'php': 'php',
        'rb': 'ruby',
        'swift': 'swift',
        'md': 'markdown',
        'json': 'json',
        'yaml': 'yaml',
        'yml': 'yaml',
        'html': 'html',
        'css': 'css',
        'scss': 'scss',
        'less': 'less'
    }
} as const;