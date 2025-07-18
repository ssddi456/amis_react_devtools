// SWC 插件：为包含 type 字段的对象添加 __source 属性
// 这是一个自定义的 rspack loader
const ts = require('typescript');

module.exports = function (source) {
    const callback = this.async();
    const resourcePath = this.resourcePath.replace(/\\/g, '/'); // 处理 Windows 路径

    try {
        // 使用 TypeScript 编译器 API 解析源代码
        const sourceFile = ts.createSourceFile(
            resourcePath,
            source,
            ts.ScriptTarget.Latest,
            true
        );

        let result = source;
        const transformations = [];

        // 遍历 AST 查找包含 type 属性的对象字面量
        function visitNode(node) {
            if (ts.isObjectLiteralExpression(node)) {
                // 检查是否包含 type 属性
                const hasTypeProperty = node.properties.some(prop =>
                    ts.isPropertyAssignment(prop) && (
                        (
                            ts.isIdentifier(prop.name) &&
                            prop.name.text === 'type'
                        )
                        || (
                            ts.isStringLiteral(prop.name) &&
                            prop.name.text === 'type'
                        )
                    )
                );

                // 检查是否已经包含 __source 属性
                const hasSourceProperty = node.properties.some(prop =>
                    ts.isPropertyAssignment(prop) &&
                    ts.isIdentifier(prop.name) &&
                    prop.name.text === '__source'
                );

                if (hasTypeProperty && !hasSourceProperty) {
                    // 获取位置信息
                    const position = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
                    const lineNumber = position.line + 1;
                    const columnNumber = position.character + 1;

                    // 查找插入位置（最后一个属性后面或右大括号前面）
                    let insertPosition;
                    let needsComma = false;

                    if (node.properties.length > 0) {
                        const lastProperty = node.properties[node.properties.length - 1];
                        insertPosition = lastProperty.getEnd();
                        needsComma = true;
                    } else {
                        insertPosition = node.getStart() + 1; // 在 { 后面
                    }

                    const sourceInfo = [needsComma ? ',' : '',
                        '__source: {',
                    `fileName: "${resourcePath}",`,
                    `lineNumber: ${lineNumber},`,
                    `columnNumber: ${columnNumber}`,
                        '}'].join('')

                    transformations.push({
                        position: insertPosition,
                        insertion: sourceInfo
                    });
                }
            }

            ts.forEachChild(node, visitNode);
        }

        visitNode(sourceFile);

        // 按位置倒序排序，从后往前插入，避免位置偏移
        transformations.sort((a, b) => b.position - a.position);

        // 应用所有转换
        for (const transformation of transformations) {
            result = result.substring(0, transformation.position) +
                transformation.insertion +
                result.substring(transformation.position);
        }

        // console.log('result:', result);
        callback(null, result);
    } catch (error) {
        callback(error);
    }
};

module.exports.raw = false;
