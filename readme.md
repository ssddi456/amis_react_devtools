devtools for configuring amis schema rendering

# 背景

用于演示使用自定义的SchemaRenderer组件来将schema关联到source

# 使用方法

当前演示使用 click-to-react-component 的方式来打开编辑器中的配置文件。

win: alt + click / mac: option + click

将会在编辑器中打开对应的源码位置，若是 amis 生成的组件，则会打开对应的配置

或安装 react-devtools v5

1. ```npm run dev```

1. ```npx react-devtools```

1. 在React DevTools中，settings > components > open in editor url 选择vscode或者填上你自己的编辑器路径

1. 选中 amis 生成的组件，点击右上角的open in editor按钮，将会在编辑器中打开对应的配置文件

# 原理

1. 通过自定义loader, 将 source 信息注入到 schema 中

1. 使用自定义的SchemaRenderer组件，将 source 信息与 amis component 关联

1. 利用 react.development 模式，为fiber注入 __debugSource 的机制，使得在React DevTools中可以方便地查看到对应的source信息。

# 更进一步

1. 可以实现类似于 click-to-react-component 的功能，直接在页面上点击组件，即可在编辑器中打开对应的配置编辑界面, 
2. 可进一步实时编辑并预览schema，或表达式。
