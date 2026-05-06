<?php
header("Content-Type: application/json; charset=utf-8");

require_once "conexion.php";

$method = $_SERVER["REQUEST_METHOD"];

if ($method === "GET") {
    listarPedidos($pdo);
    exit;
}

if ($method === "PUT") {
    actualizarEstadoPedido($pdo);
    exit;
}

responder([
    "ok" => false,
    "mensaje" => "Método no permitido."
], 405);

function listarPedidos($pdo) {
    try {
        $sql = "
            SELECT
                v.id_venta,
                v.id_cliente,
                v.id_usuario,
                v.id_domicilio,
                v.fecha_venta,
                v.subtotal AS venta_subtotal,
                v.total_iva,
                v.total_descuento,
                v.costo_domicilio AS venta_costo_domicilio,
                v.pago_total,

                c.nombre AS cliente_nombre,
                c.apellido AS cliente_apellido,
                c.correo AS cliente_correo,
                c.telefono AS cliente_telefono,
                c.direccion AS cliente_direccion,

                d.direccion_entrega,
                d.referencia,
                d.costo_domicilio AS domicilio_costo,
                d.estado AS estado_domicilio,

                b.nombre AS barrio_nombre,

                dv.id_detalle_venta,
                dv.id_producto,
                dv.cantidad,
                dv.precio_venta,
                dv.iva,
                dv.descuento,
                dv.subtotal AS detalle_subtotal,

                p.nombre AS producto_nombre
            FROM Ventas v
            INNER JOIN Clientes c
                ON c.id_cliente = v.id_cliente
            INNER JOIN Domicilios d
                ON d.id_domicilio = v.id_domicilio
            LEFT JOIN Barrios b
                ON b.id_barrio = d.id_barrio
            LEFT JOIN DetalleVenta dv
                ON dv.id_venta = v.id_venta
            LEFT JOIN Productos p
                ON p.id_producto = dv.id_producto
            ORDER BY v.id_venta DESC, dv.id_detalle_venta ASC
        ";

        $stmt = $pdo->query($sql);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $pedidos = [];

        foreach ($filas as $fila) {
            $idVenta = (int) $fila["id_venta"];

            if (!isset($pedidos[$idVenta])) {
                $estado = $fila["estado_domicilio"] ?: "pendiente";

                $nombreCompleto = trim(
                    ($fila["cliente_nombre"] ?? "") . " " . ($fila["cliente_apellido"] ?? "")
                );

                $pedidos[$idVenta] = [
                    "id_venta" => $idVenta,
                    "id_cliente" => (int) $fila["id_cliente"],
                    "id_usuario" => (int) $fila["id_usuario"],
                    "id_domicilio" => (int) $fila["id_domicilio"],
                    "fecha_venta" => $fila["fecha_venta"],

                    "subtotal" => (float) $fila["venta_subtotal"],
                    "total_iva" => (float) $fila["total_iva"],
                    "total_descuento" => (float) $fila["total_descuento"],
                    "costo_domicilio" => (float) $fila["venta_costo_domicilio"],
                    "pago_total" => (float) $fila["pago_total"],

                    "estado" => $estado,
                    "estado_label" => convertirEstadoALabel($estado),

                    "cliente_nombre" => $fila["cliente_nombre"],
                    "cliente_apellido" => $fila["cliente_apellido"],
                    "cliente_nombre_completo" => $nombreCompleto ?: "Cliente",
                    "cliente_correo" => $fila["cliente_correo"],
                    "cliente_telefono" => $fila["cliente_telefono"],
                    "cliente_direccion" => $fila["cliente_direccion"],

                    "direccion_entrega" => $fila["direccion_entrega"],
                    "referencia" => $fila["referencia"],
                    "barrio_nombre" => $fila["barrio_nombre"],

                    "total_productos" => 0,
                    "productos" => []
                ];
            }

            if (!empty($fila["id_detalle_venta"])) {
                $cantidad = (int) $fila["cantidad"];
                $precioVenta = (float) $fila["precio_venta"];
                $subtotalDetalle = (float) $fila["detalle_subtotal"];

                if ($subtotalDetalle <= 0) {
                    $subtotalDetalle = $cantidad * $precioVenta;
                }

                $pedidos[$idVenta]["productos"][] = [
                    "id_detalle_venta" => (int) $fila["id_detalle_venta"],
                    "id_producto" => (int) $fila["id_producto"],
                    "nombre" => $fila["producto_nombre"],
                    "cantidad" => $cantidad,
                    "precio_venta" => $precioVenta,
                    "iva" => (float) $fila["iva"],
                    "descuento" => (float) $fila["descuento"],
                    "subtotal" => $subtotalDetalle
                ];

                $pedidos[$idVenta]["total_productos"] += $cantidad;
            }
        }

        responder([
            "ok" => true,
            "pedidos" => array_values($pedidos)
        ]);

    } catch (Throwable $error) {
        responder([
            "ok" => false,
            "mensaje" => "Error al consultar pedidos: " . $error->getMessage()
        ], 500);
    }
}

function actualizarEstadoPedido($pdo) {
    try {
        $input = json_decode(file_get_contents("php://input"), true);

        if (!is_array($input)) {
            responder([
                "ok" => false,
                "mensaje" => "JSON inválido."
            ], 400);
        }

        $idVenta = isset($input["id_venta"]) ? (int) $input["id_venta"] : 0;
        $estadoNuevo = $input["estado"] ?? "";

        $estadosPermitidos = [
            "pendiente",
            "en_camino",
            "entregado",
            "cancelado"
        ];

        if ($idVenta <= 0) {
            responder([
                "ok" => false,
                "mensaje" => "El id del pedido no es válido."
            ], 400);
        }

        if (!in_array($estadoNuevo, $estadosPermitidos, true)) {
            responder([
                "ok" => false,
                "mensaje" => "El estado no es válido."
            ], 400);
        }

        $pdo->beginTransaction();

        $stmtExiste = $pdo->prepare("
            SELECT
                v.id_venta,
                v.id_domicilio,
                d.estado AS estado_actual
            FROM Ventas v
            INNER JOIN Domicilios d
                ON d.id_domicilio = v.id_domicilio
            WHERE v.id_venta = :id_venta
            LIMIT 1
            FOR UPDATE
        ");

        $stmtExiste->execute([
            ":id_venta" => $idVenta
        ]);

        $venta = $stmtExiste->fetch(PDO::FETCH_ASSOC);

        if (!$venta) {
            throw new Exception("Pedido no encontrado.");
        }

        $estadoAnterior = $venta["estado_actual"] ?: "pendiente";
        $movimientoStock = "sin_cambio";

        if ($estadoAnterior !== "entregado" && $estadoNuevo === "entregado") {
            descontarStockPedido($pdo, $idVenta);
            $movimientoStock = "stock_descontado";
        }

        if ($estadoAnterior === "entregado" && $estadoNuevo !== "entregado") {
            devolverStockPedido($pdo, $idVenta);
            $movimientoStock = "stock_devuelto";
        }

        $stmt = $pdo->prepare("
            UPDATE Domicilios
            SET estado = :estado
            WHERE id_domicilio = :id_domicilio
        ");

        $stmt->execute([
            ":estado" => $estadoNuevo,
            ":id_domicilio" => $venta["id_domicilio"]
        ]);

        $pdo->commit();

        responder([
            "ok" => true,
            "mensaje" => "Estado actualizado correctamente.",
            "id_venta" => $idVenta,
            "estado_anterior" => $estadoAnterior,
            "estado" => $estadoNuevo,
            "estado_label" => convertirEstadoALabel($estadoNuevo),
            "movimiento_stock" => $movimientoStock,
            "cuenta_como_venta" => $estadoNuevo === "entregado"
        ]);

    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        responder([
            "ok" => false,
            "mensaje" => "Error al actualizar pedido: " . $error->getMessage()
        ], 500);
    }
}

function obtenerCantidadesPedido($pdo, $idVenta) {
    $stmt = $pdo->prepare("
        SELECT
            dv.id_producto,
            SUM(dv.cantidad) AS cantidad
        FROM DetalleVenta dv
        WHERE dv.id_venta = :id_venta
        GROUP BY dv.id_producto
    ");

    $stmt->execute([
        ":id_venta" => $idVenta
    ]);

    $detalles = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!$detalles) {
        throw new Exception("El pedido no tiene productos.");
    }

    return $detalles;
}

function obtenerProductosBloqueados($pdo, $idsProductos) {
    $idsProductos = array_values(array_unique(array_map("intval", $idsProductos)));

    if (count($idsProductos) === 0) {
        return [];
    }

    $placeholders = implode(",", array_fill(0, count($idsProductos), "?"));

    $stmt = $pdo->prepare("
        SELECT
            id_producto,
            nombre,
            inventario
        FROM Productos
        WHERE id_producto IN ($placeholders)
        FOR UPDATE
    ");

    $stmt->execute($idsProductos);

    $productos = [];

    while ($producto = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $productos[(int) $producto["id_producto"]] = $producto;
    }

    return $productos;
}

function descontarStockPedido($pdo, $idVenta) {
    $detalles = obtenerCantidadesPedido($pdo, $idVenta);
    $idsProductos = array_column($detalles, "id_producto");
    $productos = obtenerProductosBloqueados($pdo, $idsProductos);

    foreach ($detalles as $detalle) {
        $idProducto = (int) $detalle["id_producto"];
        $cantidad = (int) $detalle["cantidad"];

        if (!isset($productos[$idProducto])) {
            throw new Exception("Uno de los productos del pedido ya no existe.");
        }

        $producto = $productos[$idProducto];

        if ((int) $producto["inventario"] < $cantidad) {
            throw new Exception(
                "Stock insuficiente para " . $producto["nombre"] .
                ". Disponible: " . (int) $producto["inventario"] .
                ", requerido: " . $cantidad . "."
            );
        }
    }

    $stmtUpdate = $pdo->prepare("
        UPDATE Productos
        SET inventario = inventario - :cantidad
        WHERE id_producto = :id_producto
    ");

    foreach ($detalles as $detalle) {
        $stmtUpdate->execute([
            ":cantidad" => (int) $detalle["cantidad"],
            ":id_producto" => (int) $detalle["id_producto"]
        ]);
    }
}

function devolverStockPedido($pdo, $idVenta) {
    $detalles = obtenerCantidadesPedido($pdo, $idVenta);
    $idsProductos = array_column($detalles, "id_producto");

    obtenerProductosBloqueados($pdo, $idsProductos);

    $stmtUpdate = $pdo->prepare("
        UPDATE Productos
        SET inventario = inventario + :cantidad
        WHERE id_producto = :id_producto
    ");

    foreach ($detalles as $detalle) {
        $stmtUpdate->execute([
            ":cantidad" => (int) $detalle["cantidad"],
            ":id_producto" => (int) $detalle["id_producto"]
        ]);
    }
}

function convertirEstadoALabel($estado) {
    $labels = [
        "pendiente" => "Pendiente",
        "en_camino" => "En camino",
        "entregado" => "Entregado",
        "cancelado" => "Cancelado"
    ];

    return $labels[$estado] ?? "Pendiente";
}

function responder($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
