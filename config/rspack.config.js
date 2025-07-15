const path = require("path");
const rspack = require("@rspack/core");
const NodePolyfill = require("node-polyfill-webpack-plugin");

/** @type {import('@rspack/cli').Configuration}  */
module.exports = {
    cache: true,
    entry: {
        index: "./demo/index.tsx",
    },
    target: "web",
    output: {
        path: path.resolve(__dirname, "../dist"),
        filename: "[name].js",
    },
    plugins: [
        new NodePolyfill(),
        new rspack.HtmlRspackPlugin({
            template: "demo/template/index.ejs",
        }),
    ],
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                exclude: /node_modules/,
                use: {
                    loader: "builtin:swc-loader",
                    options: {
                        sourceMap: true,
                        jsc: {
                            parser: {
                                syntax: "typescript",
                                tsx: true,
                            },
                            transform: {
                                react: {
                                    development: true,
                                    runtime: "automatic",
                                },
                            },
                        },
                    },
                },
            },
            {
                test: /\.css$/,
                type: "css/auto",
            },
        ],
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
        alias: {
            "react/jsx-dev-runtime": "react/jsx-dev-runtime.js",
            "react/jsx-runtime": "react/jsx-runtime.js",
        },
    },
    devServer: {
        hot: true,
        port: 3030,
    },
    experiments: {
        css: true,
        cache: {
            type: "filesystem",
            buildDependencies: {
                config: [
                    __filename,
                    path.resolve(__dirname, "../tsconfig.json"),
                    path.resolve(__dirname, "../package.json"),
                ],
            },
        },
    },
};
