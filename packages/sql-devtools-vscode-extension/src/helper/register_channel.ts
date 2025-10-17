import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

function registerChannel() {
    const logPath = path.join(__dirname, './sql-devtools-vscode-extension.log');
    console.log(logPath);
    if (!fs.existsSync(logPath)) {
        fs.writeFileSync(logPath, '');
    }
    const channel = fs.createWriteStream(logPath, {
        flags: 'a',
        "autoClose": true,
        "encoding": "utf-8",
    });
    const groupIds: string[] = [];
    Object.defineProperties(console, {
        log: {
            value: (...args: any[]) => {
                const lastId = groupIds[groupIds.length - 1];
                if (lastId) {
                    channel.write(`[${lastId}] ` + args.map(a => (typeof a === 'string' ? a : util.inspect(a))).join(' ') + '\n');
                    return;
                }
                channel.write(args.map(a => (typeof a === 'string' ? a : util.inspect(a))).join(' ') + '\n');
            },
            writable: true,
            configurable: true
        },
    
        error: {
            value: (...args: any[]) => {
                const lastId = groupIds[groupIds.length - 1];
                if (lastId) {
                    channel.write(`[${lastId}] ` + args.map(a => (typeof a === 'string' ? a : util.inspect(a))).join(' ') + '\n');
                    return;
                }
                channel.write(args.map(a => (typeof a === 'string' ? a : util.inspect(a))).join(' ') + '\n');
            },
            writable: true,
            configurable: true
        },
        group: {
            value: (id: string) => {
                channel.write('Group start: ' +  id + '\n');
                groupIds.push(id);
            },
            writable: true,
            configurable: true
        },
        groupEnd: {
            value: () => {
                const id = groupIds.pop();
                channel.write('Group end: ' + id + '\n');
            },
            writable: true,
            configurable: true
        },
    });
}

// @ts-ignore
if (process.env['PACK_EXTENSION'] != 1) {
    registerChannel();
}