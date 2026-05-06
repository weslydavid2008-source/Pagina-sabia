<?php
header("Content-Type: application/json; charset=utf-8");

require_once "conexion.php";

$metodo = $_SERVER["REQUEST_METHOD"];

if ($metodo === "GET") {
    try {
        $sql = "
            SELECT
                cl.id_cliente,
                cl.nombre,
                cl.apellido,
                cl.documento,
                cl.correo,
                cl.direccion,
                cl.id_genero,
                cl.id_barrio,
                cl.telefono,
                cl.fecha_registro,
                g.genero,
                b.nombre AS barrio,

                SUM(
                    CASE
                        WHEN d.estado = 'entregado' THEN 1
                        ELSE 0
                    END
                ) AS total_pedidos,

                COALESCE(SUM(
                    CASE
                        WHEN d.estado = 'entregado' THEN v.pago_total
                        ELSE 0
                    END
                ), 0) AS total_gastado

            FROM Clientes cl
            LEFT JOIN Generos g
                ON cl.id_genero = g.id_genero
            LEFT JOIN Barrios b
                ON cl.id_barrio = b.id_barrio
            LEFT JOIN Ventas v
                ON cl.id_cliente = v.id_cliente
            LEFT JOIN Domicilios d
                ON d.id_domicilio = v.id_domicilio
            GROUP BY
                cl.id_cliente,
                cl.nombre,
                cl.apellido,
                cl.documento,
                cl.correo,
                cl.direccion,
                cl.id_genero,
                cl.id_barrio,
                cl.telefono,
                cl.fecha_registro,
                g.genero,
                b.nombre
            ORDER BY cl.id_cliente DESC
        ";

        $stmt = $pdo->query($sql);
        $clientes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($clientes, JSON_UNESCAPED_UNICODE);
        exit;

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            "ok" => false,
            "mensaje" => "Error al consultar clientes: " . $e->getMessage()
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

if ($metodo === "POST") {
    try {
        $data = json_decode(file_get_contents("php://input"), true);

        if (!$data) {
            echo json_encode([
                "ok" => false,
                "mensaje" => "No se recibieron datos válidos"
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if (empty($data["nombre"])) {
            echo json_encode([
                "ok" => false,
                "mensaje" => "El nombre del cliente es obligatorio"
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $sql = "
            INSERT INTO Clientes
            (
                nombre,
                apellido,
                documento,
                correo,
                direccion,
                id_genero,
                id_barrio,
                telefono
            )
            VALUES
            (
                :nombre,
                :apellido,
                :documento,
                :correo,
                :direccion,
                :id_genero,
                :id_barrio,
                :telefono
            )
        ";

        $stmt = $pdo->prepare($sql);

        $stmt->execute([
            ":nombre" => $data["nombre"],
            ":apellido" => $data["apellido"] ?? null,
            ":documento" => $data["documento"] ?? null,
            ":correo" => $data["correo"] ?? null,
            ":direccion" => $data["direccion"] ?? null,
            ":id_genero" => $data["id_genero"] ?? null,
            ":id_barrio" => $data["id_barrio"] ?? null,
            ":telefono" => $data["telefono"] ?? null
        ]);

        echo json_encode([
            "ok" => true,
            "mensaje" => "Cliente creado correctamente"
        ], JSON_UNESCAPED_UNICODE);
        exit;

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            "ok" => false,
            "mensaje" => "Error al crear cliente: " . $e->getMessage()
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

if ($metodo === "PUT") {
    try {
        $data = json_decode(file_get_contents("php://input"), true);

        if (!$data) {
            echo json_encode([
                "ok" => false,
                "mensaje" => "No se recibieron datos válidos"
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if (empty($data["id_cliente"])) {
            echo json_encode([
                "ok" => false,
                "mensaje" => "No se recibió el ID del cliente"
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if (empty($data["nombre"])) {
            echo json_encode([
                "ok" => false,
                "mensaje" => "El nombre del cliente es obligatorio"
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $sql = "
            UPDATE Clientes SET
                nombre = :nombre,
                apellido = :apellido,
                documento = :documento,
                correo = :correo,
                direccion = :direccion,
                id_genero = :id_genero,
                id_barrio = :id_barrio,
                telefono = :telefono
            WHERE id_cliente = :id_cliente
        ";

        $stmt = $pdo->prepare($sql);

        $stmt->execute([
            ":id_cliente" => $data["id_cliente"],
            ":nombre" => $data["nombre"],
            ":apellido" => $data["apellido"] ?? null,
            ":documento" => $data["documento"] ?? null,
            ":correo" => $data["correo"] ?? null,
            ":direccion" => $data["direccion"] ?? null,
            ":id_genero" => $data["id_genero"] ?? null,
            ":id_barrio" => $data["id_barrio"] ?? null,
            ":telefono" => $data["telefono"] ?? null
        ]);

        echo json_encode([
            "ok" => true,
            "mensaje" => "Cliente actualizado correctamente"
        ], JSON_UNESCAPED_UNICODE);
        exit;

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            "ok" => false,
            "mensaje" => "Error al actualizar cliente: " . $e->getMessage()
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

if ($metodo === "DELETE") {
    try {
        $id = $_GET["id"] ?? null;

        if (!$id) {
            echo json_encode([
                "ok" => false,
                "mensaje" => "No se recibió el ID del cliente"
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $stmt = $pdo->prepare("DELETE FROM Clientes WHERE id_cliente = :id");
        $stmt->execute([":id" => $id]);

        echo json_encode([
            "ok" => true,
            "mensaje" => "Cliente eliminado correctamente"
        ], JSON_UNESCAPED_UNICODE);
        exit;

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            "ok" => false,
            "mensaje" => "Error al eliminar cliente: " . $e->getMessage()
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

echo json_encode([
    "ok" => false,
    "mensaje" => "Método no permitido"
], JSON_UNESCAPED_UNICODE);
