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
        new rspack.DefinePlugin({
            "process.env.NODE_ENV": JSON.stringify("development"),
        })
    ],
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: "builtin:swc-loader",
                        options: {
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
                    // 我们的自定义 loader 在 swc-loader 之前运行
                    {
                        loader: path.resolve(__dirname, "../plugins/swc-add-source-plugin.js"),
                    }
                ],
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
            type: "persistent",
            buildDependencies: [
                __filename,
                path.resolve(__dirname, "../tsconfig.json"),
                path.resolve(__dirname, "../package.json"),
                path.resolve(__dirname, "../plugins/swc-add-source-plugin.js")
            ],
        },
    },
};
