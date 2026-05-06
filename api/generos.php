<?php
header("Content-Type: application/json; charset=utf-8");

require_once "conexion.php";

try {
    $sql = "
        SELECT 
            id_genero,
            genero
        FROM Generos
        ORDER BY genero ASC
    ";

    $stmt = $pdo->query($sql);
    $generos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($generos);
    exit;

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "ok" => false,
        "mensaje" => "Error al consultar géneros: " . $e->getMessage()
    ]);
    exit;
}