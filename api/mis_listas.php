<?php
session_start();

header("Content-Type: application/json; charset=utf-8");

require_once "conexion.php";

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    responder([
        "ok" => false,
        "mensaje" => "Método no permitido."
    ], 405);
}

$idUsuario = obtenerIdUsuarioSesion();

if (!$idUsuario) {
    responder([
        "ok" => false,
        "mensaje" => "Debes iniciar sesión para ver Mis Listas."
    ], 401);
}

try {
    $usuario = obtenerUsuario($pdo, $idUsuario);

    if (!$usuario) {
        responder([
            "ok" => false,
            "mensaje" => "Usuario no encontrado."
        ], 404);
    }

    $compras = obtenerComprasUsuario($pdo, $usuario);

    responder([
        "ok" => true,
        "compras" => $compras
    ]);

} catch (Throwable $error) {
    responder([
        "ok" => false,
        "mensaje" => "Error al cargar Mis Listas: " . $error->getMessage()
    ], 500);
}

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

function obtenerUsuario($pdo, $idUsuario) {
    $stmt = $pdo->prepare("
        SELECT
            id_usuario,
            nombre,
            apellido,
            correo,
            telefono,
            direccion,
            estado
        FROM Usuarios
        WHERE id_usuario = :id_usuario
        LIMIT 1
    ");

    $stmt->execute([
        ":id_usuario" => $idUsuario
    ]);

    $usuario = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$usuario || $usuario["estado"] !== "activo") {
        return null;
    }

    return $usuario;
}

function obtenerComprasUsuario($pdo, $usuario) {
    $stmt = $pdo->prepare("
        SELECT
            v.id_venta,
            v.id_cliente,
            v.id_usuario,
            v.id_domicilio,
            v.fecha_venta,
            v.subtotal AS venta_subtotal,
            v.total_iva,
            v.total_descuento,
            v.costo_domicilio,
            v.pago_total,

            c.nombre AS cliente_nombre,
            c.apellido AS cliente_apellido,
            c.correo AS cliente_correo,
            c.telefono AS cliente_telefono,
            c.id_usuario AS cliente_id_usuario,

            d.direccion_entrega,
            d.referencia,
            d.estado AS estado_domicilio,

            b.nombre AS barrio_nombre,

            dv.id_detalle_venta,
            dv.id_producto,
            dv.cantidad,
            dv.precio_venta,
            dv.iva,
            dv.descuento,
            dv.subtotal AS detalle_subtotal,

            p.nombre AS producto_nombre,
            p.descripcion AS producto_descripcion,
            p.imagen_url AS producto_imagen

        FROM Ventas v

        LEFT JOIN Clientes c
            ON c.id_cliente = v.id_cliente

        LEFT JOIN Domicilios d
            ON d.id_domicilio = v.id_domicilio

        LEFT JOIN Barrios b
            ON b.id_barrio = d.id_barrio

        LEFT JOIN DetalleVenta dv
            ON dv.id_venta = v.id_venta

        LEFT JOIN Productos p
            ON p.id_producto = dv.id_producto

        WHERE v.id_usuario = :id_usuario_venta
           OR c.id_usuario = :id_usuario_cliente
           OR c.correo = :correo_cliente

        ORDER BY v.fecha_venta DESC, v.id_venta DESC, dv.id_detalle_venta ASC
    ");

    $stmt->execute([
        ":id_usuario_venta" => $usuario["id_usuario"],
        ":id_usuario_cliente" => $usuario["id_usuario"],
        ":correo_cliente" => $usuario["correo"]
    ]);

    $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $compras = [];

    foreach ($filas as $fila) {
        $idVenta = (int) $fila["id_venta"];

        if (!isset($compras[$idVenta])) {
            $compras[$idVenta] = [
                "id_venta" => $idVenta,
                "id_cliente" => $fila["id_cliente"] !== null ? (int) $fila["id_cliente"] : null,
                "id_usuario" => (int) $fila["id_usuario"],
                "id_domicilio" => $fila["id_domicilio"] !== null ? (int) $fila["id_domicilio"] : null,
                "fecha_venta" => $fila["fecha_venta"],

                "subtotal" => (float) ($fila["venta_subtotal"] ?? 0),
                "total_iva" => (float) ($fila["total_iva"] ?? 0),
                "total_descuento" => (float) ($fila["total_descuento"] ?? 0),
                "costo_domicilio" => (float) ($fila["costo_domicilio"] ?? 0),
                "pago_total" => (float) ($fila["pago_total"] ?? 0),

                "estado" => $fila["estado_domicilio"] ?: "pendiente",

                "cliente_nombre" => trim(($fila["cliente_nombre"] ?? "") . " " . ($fila["cliente_apellido"] ?? "")),
                "cliente_correo" => $fila["cliente_correo"] ?? null,
                "cliente_telefono" => $fila["cliente_telefono"] ?? null,

                "direccion_entrega" => $fila["direccion_entrega"] ?? "",
                "referencia" => $fila["referencia"] ?? "",
                "barrio_nombre" => $fila["barrio_nombre"] ?? "",

                "productos" => []
            ];
        }

        if (!empty($fila["id_detalle_venta"])) {
            $cantidad = (int) ($fila["cantidad"] ?? 0);
            $precioVenta = (float) ($fila["precio_venta"] ?? 0);
            $subtotalProducto = $fila["detalle_subtotal"] !== null
                ? (float) $fila["detalle_subtotal"]
                : $cantidad * $precioVenta;

            $compras[$idVenta]["productos"][] = [
                "id_detalle_venta" => (int) $fila["id_detalle_venta"],
                "id_producto" => (int) $fila["id_producto"],
                "nombre" => $fila["producto_nombre"] ?: "Producto",
                "descripcion" => $fila["producto_descripcion"] ?: "",
                "imagen" => $fila["producto_imagen"] ?: "img/default.jpg",
                "cantidad" => $cantidad,
                "precio_venta" => $precioVenta,
                "iva" => (float) ($fila["iva"] ?? 0),
                "descuento" => (float) ($fila["descuento"] ?? 0),
                "subtotal" => $subtotalProducto
            ];
        }
    }

    return array_values($compras);
}

function responder($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
