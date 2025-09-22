import { ITableSourceManager, TableInfo } from "@amis-devtools/sql-language-service/src/types";

// SQL test collection for function showcase
export const sqlTest: { sql: string; name: string; }[] = [
    {
        name: "Basic SELECT with WHERE",
        sql: `SELECT id, name, email, created_at
FROM users 
WHERE status = 'active' 
  AND created_at > '2023-01-01'
ORDER BY created_at DESC
LIMIT 100;`
    },
    {
        name: "Basic SELECT with WHERE 1",
        sql: `SELECT id, name, email, created_at as alt_created_at
FROM users 
WHERE status = 'active' 
  AND created_at > '2023-01-01'
ORDER BY alt_created_at DESC
LIMIT 100;`
    },
    {
        name: "JOIN Operations",
        sql: `SELECT 
    u.id,
    u.name,
    u.email,
    p.title as profile_title,
    d.department_name
FROM users u
LEFT JOIN user_profiles p ON u.id = p.user_id
INNER JOIN departments d ON u.department_id = d.id
WHERE u.status = 'active'
  AND d.is_active = true;`
    },
    {
        name: "Aggregate Functions & GROUP BY",
        sql: `SELECT 
    department_id,
    COUNT(*) as total_users,
    AVG(salary) as avg_salary,
    MAX(salary) as max_salary,
    MIN(salary) as min_salary,
    SUM(salary) as total_salary
FROM employees
WHERE hire_date >= '2020-01-01'
GROUP BY department_id
HAVING COUNT(*) > 5
ORDER BY avg_salary DESC;`
    },
    {
        name: "Common Table Expressions (CTE)",
        sql: `WITH recent_orders AS (
    SELECT 
        customer_id,
        order_date,
        total_amount,
        ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) as rn
    FROM orders
    WHERE order_date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
),
customer_stats AS (
    SELECT 
        customer_id,
        COUNT(*) as order_count,
        SUM(total_amount) as total_spent
    FROM recent_orders
    GROUP BY customer_id
)
SELECT 
    c.customer_name,
    cs.order_count,
    cs.total_spent,
    ro.order_date as last_order_date
FROM customers c
JOIN customer_stats cs ON c.id = cs.customer_id
JOIN recent_orders ro ON cs.customer_id = ro.customer_id AND ro.rn = 1
ORDER BY cs.total_spent DESC;`
    },
    {
        name: "Window Functions",
        sql: `SELECT 
    employee_id,
    first_name,
    last_name,
    department_id,
    salary,
    AVG(salary) OVER (PARTITION BY department_id) as dept_avg_salary,
    ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY salary DESC) as salary_rank,
    LAG(salary) OVER (ORDER BY employee_id) as prev_employee_salary,
    SUM(salary) OVER (ORDER BY employee_id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as running_total
FROM employees
WHERE status = 'active'
ORDER BY department_id, salary DESC;`
    },
    {
        name: "Subqueries and EXISTS",
        sql: `SELECT 
    p.product_id,
    p.product_name,
    p.price,
    p.category_id
FROM products p
WHERE p.price > (
    SELECT AVG(price) 
    FROM products 
    WHERE category_id = p.category_id
)
AND EXISTS (
    SELECT 1 
    FROM order_items oi 
    WHERE oi.product_id = p.product_id 
      AND oi.created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 90 DAY)
)
ORDER BY p.price DESC;`
    },
    {
        name: "CASE Statements & String Functions",
        sql: `SELECT 
    user_id,
    UPPER(first_name) as first_name_upper,
    LOWER(last_name) as last_name_lower,
    CONCAT(first_name, ' ', last_name) as full_name,
    LENGTH(email) as email_length,
    CASE 
        WHEN age < 18 THEN 'Minor'
        WHEN age BETWEEN 18 AND 64 THEN 'Adult'
        ELSE 'Senior'
    END as age_category,
    CASE 
        WHEN last_login_date >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY) THEN 'Active'
        WHEN last_login_date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY) THEN 'Inactive'
        ELSE 'Dormant'
    END as user_status
FROM users
WHERE email IS NOT NULL
ORDER BY last_login_date DESC;`
    },
    {
        name: "Date Functions & Formatting",
        sql: `SELECT 
    order_id,
    customer_id,
    order_date,
    YEAR(order_date) as order_year,
    MONTH(order_date) as order_month,
    DAYOFWEEK(order_date) as day_of_week,
    DATE_FORMAT(order_date, '%Y-%m') as year_month,
    DATEDIFF(CURRENT_DATE, order_date) as days_since_order,
    DATE_ADD(order_date, INTERVAL 30 DAY) as estimated_delivery,
    QUARTER(order_date) as order_quarter
FROM orders
WHERE order_date >= '2023-01-01'
  AND order_date < '2024-01-01'
ORDER BY order_date DESC;`
    },
    {
        name: "Complex Multi-CTE with Analytics",
        sql: `WITH monthly_sales AS (
    SELECT 
        DATE_FORMAT(order_date, '%Y-%m') as month,
        SUM(total_amount) as monthly_revenue,
        COUNT(DISTINCT customer_id) as unique_customers,
        COUNT(*) as total_orders
    FROM orders
    WHERE order_date >= DATE_SUB(CURRENT_DATE, INTERVAL 12 MONTH)
    GROUP BY DATE_FORMAT(order_date, '%Y-%m')
),
sales_growth AS (
    SELECT 
        month,
        monthly_revenue,
        unique_customers,
        total_orders,
        LAG(monthly_revenue) OVER (ORDER BY month) as prev_month_revenue,
        (monthly_revenue - LAG(monthly_revenue) OVER (ORDER BY month)) / 
        LAG(monthly_revenue) OVER (ORDER BY month) * 100 as revenue_growth_pct
    FROM monthly_sales
),
customer_segments AS (
    SELECT 
        customer_id,
        SUM(total_amount) as total_spent,
        COUNT(*) as total_orders,
        CASE 
            WHEN SUM(total_amount) >= 10000 THEN 'VIP'
            WHEN SUM(total_amount) >= 1000 THEN 'Premium'
            ELSE 'Standard'
        END as customer_segment
    FROM orders
    WHERE order_date >= DATE_SUB(CURRENT_DATE, INTERVAL 12 MONTH)
    GROUP BY customer_id
)
SELECT 
    sg.month,
    sg.monthly_revenue,
    sg.unique_customers,
    sg.total_orders,
    ROUND(sg.revenue_growth_pct, 2) as revenue_growth_percentage,
    COUNT(CASE WHEN cs.customer_segment = 'VIP' THEN 1 END) as vip_customers,
    COUNT(CASE WHEN cs.customer_segment = 'Premium' THEN 1 END) as premium_customers,
    COUNT(CASE WHEN cs.customer_segment = 'Standard' THEN 1 END) as standard_customers
FROM sales_growth sg
LEFT JOIN orders o ON DATE_FORMAT(o.order_date, '%Y-%m') = sg.month
LEFT JOIN customer_segments cs ON o.customer_id = cs.customer_id
GROUP BY sg.month, sg.monthly_revenue, sg.unique_customers, sg.total_orders, sg.revenue_growth_pct
ORDER BY sg.month DESC;`
    },
    {
        show: false,
        name: "Recursive CTE (Hierarchical Data)",
        sql: `WITH RECURSIVE employee_hierarchy AS (
    -- Base case: top-level managers
    SELECT 
        employee_id,
        first_name,
        last_name,
        manager_id,
        job_title,
        0 as level,
        CAST(first_name + ' ' + last_name AS VARCHAR(1000)) as path
    FROM employees
    WHERE manager_id IS NULL
    
    UNION ALL
    
    -- Recursive case: employees with managers
    SELECT 
        e.employee_id,
        e.first_name,
        e.last_name,
        e.manager_id,
        e.job_title,
        eh.level + 1,
        CAST(eh.path + ' -> ' + e.first_name + ' ' + e.last_name AS VARCHAR(1000))
    FROM employees e
    INNER JOIN employee_hierarchy eh ON e.manager_id = eh.employee_id
    WHERE eh.level < 10  -- Prevent infinite recursion
)
SELECT 
    employee_id,
    REPEAT('  ', level) + first_name + ' ' + last_name as indented_name,
    job_title,
    level,
    path as hierarchy_path
FROM employee_hierarchy
ORDER BY level, first_name;`
    }
].filter(example => example.show !== false);

const tableInfos: Record<string, TableInfo> = {
    users: {
        db_name: "example",
        table_name: "users",
        table_id: 1,
        description: "User information table",
        column_list: [
            { column_name: "id", data_type_string: "bigint", description: "User ID" },
            { column_name: "name", data_type_string: "string", description: "User name" },
            { column_name: "email", data_type_string: "string", description: "User email address" },
            { column_name: "created_at", data_type_string: "timestamp", description: "Account creation time" },
            { column_name: "status", data_type_string: "string", description: "User status (active/inactive)" },
            { column_name: "department_id", data_type_string: "bigint", description: "Department ID" },
            { column_name: "first_name", data_type_string: "string", description: "First name" },
            { column_name: "last_name", data_type_string: "string", description: "Last name" },
            { column_name: "age", data_type_string: "int", description: "User age" },
            { column_name: "last_login_date", data_type_string: "timestamp", description: "Last login time" },
            { column_name: "user_id", data_type_string: "bigint", description: "User identifier" }
        ]
    },
    user_profiles: {
        db_name: "example",
        table_name: "user_profiles", 
        table_id: 2,
        description: "User profile information",
        column_list: [
            { column_name: "user_id", data_type_string: "bigint", description: "User ID" },
            { column_name: "title", data_type_string: "string", description: "Profile title" }
        ]
    },
    departments: {
        db_name: "example",
        table_name: "departments",
        table_id: 3,
        description: "Department information",
        column_list: [
            { column_name: "id", data_type_string: "bigint", description: "Department ID" },
            { column_name: "department_name", data_type_string: "string", description: "Department name" },
            { column_name: "is_active", data_type_string: "boolean", description: "Whether department is active" }
        ]
    },
    employees: {
        db_name: "example",
        table_name: "employees",
        table_id: 4,
        description: "Employee information",
        column_list: [
            { column_name: "employee_id", data_type_string: "bigint", description: "Employee ID" },
            { column_name: "first_name", data_type_string: "string", description: "First name" },
            { column_name: "last_name", data_type_string: "string", description: "Last name" },
            { column_name: "department_id", data_type_string: "bigint", description: "Department ID" },
            { column_name: "salary", data_type_string: "decimal", description: "Employee salary" },
            { column_name: "hire_date", data_type_string: "date", description: "Hire date" },
            { column_name: "status", data_type_string: "string", description: "Employee status" },
            { column_name: "manager_id", data_type_string: "bigint", description: "Manager employee ID" },
            { column_name: "job_title", data_type_string: "string", description: "Job title" }
        ]
    },
    orders: {
        db_name: "example",
        table_name: "orders",
        table_id: 5,
        description: "Order information",
        column_list: [
            { column_name: "order_id", data_type_string: "bigint", description: "Order ID" },
            { column_name: "customer_id", data_type_string: "bigint", description: "Customer ID" },
            { column_name: "order_date", data_type_string: "date", description: "Order date" },
            { column_name: "total_amount", data_type_string: "decimal", description: "Total order amount" }
        ]
    },
    customers: {
        db_name: "example",
        table_name: "customers",
        table_id: 6,
        description: "Customer information",
        column_list: [
            { column_name: "id", data_type_string: "bigint", description: "Customer ID" },
            { column_name: "customer_name", data_type_string: "string", description: "Customer name" }
        ]
    },
    products: {
        db_name: "example",
        table_name: "products",
        table_id: 7,
        description: "Product information",
        column_list: [
            { column_name: "product_id", data_type_string: "bigint", description: "Product ID" },
            { column_name: "product_name", data_type_string: "string", description: "Product name" },
            { column_name: "price", data_type_string: "decimal", description: "Product price" },
            { column_name: "category_id", data_type_string: "bigint", description: "Category ID" }
        ]
    },
    order_items: {
        db_name: "example",
        table_name: "order_items",
        table_id: 8,
        description: "Order item details",
        column_list: [
            { column_name: "product_id", data_type_string: "bigint", description: "Product ID" },
            { column_name: "created_at", data_type_string: "timestamp", description: "Creation time" }
        ]
    }
}

export const tableSource: ITableSourceManager = {
    getTableInfoByName: (tableName: string, dbName: string | undefined): TableInfo | null => {
        // Try to find table by exact name first
        if (tableInfos[tableName]) {
            return tableInfos[tableName];
        }
        
        // If dbName is provided, try to find by db.table format
        if (dbName) {
            const fullTableName = `${dbName}.${tableName}`;
            if (tableInfos[fullTableName]) {
                return tableInfos[fullTableName];
            }
        }
        
        // Try to find by partial match (case insensitive)
        const lowerTableName = tableName.toLowerCase();
        for (const [key, tableInfo] of Object.entries(tableInfos)) {
            if (key.toLowerCase() === lowerTableName || 
                tableInfo.table_name.toLowerCase() === lowerTableName) {
                return tableInfo;
            }
        }
        
        return null;
    }
}