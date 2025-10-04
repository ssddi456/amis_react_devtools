const path = require('path');

/** @type {import('@rspack/core').Configuration} */
module.exports = {
    entry: './src/extension.ts',
    mode: 'development',
    output: {
        path: path.resolve(__dirname, '../dist'),
        filename: 'extension.js',
        libraryTarget: 'commonjs2',
    },
    target: 'node',
    resolve: {
        extensions: ['.ts', '.js'],
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: [/node_modules/, /\.css$/],
                loader: "builtin:swc-loader",
                type: 'javascript/auto',
                options: {
                    jsc: {
                        parser: {
                            syntax: "typescript",
                            tsx: false,
                        },
                    },
                },
            }
        ],
    },
    externals: {
        vscode: 'commonjs vscode',
    },
    devtool: 'source-map',
    experiments: {
        css: true,
    },
};
