import { AtomSelectStatementContext, SelectStatementContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import type { ContextManager } from "../context_manager";

export function mrScopeGraphOptimize(contextManager: ContextManager, rootId: string) {
    // Cycle detection using DFS
    const visited = new Set<string>();
    const mrScopeGraph = contextManager.mrScopeGraph;
    let graphRoot = mrScopeGraph.get(rootId);
    if (!graphRoot) {
        return;
    }
    const toVisit = [rootId];
    while (toVisit.length) {
        const id = toVisit.pop()!;
        const node = mrScopeGraph.get(id);
        if (!node) {
            continue;
        }
        const mrScope = contextManager.getMrScopeById(id);
        if (!mrScope) {
            toVisit.push(...node.deps.filter(dep => !visited.has(dep)));
            continue;
        }

        if (mrScope.context instanceof AtomSelectStatementContext) {
            toVisit.push(...node.deps.filter(dep => !visited.has(dep)));
            continue;
        }

        // do simplification, hide the single deped node which is atom select statement or select statement
        // by pass it and connect to its deps directly
        // this is because atom select statement only pass through columns, can be simplified
        // and select statement may have multiple deps, but in most cases it is just one, so we do the same simplification
        // to reduce the node count
        const deps = node.deps;
        if (deps.length === 1) {
            const depedScope = contextManager.getMrScopeById(deps[0]);
            if (depedScope && (
                depedScope.context instanceof AtomSelectStatementContext
                || depedScope.context instanceof SelectStatementContext
            )) {
                const depedNode = mrScopeGraph.get(depedScope.id);
                if (depedNode) {
                    node.deps = depedNode.deps;
                    // atom select statement only pass through columns, can be simplified
                    mrScopeGraph.set(id, {
                        ...node,
                    });
                    mrScopeGraph.delete(deps[0]);
                    if (!visited.has(id)) {
                        toVisit.push(id);
                    }
                    continue;
                }
            }
        }
        toVisit.push(...node.deps.filter(dep => !visited.has(dep)));
    }
}
