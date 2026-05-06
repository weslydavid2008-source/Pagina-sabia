<?php
session_start();

header("Content-Type: application/json; charset=utf-8");

require_once "conexion.php";

$method = $_SERVER["REQUEST_METHOD"];
$accion = $_GET["accion"] ?? null;
$input = json_decode(file_get_contents("php://input"), true);

if (!$accion && is_array($input)) {
    $accion = $input["accion"] ?? null;
}

$idUsuario = obtenerIdUsuarioSesion();

if ($method === "GET" && ($accion === "obtener" || $accion === "contador" || !$accion)) {
    if (!$idUsuario) {
        responder([
            "ok" => true,
            "logueado" => false,
            "carrito" => [],
            "total_cantidad" => 0,
            "subtotal" => 0
        ]);
    }

    asegurarCarritoActivo($pdo, $idUsuario);
    responderCarrito($pdo, $idUsuario);
}

if (!$idUsuario) {
    responder([
        "ok" => false,
        "logueado" => false,
        "mensaje" => "Debes iniciar sesión para usar el carrito."
    ], 401);
}

if ($method === "POST" && $accion === "agregar") {
    agregarProducto($pdo, $idUsuario, $input ?? []);
}

if ($method === "POST" && $accion === "vaciar") {
    vaciarCarrito($pdo, $idUsuario);
}

if ($method === "PUT" && $accion === "actualizar") {
    actualizarCantidad($pdo, $idUsuario, $input ?? []);
}

if ($method === "DELETE" && $accion === "eliminar") {
    $idProducto = $_GET["id_producto"] ?? ($input["id_producto"] ?? null);
    eliminarProducto($pdo, $idUsuario, $idProducto);
}

responder([
    "ok" => false,
    "mensaje" => "Acción no permitida."
], 405);

function obtenerIdUsuarioSesion() {
    if (isset($_SESSION["id_usuario"])) {
        return (int) $_SESSION["id_usuario"];
    }

    if (isset($_SESSION["usuario"]["id_usuario"])) {
        return (int) $_SESSION["usuario"]["id_usuario"];
    }

    if (isset($_SESSION["usuario"]["id"])) {
        return (int) $_SESSION["usuario"]["id"];
    }

    return null;
}

function asegurarCarritoActivo($pdo, $idUsuario) {
    $stmt = $pdo->prepare("
        INSERT INTO Carritos (id_usuario, estado)
        VALUES (:id_usuario, 'activo')
        ON DUPLICATE KEY UPDATE fecha_actualizacion = CURRENT_TIMESTAMP
    ");

    $stmt->execute([
        ":id_usuario" => $idUsuario
    ]);

    $stmtBuscar = $pdo->prepare("
        SELECT id_carrito
        FROM Carritos
        WHERE id_usuario = :id_usuario
          AND estado = 'activo'
        LIMIT 1
    ");

    $stmtBuscar->execute([
        ":id_usuario" => $idUsuario
    ]);

    $carrito = $stmtBuscar->fetch(PDO::FETCH_ASSOC);

    if (!$carrito) {
        throw new Exception("No se pudo crear el carrito del usuario.");
    }

    return (int) $carrito["id_carrito"];
}

function obtenerCarritoCompleto($pdo, $idUsuario) {
    $stmt = $pdo->prepare("
        SELECT
            dc.id_detalle_carrito,
            dc.id_producto,
            dc.cantidad,
            p.nombre,
            p.descripcion,
            p.imagen_url,
            p.inventario,
            p.estado,
            p.precio_venta AS precio_original,
            COALESCE(o.precio_oferta, p.precio_venta) AS precio_final,
            o.precio_oferta,
            c.nombre AS categoria,
            p.id_categoria,
            CASE
                WHEN o.id_oferta IS NOT NULL THEN 1
                ELSE 0
            END AS en_oferta
        FROM Carritos ca
        INNER JOIN DetalleCarrito dc
            ON dc.id_carrito = ca.id_carrito
        INNER JOIN Productos p
            ON p.id_producto = dc.id_producto
        LEFT JOIN Categorias c
            ON c.id_categoria = p.id_categoria
        LEFT JOIN Ofertas o
            ON o.id_producto = p.id_producto
            AND o.estado = 'activa'
            AND CURDATE() BETWEEN o.fecha_inicio AND o.fecha_fin
        WHERE ca.id_usuario = :id_usuario
          AND ca.estado = 'activo'
        ORDER BY dc.fecha_agregado DESC, dc.id_detalle_carrito DESC
    ");

    $stmt->execute([
        ":id_usuario" => $idUsuario
    ]);

    $items = [];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $precio = (float) $row["precio_final"];
        $cantidad = (int) $row["cantidad"];

        $items[] = [
            "id_detalle_carrito" => (int) $row["id_detalle_carrito"],
            "id_producto" => (int) $row["id_producto"],
            "nombre" => $row["nombre"],
            "descripcion" => $row["descripcion"] ?: "Producto agregado al carrito.",
            "categoria" => $row["categoria"] ?: "Sin categoría",
            "id_categoria" => $row["id_categoria"] !== null ? (int) $row["id_categoria"] : null,
            "precio" => $precio,
            "precio_venta" => $precio,
            "precio_original" => (float) $row["precio_original"],
            "precio_oferta" => $row["precio_oferta"] !== null ? (float) $row["precio_oferta"] : null,
            "en_oferta" => (int) $row["en_oferta"],
            "cantidad" => $cantidad,
            "inventario" => (int) $row["inventario"],
            "estado" => $row["estado"],
            "imagen" => $row["imagen_url"] ?: "img/default.jpg",
            "imagen_url" => $row["imagen_url"] ?: "img/default.jpg",
            "subtotal" => $precio * $cantidad
        ];
    }

    return $items;
}

function responderCarrito($pdo, $idUsuario) {
    $carrito = obtenerCarritoCompleto($pdo, $idUsuario);
    $totalCantidad = 0;
    $subtotal = 0;

    foreach ($carrito as $item) {
        $totalCantidad += (int) $item["cantidad"];
        $subtotal += (float) $item["subtotal"];
    }

    responder([
        "ok" => true,
        "logueado" => true,
        "carrito" => $carrito,
        "total_cantidad" => $totalCantidad,
        "subtotal" => $subtotal
    ]);
}

function agregarProducto($pdo, $idUsuario, $input) {
    $idProducto = isset($input["id_producto"]) ? (int) $input["id_producto"] : 0;
    $cantidad = isset($input["cantidad"]) ? (int) $input["cantidad"] : 1;

    if ($idProducto <= 0 || $cantidad <= 0) {
        responder([
            "ok" => false,
            "mensaje" => "Producto o cantidad inválida."
        ], 400);
    }

    try {
        $pdo->beginTransaction();

        $idCarrito = asegurarCarritoActivo($pdo, $idUsuario);
        $producto = obtenerProductoParaCarrito($pdo, $idProducto);

        if (!$producto) {
            throw new Exception("El producto no existe.");
        }

        if ($producto["estado"] !== "activo") {
            throw new Exception("El producto " . $producto["nombre"] . " no está activo para la venta.");
        }

        $cantidadActual = obtenerCantidadActualProducto($pdo, $idCarrito, $idProducto);
        $nuevaCantidad = $cantidadActual + $cantidad;

        if ($nuevaCantidad > (int) $producto["inventario"]) {
            throw new Exception("No hay stock suficiente para " . $producto["nombre"] . ".");
        }

        $stmt = $pdo->prepare("
            INSERT INTO DetalleCarrito (id_carrito, id_producto, cantidad)
            VALUES (:id_carrito, :id_producto, :cantidad)
            ON DUPLICATE KEY UPDATE
                cantidad = cantidad + VALUES(cantidad),
                fecha_agregado = CURRENT_TIMESTAMP
        ");

        $stmt->execute([
            ":id_carrito" => $idCarrito,
            ":id_producto" => $idProducto,
            ":cantidad" => $cantidad
        ]);

        tocarCarrito($pdo, $idCarrito);
        $pdo->commit();

        responderCarrito($pdo, $idUsuario);

    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        responder([
            "ok" => false,
            "mensaje" => $error->getMessage()
        ], 400);
    }
}

function actualizarCantidad($pdo, $idUsuario, $input) {
    $idProducto = isset($input["id_producto"]) ? (int) $input["id_producto"] : 0;
    $cantidad = isset($input["cantidad"]) ? (int) $input["cantidad"] : 0;

    if ($idProducto <= 0 || $cantidad <= 0) {
        responder([
            "ok" => false,
            "mensaje" => "Producto o cantidad inválida."
        ], 400);
    }

    try {
        $pdo->beginTransaction();

        $idCarrito = asegurarCarritoActivo($pdo, $idUsuario);
        $producto = obtenerProductoParaCarrito($pdo, $idProducto);

        if (!$producto) {
            throw new Exception("El producto no existe.");
        }

        if ($cantidad > (int) $producto["inventario"]) {
            throw new Exception("No hay stock suficiente para " . $producto["nombre"] . ".");
        }

        $stmt = $pdo->prepare("
            UPDATE DetalleCarrito
            SET cantidad = :cantidad,
                fecha_agregado = CURRENT_TIMESTAMP
            WHERE id_carrito = :id_carrito
              AND id_producto = :id_producto
        ");

        $stmt->execute([
            ":cantidad" => $cantidad,
            ":id_carrito" => $idCarrito,
            ":id_producto" => $idProducto
        ]);

        tocarCarrito($pdo, $idCarrito);
        $pdo->commit();

        responderCarrito($pdo, $idUsuario);

    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        responder([
            "ok" => false,
            "mensaje" => $error->getMessage()
        ], 400);
    }
}

function eliminarProducto($pdo, $idUsuario, $idProducto) {
    $idProducto = (int) $idProducto;

    if ($idProducto <= 0) {
        responder([
            "ok" => false,
            "mensaje" => "Producto inválido."
        ], 400);
    }

    try {
        $idCarrito = asegurarCarritoActivo($pdo, $idUsuario);

        $stmt = $pdo->prepare("
            DELETE FROM DetalleCarrito
            WHERE id_carrito = :id_carrito
              AND id_producto = :id_producto
        ");

        $stmt->execute([
            ":id_carrito" => $idCarrito,
            ":id_producto" => $idProducto
        ]);

        tocarCarrito($pdo, $idCarrito);
        responderCarrito($pdo, $idUsuario);

    } catch (Throwable $error) {
        responder([
            "ok" => false,
            "mensaje" => $error->getMessage()
        ], 400);
    }
}

function vaciarCarrito($pdo, $idUsuario) {
    try {
        $idCarrito = asegurarCarritoActivo($pdo, $idUsuario);

        $stmt = $pdo->prepare("
            DELETE FROM DetalleCarrito
            WHERE id_carrito = :id_carrito
        ");

        $stmt->execute([
            ":id_carrito" => $idCarrito
        ]);

        tocarCarrito($pdo, $idCarrito);
        responderCarrito($pdo, $idUsuario);

    } catch (Throwable $error) {
        responder([
            "ok" => false,
            "mensaje" => $error->getMessage()
        ], 400);
    }
}

function obtenerProductoParaCarrito($pdo, $idProducto) {
    $stmt = $pdo->prepare("
        SELECT id_producto, nombre, inventario, estado
        FROM Productos
        WHERE id_producto = :id_producto
        LIMIT 1
        FOR UPDATE
    ");

    $stmt->execute([
        ":id_producto" => $idProducto
    ]);

    return $stmt->fetch(PDO::FETCH_ASSOC);
}

function obtenerCantidadActualProducto($pdo, $idCarrito, $idProducto) {
    $stmt = $pdo->prepare("
        SELECT cantidad
        FROM DetalleCarrito
        WHERE id_carrito = :id_carrito
          AND id_producto = :id_producto
        LIMIT 1
    ");

    $stmt->execute([
        ":id_carrito" => $idCarrito,
        ":id_producto" => $idProducto
    ]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return $row ? (int) $row["cantidad"] : 0;
}

function tocarCarrito($pdo, $idCarrito) {
    $stmt = $pdo->prepare("
        UPDATE Carritos
        SET fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE id_carrito = :id_carrito
    ");

    $stmt->execute([
        ":id_carrito" => $idCarrito
    ]);
}

function responder($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
