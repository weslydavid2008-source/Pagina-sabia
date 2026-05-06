<?php
header("Content-Type: application/json; charset=utf-8");

require_once "conexion.php";

$range = $_GET["range"] ?? "7";

try {
    $dateFilter = getDateFilter($range);

    $summary = getSummary($pdo, $dateFilter);
    $dailySales = getDailySales($pdo, $dateFilter);
    $statusCounts = getStatusCounts($pdo, $dateFilter);
    $monthlyTrend = getMonthlyTrend($pdo);
    $topProducts = getTopProducts($pdo, $dateFilter);
    $sidebar = getSidebarCounts($pdo);

    responder([
        "ok" => true,
        "range" => $range,
        "summary" => $summary,
        "daily_sales" => $dailySales,
        "status_counts" => $statusCounts,
        "monthly_trend" => $monthlyTrend,
        "top_products" => $topProducts,
        "sidebar" => $sidebar
    ]);

} catch (Throwable $error) {
    responder([
        "ok" => false,
        "mensaje" => "Error al cargar estadísticas: " . $error->getMessage()
    ], 500);
}

function getDateFilter($range) {
    $range = strtolower(trim((string) $range));

    if ($range === "all") {
        return "";
    }

    if ($range === "30") {
        return "v.fecha_venta >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)";
    }

    if ($range === "month") {
        return "v.fecha_venta >= DATE_FORMAT(CURDATE(), '%Y-%m-01')";
    }

    if ($range === "year") {
        return "YEAR(v.fecha_venta) = YEAR(CURDATE())";
    }

    return "v.fecha_venta >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)";
}

function buildWhere($filters) {
    $filters = array_values(array_filter($filters));

    if (count($filters) === 0) {
        return "";
    }

    return "WHERE " . implode(" AND ", $filters);
}

function getSummary($pdo, $dateFilter) {
    $where = buildWhere([
        "d.estado = 'entregado'",
        $dateFilter
    ]);

    $stmt = $pdo->prepare("
        SELECT
            COALESCE(SUM(v.pago_total), 0) AS ventas_totales,
            COUNT(v.id_venta) AS pedidos_totales,
            COUNT(DISTINCT v.id_cliente) AS clientes_activos
        FROM Ventas v
        INNER JOIN Domicilios d
            ON d.id_domicilio = v.id_domicilio
        $where
    ");

    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    $ventasTotales = (float) ($row["ventas_totales"] ?? 0);
    $pedidosTotales = (int) ($row["pedidos_totales"] ?? 0);

    return [
        "ventas_totales" => $ventasTotales,
        "pedidos_totales" => $pedidosTotales,
        "ticket_promedio" => $pedidosTotales > 0 ? $ventasTotales / $pedidosTotales : 0,
        "clientes_activos" => (int) ($row["clientes_activos"] ?? 0)
    ];
}

function getDailySales($pdo, $dateFilter) {
    $where = buildWhere([
        "d.estado = 'entregado'",
        $dateFilter
    ]);

    $stmt = $pdo->prepare("
        SELECT
            DATE(v.fecha_venta) AS fecha,
            COALESCE(SUM(v.pago_total), 0) AS total
        FROM Ventas v
        INNER JOIN Domicilios d
            ON d.id_domicilio = v.id_domicilio
        $where
        GROUP BY DATE(v.fecha_venta)
        ORDER BY fecha ASC
    ");

    $stmt->execute();

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function getStatusCounts($pdo, $dateFilter) {
    $where = buildWhere([
        $dateFilter
    ]);

    $stmt = $pdo->prepare("
        SELECT
            d.estado,
            COUNT(v.id_venta) AS total
        FROM Ventas v
        INNER JOIN Domicilios d
            ON d.id_domicilio = v.id_domicilio
        $where
        GROUP BY d.estado
    ");

    $stmt->execute();

    $base = [
        "pendiente" => 0,
        "en_camino" => 0,
        "entregado" => 0,
        "cancelado" => 0
    ];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $estado = $row["estado"] ?? "pendiente";

        if (array_key_exists($estado, $base)) {
            $base[$estado] = (int) $row["total"];
        }
    }

    return $base;
}

function getMonthlyTrend($pdo) {
    $stmt = $pdo->prepare("
        SELECT
            MONTH(v.fecha_venta) AS mes,
            COALESCE(SUM(v.pago_total), 0) AS total
        FROM Ventas v
        INNER JOIN Domicilios d
            ON d.id_domicilio = v.id_domicilio
        WHERE YEAR(v.fecha_venta) = YEAR(CURDATE())
          AND d.estado = 'entregado'
        GROUP BY MONTH(v.fecha_venta)
        ORDER BY mes ASC
    ");

    $stmt->execute();

    $months = [
        1 => ["label" => "Ene", "total" => 0],
        2 => ["label" => "Feb", "total" => 0],
        3 => ["label" => "Mar", "total" => 0],
        4 => ["label" => "Abr", "total" => 0],
        5 => ["label" => "May", "total" => 0],
        6 => ["label" => "Jun", "total" => 0],
        7 => ["label" => "Jul", "total" => 0],
        8 => ["label" => "Ago", "total" => 0],
        9 => ["label" => "Sep", "total" => 0],
        10 => ["label" => "Oct", "total" => 0],
        11 => ["label" => "Nov", "total" => 0],
        12 => ["label" => "Dic", "total" => 0]
    ];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $monthNumber = (int) $row["mes"];

        if (isset($months[$monthNumber])) {
            $months[$monthNumber]["total"] = (float) $row["total"];
        }
    }

    $currentMonth = (int) date("n");
    $result = [];

    for ($i = 1; $i <= $currentMonth; $i++) {
        $result[] = $months[$i];
    }

    return $result;
}

function getTopProducts($pdo, $dateFilter) {
    $where = buildWhere([
        "d.estado = 'entregado'",
        $dateFilter
    ]);

    $stmt = $pdo->prepare("
        SELECT
            p.id_producto,
            p.nombre,
            SUM(dv.cantidad) AS cantidad_vendida,
            SUM(
                CASE
                    WHEN dv.subtotal IS NOT NULL AND dv.subtotal > 0 THEN dv.subtotal
                    ELSE dv.cantidad * dv.precio_venta
                END
            ) AS total_vendido
        FROM DetalleVenta dv
        INNER JOIN Ventas v
            ON v.id_venta = dv.id_venta
        INNER JOIN Domicilios d
            ON d.id_domicilio = v.id_domicilio
        INNER JOIN Productos p
            ON p.id_producto = dv.id_producto
        $where
        GROUP BY p.id_producto, p.nombre
        ORDER BY cantidad_vendida DESC
        LIMIT 5
    ");

    $stmt->execute();

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function getSidebarCounts($pdo) {
    $orders = $pdo->query("SELECT COUNT(*) FROM Ventas")->fetchColumn();
    $clients = $pdo->query("SELECT COUNT(*) FROM Clientes")->fetchColumn();

    return [
        "pedidos" => (int) $orders,
        "clientes" => (int) $clients
    ];
}

function responder($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
