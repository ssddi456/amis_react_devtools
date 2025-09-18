1. get definition
    [ ] database
    [*] table
    [*] table alias
    [*] column
    [ ] column alias
    [ ] star column
    [ ] function
    
1. validate
    [*] check definition
    [*] group by
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
    
1. ui:an free to use sql development helper & usage example
    [ ] sql editor view
        [ ] monaco editor with hive sql ls
    [ ] helper view
        [ ] symbol table tab
            [ ] cte/select
            [ ] column
            [ ] forerign table
        [ ] cte graph tab

1. table graph
    [ ] get table graph from sql
    [*] visualize table relationships

1. cases
    [ ] more cases
        [*] union
        [*] intersect
        [ ] except
        [*] subquery in from
        [ ] subquery in where
        [ ] subquery in select
        [*] cte recursive
        [ ] window function
        [ ] over(partition by ...)
        [*] join on ...
        [*] join using ...
        [ ] join natural
        [ ] lateral join
        [*] insert into ... select ...
    [ ] expected result

# 更好的测试方法

* 在需要调试的地方添加断言 or debugger
* logWithSouce
