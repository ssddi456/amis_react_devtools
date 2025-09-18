import type { IDisposable } from 'monaco-sql-languages/esm/fillers/monaco-editor-core';


export class DisposableChain {
    private disposables: IDisposable[] = [];

    add(disposable: IDisposable) {
        this.disposables.push(disposable);
    }

    dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}
