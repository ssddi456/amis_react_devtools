import { Compiler, RspackPluginInstance } from "@rspack/core";

interface InternalOptions {
    assetHookStage: number;
}

interface ManifestPluginOptions {
    assetHookStage?: number;
}

const defaults: InternalOptions = {
    assetHookStage: Infinity
};

export class RspackAmisJsonLocPlugin implements RspackPluginInstance {
    private options: InternalOptions;
    constructor(opts: ManifestPluginOptions) {
        this.options = Object.assign({}, defaults, opts);
    }
    apply = (compiler: Compiler) => {

        const hookOptions = {
            name: 'RspackAmisJsonLocPlugin',
            stage: this.options.assetHookStage
        };

        compiler.hooks.run.tapAsync(hookOptions, () => {
            
        });
        compiler.hooks.watchRun.tapAsync(hookOptions, () => {

        });
    }

}
