import { FileBrowser } from '../../services/FileBrowser.js';
import type { FileInfo } from '../../services/FileBrowser.js';
import { getRagConfig } from '../../config/RAGConfig.js';

// Mock fs promises
jest.mock('fs/promises', () => ({
    readdir: jest.fn(),
    stat: jest.fn(),
    readFile: jest.fn()
}));

// Mock path functions
jest.mock('path', () => ({
    join: jest.fn((...args) => args.join('/')),
    extname: jest.fn((path) => {
        const parts = path.split('.');
        return parts.length > 1 ? '.' + parts[parts.length - 1] : '';
    }),
    relative: jest.fn((from, to) => to.replace(from, '').replace(/^\//, ''))
}));

// Mock RAG config
jest.mock('../../config/RAGConfig.js', () => ({
    getRagConfig: jest.fn(() => ({
        index_folder: '/test/project',
        exclusion_list: [
            { name: 'node_modules', exclude_children: true },
            { name: '.git', exclude_children: true }
        ]
    }))
}));

// Mock FilePatterns
jest.mock('../../../config/FilePatterns.js', () => ({
    FILE_PATTERNS: {
        SUPPORTED_EXTENSIONS: ['.ts', '.js', '.py', '.json', '.md', '.css'],
        IGNORE_DIRECTORIES: ['node_modules', '.git', 'dist', 'build']
    }
}));

describe('FileBrowser', () => {
    let fileBrowser: FileBrowser;
    let mockReaddir: jest.Mock;
    let mockStat: jest.Mock;
    let mockReadFile: jest.Mock;

    beforeEach(() => {
        const fs = require('fs/promises');
        mockReaddir = fs.readdir as jest.Mock;
        mockStat = fs.stat as jest.Mock;
        mockReadFile = fs.readFile as jest.Mock;

        fileBrowser = new FileBrowser();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('browseFiles', () => {
        test('should scan files and return FileInfo array', async () => {
            // Mock directory structure
            mockReaddir
                .mockResolvedValueOnce(['src', 'package.json', 'README.md'])
                .mockResolvedValueOnce(['index.ts', 'utils.ts']);

            mockStat
                .mockResolvedValueOnce({ 
                    isDirectory: () => true, 
                    isFile: () => false 
                })
                .mockResolvedValueOnce({ 
                    isDirectory: () => false, 
                    isFile: () => true,
                    size: 1024,
                    mtime: new Date('2023-01-01')
                })
                .mockResolvedValueOnce({ 
                    isDirectory: () => false, 
                    isFile: () => true,
                    size: 512,
                    mtime: new Date('2023-01-02')
                })
                .mockResolvedValueOnce({ 
                    isDirectory: () => false, 
                    isFile: () => true,
                    size: 256,
                    mtime: new Date('2023-01-03')
                })
                .mockResolvedValueOnce({ 
                    isDirectory: () => false, 
                    isFile: () => true,
                    size: 128,
                    mtime: new Date('2023-01-04')
                });

            mockReadFile
                .mockResolvedValueOnce('{"name": "test-project"}')
                .mockResolvedValueOnce('# Test Project')
                .mockResolvedValueOnce('export const main = () => {};')
                .mockResolvedValueOnce('export const helper = () => {};');

            const files = await fileBrowser.browseFiles();

            expect(files).toHaveLength(4);
            expect(files[0]).toMatchObject({
                path: '/test/project/package.json',
                extension: '.json',
                content: '{"name": "test-project"}',
                size: 1024
            });
            expect(files[1]).toMatchObject({
                path: '/test/project/README.md',
                extension: '.md',
                content: '# Test Project',
                size: 512
            });
        });

        test('should exclude directories in exclusion list', async () => {
            mockReaddir
                .mockResolvedValueOnce(['src', 'node_modules', '.git', 'README.md'])
                .mockResolvedValueOnce(['index.ts']);

            mockStat
                .mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false })
                .mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false })
                .mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false })
                .mockResolvedValueOnce({ 
                    isDirectory: () => false, 
                    isFile: () => true,
                    size: 256,
                    mtime: new Date()
                })
                .mockResolvedValueOnce({ 
                    isDirectory: () => false, 
                    isFile: () => true,
                    size: 128,
                    mtime: new Date()
                });

            mockReadFile
                .mockResolvedValueOnce('# README')
                .mockResolvedValueOnce('export const main = () => {};');

            const files = await fileBrowser.browseFiles();

            expect(mockReaddir).toHaveBeenCalledTimes(2); // Only root and src, not node_modules or .git
            expect(files).toHaveLength(2);
        });

        test('should only include supported file extensions', async () => {
            mockReaddir.mockResolvedValueOnce([
                'index.ts',      // supported
                'script.js',     // supported
                'data.json',     // supported
                'image.png',     // not supported
                'binary.exe',    // not supported
                'style.css'      // supported
            ]);

            const supportedFiles = [
                { size: 100, mtime: new Date() },
                { size: 200, mtime: new Date() },
                { size: 300, mtime: new Date() },
                { size: 400, mtime: new Date() }
            ];

            mockStat
                .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true, ...supportedFiles[0] })
                .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true, ...supportedFiles[1] })
                .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true, ...supportedFiles[2] })
                .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true, size: 999, mtime: new Date() })
                .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true, size: 999, mtime: new Date() })
                .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true, ...supportedFiles[3] });

            mockReadFile
                .mockResolvedValueOnce('typescript content')
                .mockResolvedValueOnce('javascript content')
                .mockResolvedValueOnce('{"json": "content"}')
                .mockResolvedValueOnce('css content');

            const files = await fileBrowser.browseFiles();

            expect(files).toHaveLength(4);
            expect(files.map(f => f.extension)).toEqual(['.ts', '.js', '.json', '.css']);
        });

        test('should handle file read errors gracefully', async () => {
            mockReaddir.mockResolvedValueOnce(['good.ts', 'bad.ts']);

            mockStat
                .mockResolvedValueOnce({ 
                    isDirectory: () => false, 
                    isFile: () => true,
                    size: 100,
                    mtime: new Date()
                })
                .mockResolvedValueOnce({ 
                    isDirectory: () => false, 
                    isFile: () => true,
                    size: 200,
                    mtime: new Date()
                });

            mockReadFile
                .mockResolvedValueOnce('good content')
                .mockRejectedValueOnce(new Error('Permission denied'));

            const files = await fileBrowser.browseFiles();

            expect(files).toHaveLength(1);
            expect(files[0].path).toBe('/test/project/good.ts');
        });

        test('should handle directory scan errors gracefully', async () => {
            mockReaddir
                .mockResolvedValueOnce(['accessible', 'restricted'])
                .mockRejectedValueOnce(new Error('Permission denied'));

            mockStat.mockResolvedValueOnce({ 
                isDirectory: () => true, 
                isFile: () => false 
            });

            const files = await fileBrowser.browseFiles();

            expect(files).toHaveLength(0);
            // Should not throw despite directory scan error
        });

        test('should set correct relative paths', async () => {
            mockReaddir
                .mockResolvedValueOnce(['subdir'])
                .mockResolvedValueOnce(['nested.ts']);

            mockStat
                .mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false })
                .mockResolvedValueOnce({ 
                    isDirectory: () => false, 
                    isFile: () => true,
                    size: 100,
                    mtime: new Date()
                });

            mockReadFile.mockResolvedValueOnce('nested content');

            const files = await fileBrowser.browseFiles();

            expect(files).toHaveLength(1);
            expect(files[0].relativePath).toBe('subdir/nested.ts');
        });
    });

    describe('exclusion logic', () => {
        test('should exclude common directories', async () => {
            mockReaddir.mockResolvedValueOnce([
                'src',
                'node_modules',
                '.git',
                'dist',
                'build',
                '.next',
                'coverage',
                '.vscode',
                '__pycache__',
                'target'
            ]);

            // Mock all as directories
            for (let i = 0; i < 10; i++) {
                mockStat.mockResolvedValueOnce({ 
                    isDirectory: () => true, 
                    isFile: () => false 
                });
            }

            // Only src should be scanned
            mockReaddir.mockResolvedValueOnce(['index.ts']);
            mockStat.mockResolvedValueOnce({ 
                isDirectory: () => false, 
                isFile: () => true,
                size: 100,
                mtime: new Date()
            });
            mockReadFile.mockResolvedValueOnce('content');

            const files = await fileBrowser.browseFiles();

            expect(mockReaddir).toHaveBeenCalledTimes(2); // Root + src only
            expect(files).toHaveLength(1);
        });

        test('should exclude custom directories from config', async () => {
            // Mock custom exclusion
            (getRagConfig as jest.Mock).mockReturnValue({
                index_folder: '/test/project',
                exclusion_list: [
                    { name: 'custom_exclude', exclude_children: true }
                ]
            });

            const customBrowser = new FileBrowser();

            mockReaddir.mockResolvedValueOnce(['src', 'custom_exclude']);

            mockStat
                .mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false })
                .mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false });

            // Only src should be scanned
            mockReaddir.mockResolvedValueOnce(['index.ts']);
            mockStat.mockResolvedValueOnce({ 
                isDirectory: () => false, 
                isFile: () => true,
                size: 100,
                mtime: new Date()
            });
            mockReadFile.mockResolvedValueOnce('content');

            const files = await customBrowser.browseFiles();

            expect(mockReaddir).toHaveBeenCalledTimes(2); // Root + src only
        });
    });

    describe('file extension support', () => {
        test('should support all documented file types', () => {
            const supportedExtensions = [
                '.ts', '.js', '.tsx', '.jsx',
                '.py', '.java', '.cpp', '.c', '.h', '.hpp',
                '.go', '.rs', '.php', '.rb', '.swift',
                '.md', '.txt', '.json', '.yaml', '.yml',
                '.html', '.css', '.scss', '.less'
            ];

            supportedExtensions.forEach(ext => {
                const shouldInclude = fileBrowser['shouldIncludeFile'](`test${ext}`);
                expect(shouldInclude).toBe(true);
            });
        });

        test('should reject unsupported file types', () => {
            const unsupportedExtensions = [
                '.png', '.jpg', '.gif', '.pdf',
                '.exe', '.dll', '.so', '.dylib',
                '.zip', '.tar', '.gz',
                '.mov', '.mp4', '.avi'
            ];

            unsupportedExtensions.forEach(ext => {
                const shouldInclude = fileBrowser['shouldIncludeFile'](`test${ext}`);
                expect(shouldInclude).toBe(false);
            });
        });
    });

    describe('edge cases', () => {
        test('should handle empty directories', async () => {
            mockReaddir.mockResolvedValueOnce([]);

            const files = await fileBrowser.browseFiles();

            expect(files).toHaveLength(0);
        });

        test('should handle files without extensions', async () => {
            mockReaddir.mockResolvedValueOnce(['Dockerfile', 'Makefile', 'LICENSE']);

            mockStat
                .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true, size: 100, mtime: new Date() })
                .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true, size: 100, mtime: new Date() })
                .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true, size: 100, mtime: new Date() });

            const files = await fileBrowser.browseFiles();

            expect(files).toHaveLength(0); // No extension = not supported
        });

        test('should handle very large files', async () => {
            mockReaddir.mockResolvedValueOnce(['large.txt']);

            mockStat.mockResolvedValueOnce({ 
                isDirectory: () => false, 
                isFile: () => true,
                size: 10 * 1024 * 1024, // 10MB
                mtime: new Date()
            });

            mockReadFile.mockResolvedValueOnce('x'.repeat(10 * 1024 * 1024));

            const files = await fileBrowser.browseFiles();

            expect(files).toHaveLength(1);
            expect(files[0].size).toBe(10 * 1024 * 1024);
        });

        test('should handle special characters in filenames', async () => {
            mockReaddir.mockResolvedValueOnce(['测试.ts', 'file with spaces.js', 'file-with-émojis🎉.py']);

            mockStat
                .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true, size: 100, mtime: new Date() })
                .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true, size: 100, mtime: new Date() })
                .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true, size: 100, mtime: new Date() });

            mockReadFile
                .mockResolvedValueOnce('chinese content')
                .mockResolvedValueOnce('spaces content')
                .mockResolvedValueOnce('emoji content');

            const files = await fileBrowser.browseFiles();

            expect(files).toHaveLength(3);
            expect(files.map(f => f.extension)).toEqual(['.ts', '.js', '.py']);
        });
    });
});