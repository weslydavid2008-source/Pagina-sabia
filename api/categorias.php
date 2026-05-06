<?php
header("Content-Type: application/json; charset=utf-8");
require_once "conexion.php";

try {
    $sql = "
        SELECT 
            id_categoria,
            nombre,
            descripcion
        FROM Categorias
        ORDER BY nombre ASC
    ";

    $stmt = $pdo->query($sql);
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    exit;

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "ok" => false,
        "mensaje" => "Error al consultar categorías: " . $e->getMessage()
    ]);
    exit;
}