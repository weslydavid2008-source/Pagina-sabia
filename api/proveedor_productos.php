<?php
header("Content-Type: application/json; charset=utf-8");
require_once "conexion.php";

$idProveedor = $_GET["id_proveedor"] ?? null;

if (!$idProveedor) {
    echo json_encode([]);
    exit;
}

try {
    $sql = "
        SELECT 
            pp.id_prov_prod,
            pp.id_proveedor,
            pp.id_producto,
            pp.precio_proveedor,
            p.nombre AS producto,
            p.inventario,
            p.id_categoria
        FROM ProveedorProductos pp
        INNER JOIN Productos p 
            ON pp.id_producto = p.id_producto
        WHERE pp.id_proveedor = :id_proveedor
        ORDER BY p.nombre ASC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ":id_proveedor" => $idProveedor
    ]);

    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    exit;

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "ok" => false,
        "mensaje" => "Error al consultar productos del proveedor: " . $e->getMessage()
    ]);
    exit;
}