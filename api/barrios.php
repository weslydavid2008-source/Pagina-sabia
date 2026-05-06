<?php
header("Content-Type: application/json; charset=utf-8");

require_once "conexion.php";

try {
    $sql = "
        SELECT 
            id_barrio,
            nombre
        FROM Barrios
        ORDER BY nombre ASC
    ";

    $stmt = $pdo->query($sql);
    $barrios = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($barrios);
    exit;

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "ok" => false,
        "mensaje" => "Error al consultar barrios: " . $e->getMessage()
    ]);
    exit;
}