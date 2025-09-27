## functions

1. get definition
    [ ] database
    [*] table
    [*] table alias
    [*] column
    [ ] column alias
    [ ] star column
    [ ] function
    [ ] comments

1. completion
    [ ] table
    [ ] table alias
    [ ] column

1. validate
    [*] check definition
    [*] group by
        [ ] with distinct
    [*] using
    [ ] join on scope
    [*] duplicate column alias
    [*] duplicate table alias

1. get references
    [*] get table references
    [*] get direct column references
    [ ] get column references in expression references

1. performance
    [*] remove log
    [ ] validate performance

1. project layout
    [*] reorganize project layout
    [*] split as a monorepo
    
1. webui:an free to use sql development helper & usage example
    [*] sql editor view
        [*] monaco editor with hive sql ls
    [ ] helper view
        [+] symbol table tab
            [*] cte/select
            [ ] column
            [*] foreign table
        [*] cte graph tab
        [ ] config tab
    [ ] layout dragable splitter

1. vscode extension
    [ ] basic extension
    [ ] package as vscode extension
    [ ] publish to marketplace
    [ ] custom actions
        [ ] show table graph
        [ ] show symbol table
        [ ] copy test sql to clipboard

1. table graph
    [*] get table graph from sql
    [*] visualize table relationships

1. cases
    [ ] more cases
        [*] union
        [*] intersect
        [ ] orderby
        [ ] sortby
        [ ] except
        [*] subquery in from
        [*] subquery in where
        [ ] subquery in select
        [*] cte recursive
        [*] window function
        [*] over(partition by ...)
        [*] join on ...
        [*] join using ...
        [ ] join natural
        [ ] lateral join
        [*] insert into ... select ...
    [ ] expected result

## showcase

[*] github pages

## 更好的测试方法

* 在需要调试的地方添加断言 or debugger
* logWithSource
