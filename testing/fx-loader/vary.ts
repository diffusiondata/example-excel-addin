import fs from "fs/promises";
import path from "path";
import { argv, exit } from "process";

// @ts-ignore
import cliProgress from 'cli-progress';

const UTF8 = 'utf8';

class FieldMap extends Map<string, number> {
    public constructor(line: string) {
        super();
        line.trim().split(',').forEach((item, i) => this.set(item, i));
    }

    /**
     * Parse a CSV line into a Record.
     */
    public decompose(line: string): Record<string, string> {
        const fields = line.split(',');
        const result: Record<string, string> = {};

        for(const [fieldName, fieldPos] of this.entries()) {
            result[fieldName] = fields[fieldPos];
        }

        return result;
    }

    /**
     * Convert a Record into a CSV line.
     */
    public compose(record: Record<string, string>): string {
        const result = new Array(this.size).fill(undefined);
        for(const [fieldName, fieldPos] of this.entries()) {
            result[fieldPos] = record[fieldName];
        }
        return result.join(",");
    }

    getHeader(): string {
        const result = new Array(this.size).fill(undefined);
        for(const [fieldName, fieldPos] of this.entries()) {
            result[fieldPos] = fieldName;
        }
        return result.join(",");
    }
}

class PowerMap extends Map<string, number> {
    apply(inputObject: Record<string, string>): Record<string, string> {

        const result: Record<string, string> = {...inputObject};
        for(const [fieldName, pot] of this.entries()) {
            const fieldValue = parseFloat(inputObject[fieldName]);
            const delta = this.getDelta(pot);
            result[fieldName] = (fieldValue + delta).toString();
        }
        return result;
    }

    private getDelta(pot: number): number {
        return Math.round((Math.random() * 10) -5) * (10 ** pot);
    }

    constructor(lines: string[], fieldMap: FieldMap) {
        super();
        const records = lines.map(line => fieldMap.decompose(line));
    
        ["Ask", "Bid", "AskVolume", "BidVolume"].forEach((fieldName) => {
            const column = records.map(record => record[fieldName]);
            this.set(fieldName, PowerMap.findDominantPower(column));
        });
    }

    /**
     * @param numStr Get
     * @returns the lowest significant power of ten of numStr, e.g. given `0.01` returns -2, or `1000` returns +3
     */
    private static getPot(numStr: string) {
        const decimalPos = numStr.indexOf('.');
    
        if (decimalPos === -1) {
            const match = numStr.match(/0*$/);
            const trailingZeros = match ? match[0].length : 0;
            return trailingZeros;
        } else {
            // Find the position of the smallest significant digit after the decimal point
            const fractionalPart = numStr.slice(decimalPos + 1);
            return -(fractionalPart.length)
        }
    }

    private static findDominantPower(numberStrings: string[]) {
        // Build a map of the POT to count of instances
        const map = numberStrings.reduce((acc, numberStr) => {
            const pot = PowerMap.getPot(numberStr);
            return acc.set(pot, (acc.get(pot) || 0) + 1);
        }, new Map() as Map<number, number>);

        // Find the most frequent POT
        const highest = [...map.entries()].reduce((highest, current) => {
            return current[1] > highest[1] ? current : highest;
        });        
        return highest[0];
    }


}

async function main(args: string[]) {
    const outDir = args.shift()!;

    // Create the target directory, if necessary
    try {
        if (! await dirExists(outDir)) {
            await fs.mkdir(outDir, {recursive: true});
            console.log(`Created ${outDir}`);
        }
    } catch (err) {
        console.error(`Cannot create ${outDir}`, err);
    }

    const progressBar = new cliProgress.SingleBar({
        format: 'Varying |{bar}| {percentage}% || {value}/{total} Files',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
    }, cliProgress.Presets.shades_classic);
    progressBar.start(args.length, 0);
    
    for(const filename of args) {
        const lines = await loadLines(filename);
        const fieldMap = new FieldMap(lines.shift()!);
        const targetFile = `${outDir}/${path.basename(filename)}`;
        const powerMap = new PowerMap(lines, fieldMap);

        // Process the rows again, creating a copy where the values differ, as dictated by powerMap.
        varyFile(lines, fieldMap, powerMap, targetFile);

        progressBar.increment();
    }
    progressBar.stop();
}

async function varyFile(lines: string[], fieldMap: FieldMap, powerMap: PowerMap, targetFile: string) {
    const outputRows: string[] = [];
    for(const line of lines) {
        const inputObject = fieldMap.decompose(line);
        const outputObject = powerMap.apply(inputObject);
        outputRows.push(fieldMap.compose(outputObject));
    }

    // Write the line to the targetFile
    outputRows.unshift(fieldMap.getHeader());

    await fs.writeFile(targetFile, outputRows.join("\r\n"));
}

async function loadLines(filename: string): Promise<string []> {
    const data = await fs.readFile(filename, UTF8);
    return data.split(/\n/).map(line => line.trim());
}

async function dirExists(outDir: string): Promise<boolean> {
    try {
        const result = await fs.stat(outDir);
        return result.isDirectory();
    } catch {
        return false;
    }
}



const args = argv.slice(2);
if (args.length < 1) {
    console.error(`wrong # args`);
    exit(1);
}

main(args).catch(err => {
    console.error(`Unhandled error: `, err);
    console.dir(err);;
});

