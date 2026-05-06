<?php
header("Content-Type: application/json; charset=utf-8");

require_once "conexion.php";

try {
    $generosStmt = $pdo->query("
        SELECT 
            id_genero, 
            genero
        FROM Generos
        ORDER BY id_genero ASC
    ");

    $barriosStmt = $pdo->query("
        SELECT 
            id_barrio, 
            nombre
        FROM Barrios
        ORDER BY nombre ASC
    ");

    echo json_encode([
        "ok" => true,
        "generos" => $generosStmt->fetchAll(PDO::FETCH_ASSOC),
        "barrios" => $barriosStmt->fetchAll(PDO::FETCH_ASSOC)
    ]);
    exit;

} catch (PDOException $e) {
    http_response_code(500);

    echo json_encode([
        "ok" => false,
        "mensaje" => "Error al cargar opciones: " . $e->getMessage()
    ]);
    exit;
}