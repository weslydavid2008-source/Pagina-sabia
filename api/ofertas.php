<?php
header("Content-Type: application/json; charset=utf-8");

require_once "conexion.php";

$method = $_SERVER["REQUEST_METHOD"];

if ($method === "GET") {
    listarOfertas($pdo);
    exit;
}

if ($method === "POST") {
    crearOferta($pdo);
    exit;
}

if ($method === "PUT") {
    actualizarOferta($pdo);
    exit;
}

if ($method === "DELETE") {
    eliminarOferta($pdo);
    exit;
}

responder([
    "ok" => false,
    "mensaje" => "Método no permitido."
], 405);

function listarOfertas($pdo) {
    try {
        $stmt = $pdo->query("
            SELECT
                o.id_oferta,
                o.id_producto,
                o.precio_original,
                o.precio_oferta,
                o.fecha_inicio,
                o.fecha_fin,
                o.estado,
                p.nombre AS producto_nombre,
                p.descripcion AS producto_descripcion,
                p.precio_venta AS producto_precio_venta,
                p.estado AS producto_estado,
                c.nombre AS categoria_nombre
            FROM Ofertas o
            INNER JOIN Productos p
                ON p.id_producto = o.id_producto
            LEFT JOIN Categorias c
                ON c.id_categoria = p.id_categoria
            ORDER BY o.id_oferta DESC
        ");

        responder([
            "ok" => true,
            "ofertas" => $stmt->fetchAll(PDO::FETCH_ASSOC)
        ]);

    } catch (Throwable $error) {
        responder([
            "ok" => false,
            "mensaje" => "Error al consultar ofertas: " . $error->getMessage()
        ], 500);
    }
}

function crearOferta($pdo) {
    try {
        $data = obtenerJson();

        $idProducto = (int) ($data["id_producto"] ?? 0);
        $precioOriginal = (float) ($data["precio_original"] ?? 0);
        $precioOferta = (float) ($data["precio_oferta"] ?? 0);
        $fechaFin = trim($data["fecha_fin"] ?? "");
        $estado = trim($data["estado"] ?? "activa");

        validarDatosOferta($pdo, $idProducto, $precioOriginal, $precioOferta, $fechaFin, $estado);

        $stmt = $pdo->prepare("
            INSERT INTO Ofertas (
                id_producto,
                precio_original,
                precio_oferta,
                fecha_inicio,
                fecha_fin,
                estado
            )
            VALUES (
                :id_producto,
                :precio_original,
                :precio_oferta,
                CURDATE(),
                :fecha_fin,
                :estado
            )
        ");

        $stmt->execute([
            ":id_producto" => $idProducto,
            ":precio_original" => $precioOriginal,
            ":precio_oferta" => $precioOferta,
            ":fecha_fin" => $fechaFin,
            ":estado" => $estado
        ]);

        actualizarProductoEnOferta($pdo, $idProducto);

        responder([
            "ok" => true,
            "mensaje" => "Oferta creada correctamente.",
            "id_oferta" => (int) $pdo->lastInsertId()
        ]);

    } catch (Throwable $error) {
        responder([
            "ok" => false,
            "mensaje" => $error->getMessage()
        ], 400);
    }
}

function actualizarOferta($pdo) {
    try {
        $data = obtenerJson();

        $idOferta = (int) ($data["id_oferta"] ?? 0);
        $idProducto = (int) ($data["id_producto"] ?? 0);
        $precioOriginal = (float) ($data["precio_original"] ?? 0);
        $precioOferta = (float) ($data["precio_oferta"] ?? 0);
        $fechaFin = trim($data["fecha_fin"] ?? "");
        $estado = trim($data["estado"] ?? "activa");

        if ($idOferta <= 0) {
            throw new Exception("El id de la oferta no es válido.");
        }

        $ofertaAnterior = obtenerOfertaPorId($pdo, $idOferta);

        if (!$ofertaAnterior) {
            throw new Exception("La oferta no existe.");
        }

        validarDatosOferta($pdo, $idProducto, $precioOriginal, $precioOferta, $fechaFin, $estado);

        $stmt = $pdo->prepare("
            UPDATE Ofertas SET
                id_producto = :id_producto,
                precio_original = :precio_original,
                precio_oferta = :precio_oferta,
                fecha_fin = :fecha_fin,
                estado = :estado
            WHERE id_oferta = :id_oferta
        ");

        $stmt->execute([
            ":id_oferta" => $idOferta,
            ":id_producto" => $idProducto,
            ":precio_original" => $precioOriginal,
            ":precio_oferta" => $precioOferta,
            ":fecha_fin" => $fechaFin,
            ":estado" => $estado
        ]);

        actualizarProductoEnOferta($pdo, (int) $ofertaAnterior["id_producto"]);
        actualizarProductoEnOferta($pdo, $idProducto);

        responder([
            "ok" => true,
            "mensaje" => "Oferta actualizada correctamente."
        ]);

    } catch (Throwable $error) {
        responder([
            "ok" => false,
            "mensaje" => $error->getMessage()
        ], 400);
    }
}

function eliminarOferta($pdo) {
    try {
        $idOferta = (int) ($_GET["id"] ?? 0);

        if ($idOferta <= 0) {
            throw new Exception("El id de la oferta no es válido.");
        }

        $oferta = obtenerOfertaPorId($pdo, $idOferta);

        if (!$oferta) {
            throw new Exception("La oferta no existe.");
        }

        $stmt = $pdo->prepare("
            DELETE FROM Ofertas
            WHERE id_oferta = :id_oferta
        ");

        $stmt->execute([
            ":id_oferta" => $idOferta
        ]);

        actualizarProductoEnOferta($pdo, (int) $oferta["id_producto"]);

        responder([
            "ok" => true,
            "mensaje" => "Oferta eliminada correctamente."
        ]);

    } catch (Throwable $error) {
        responder([
            "ok" => false,
            "mensaje" => $error->getMessage()
        ], 400);
    }
}

function validarDatosOferta($pdo, $idProducto, $precioOriginal, $precioOferta, $fechaFin, $estado) {
    if ($idProducto <= 0) {
        throw new Exception("Selecciona un producto válido.");
    }

    $producto = obtenerProductoPorId($pdo, $idProducto);

    if (!$producto) {
        throw new Exception("El producto seleccionado no existe en la base de datos.");
    }

    if ($producto["estado"] !== "activo") {
        throw new Exception("Solo puedes crear ofertas para productos activos.");
    }

    if ($precioOriginal <= 0) {
        throw new Exception("El precio original no es válido.");
    }

    if ($precioOferta <= 0) {
        throw new Exception("El precio de oferta no es válido.");
    }

    if ($precioOferta >= $precioOriginal) {
        throw new Exception("El precio de oferta debe ser menor que el precio original.");
    }

    if (!$fechaFin) {
        throw new Exception("La fecha de finalización es obligatoria.");
    }

    if (!in_array($estado, ["activa", "inactiva"], true)) {
        throw new Exception("El estado de la oferta no es válido.");
    }
}

function obtenerJson() {
    $data = json_decode(file_get_contents("php://input"), true);

    if (!is_array($data)) {
        throw new Exception("JSON inválido.");
    }

    return $data;
}

function obtenerProductoPorId($pdo, $idProducto) {
    $stmt = $pdo->prepare("
        SELECT
            id_producto,
            nombre,
            precio_venta,
            estado
        FROM Productos
        WHERE id_producto = :id_producto
        LIMIT 1
    ");

    $stmt->execute([
        ":id_producto" => $idProducto
    ]);

    return $stmt->fetch(PDO::FETCH_ASSOC);
}

function obtenerOfertaPorId($pdo, $idOferta) {
    $stmt = $pdo->prepare("
        SELECT
            id_oferta,
            id_producto,
            precio_original,
            precio_oferta,
            fecha_fin,
            estado
        FROM Ofertas
        WHERE id_oferta = :id_oferta
        LIMIT 1
    ");

    $stmt->execute([
        ":id_oferta" => $idOferta
    ]);

    return $stmt->fetch(PDO::FETCH_ASSOC);
}

function actualizarProductoEnOferta($pdo, $idProducto) {
    if ($idProducto <= 0) {
        return;
    }

    $stmt = $pdo->prepare("
        SELECT COUNT(*) AS total
        FROM Ofertas
        WHERE id_producto = :id_producto
          AND estado = 'activa'
          AND fecha_fin >= CURDATE()
    ");

    $stmt->execute([
        ":id_producto" => $idProducto
    ]);

    $resultado = $stmt->fetch(PDO::FETCH_ASSOC);
    $tieneOferta = ((int) ($resultado["total"] ?? 0)) > 0 ? 1 : 0;

    $stmtUpdate = $pdo->prepare("
        UPDATE Productos
        SET en_oferta = :en_oferta
        WHERE id_producto = :id_producto
    ");

    $stmtUpdate->execute([
        ":en_oferta" => $tieneOferta,
        ":id_producto" => $idProducto
    ]);
}

function responder($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}