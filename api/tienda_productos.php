<?php
header("Content-Type: application/json; charset=utf-8");

require_once "conexion.php";

try {
    $sql = "
        SELECT 
            p.id_producto,
            p.nombre,
            p.descripcion,
            p.id_categoria,
            c.nombre AS categoria,

            p.precio_venta AS precio_original,

            COALESCE(o.precio_oferta, p.precio_venta) AS precio_venta,
            o.precio_oferta,

            CASE
                WHEN o.id_oferta IS NOT NULL THEN 1
                ELSE 0
            END AS en_oferta,

            CASE
                WHEN o.id_oferta IS NOT NULL AND p.precio_venta > 0 THEN
                    ROUND(((p.precio_venta - o.precio_oferta) / p.precio_venta) * 100)
                ELSE 0
            END AS descuento_porcentaje,

            p.inventario,
            p.estado,
            p.destacado,
            p.imagen_url,

            o.id_oferta,
            o.fecha_inicio,
            o.fecha_fin,
            o.estado AS estado_oferta

        FROM Productos p

        LEFT JOIN Categorias c
            ON p.id_categoria = c.id_categoria

        LEFT JOIN Ofertas o
            ON o.id_producto = p.id_producto
            AND o.estado = 'activa'
            AND CURDATE() BETWEEN o.fecha_inicio AND o.fecha_fin

        WHERE p.estado = 'activo'
        AND p.inventario > 0

        ORDER BY p.destacado DESC, p.nombre ASC
    ";

    $stmt = $pdo->query($sql);
    $productos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($productos, JSON_UNESCAPED_UNICODE);
    exit;

} catch (PDOException $e) {
    http_response_code(500);

    echo json_encode([
        "ok" => false,
        "mensaje" => "Error al consultar productos de la tienda: " . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}