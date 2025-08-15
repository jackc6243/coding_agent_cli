import { getRagConfig } from '../config/RAGConfig.js';
import { readdir, stat, readFile } from 'fs/promises';
import { join, extname, relative } from 'path';
import { FILE_PATTERNS } from '../../config/FilePatterns.js';

export interface FileInfo {
    path: string;
    relativePath: string;
    content: string;
    extension: string;
    size: number;
    lastModified: Date;
}

export class FileBrowser {
    private config = getRagConfig();
    private supportedExtensions = new Set([...FILE_PATTERNS.SUPPORTED_EXTENSIONS]);

    async browseFiles(): Promise<FileInfo[]> {
        const files: FileInfo[] = [];
        const rootPath = this.config.index_folder;
        
        await this.scanDirectory(rootPath, files);
        return files;
    }

    private async scanDirectory(dirPath: string, files: FileInfo[]): Promise<void> {
        try {
            const entries = await readdir(dirPath);
            
            for (const entry of entries) {
                const fullPath = join(dirPath, entry);
                const stats = await stat(fullPath);
                
                if (this.isExcluded(entry, fullPath)) {
                    continue;
                }
                
                if (stats.isDirectory()) {
                    await this.scanDirectory(fullPath, files);
                } else if (stats.isFile() && this.shouldIncludeFile(entry)) {
                    try {
                        const content = await readFile(fullPath, 'utf-8');
                        const relativePath = relative(this.config.index_folder, fullPath);
                        
                        files.push({
                            path: fullPath,
                            relativePath,
                            content,
                            extension: extname(entry),
                            size: stats.size,
                            lastModified: stats.mtime
                        });
                    } catch (error) {
                        console.warn(`Failed to read file ${fullPath}:`, error);
                    }
                }
            }
        } catch (error) {
            console.warn(`Failed to scan directory ${dirPath}:`, error);
        }
    }

    private isExcluded(name: string, fullPath: string): boolean {
        if ((FILE_PATTERNS.IGNORE_DIRECTORIES as readonly string[]).includes(name)) {
            return true;
        }
        
        // Check user-defined exclusions
        for (const exclusion of this.config.exclusion_list) {
            if (name === exclusion.name || fullPath.includes(exclusion.name)) {
                return true;
            }
        }
        
        return false;
    }

    private shouldIncludeFile(fileName: string): boolean {
        const ext = extname(fileName);
        return this.supportedExtensions.has(ext as any);
    }
}