import * as crypto from 'crypto';
import * as fs from 'fs';

class HashHelper {
    private readonly algo: string = "sha256";

    public hashFile(filePath: string): string {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        return crypto.createHash(this.algo).update(fileContent).digest('hex');
    }

    public hashFileFromString(content : string) {
        return crypto.createHash(this.algo).update(content).digest('hex');
    }

    public hashFileLines(filePath: string, startLine: number, endLine: number): string {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const lines = fileContent.split('\n');
        
        if (startLine < 1 || endLine > lines.length || startLine > endLine) {
            throw new Error('Invalid line range');
        }
        
        const selectedLines = lines.slice(startLine - 1, endLine).join('\n');
        return crypto.createHash(this.algo).update(selectedLines).digest('hex');
    }

    public hashFileIntervals(filePath: string, intervals: Array<{start: number, end: number}>): string {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const lines = fileContent.split('\n');
        
        let combinedContent = '';
        
        for (const interval of intervals) {
            if (interval.start < 1 || interval.end > lines.length || interval.start > interval.end) {
                throw new Error(`Invalid interval: ${interval.start}-${interval.end}`);
            }
            
            const selectedLines = lines.slice(interval.start - 1, interval.end).join('\n');
            combinedContent += selectedLines + '\n';
        }
        
        return crypto.createHash(this.algo).update(combinedContent).digest('hex');
    }
}

export default new HashHelper();