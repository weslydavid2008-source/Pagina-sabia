<?php
header("Content-Type: application/json; charset=utf-8");

require_once "conexion.php";

$metodo = $_SERVER["REQUEST_METHOD"];

function responder($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function obtener_json() {
    $data = json_decode(file_get_contents("php://input"), true);

    if (!is_array($data)) {
        throw new Exception("JSON inválido.");
    }

    return $data;
}

function normalizar_estado($estado) {
    $estado = strtolower(trim($estado ?? "pendiente"));
    $permitidos = ["pendiente", "recibida", "parcial", "cancelada"];

    return in_array($estado, $permitidos, true) ? $estado : "pendiente";
}

function compra_afecta_inventario($estado) {
    return $estado === "recibida";
}

function buscar_producto_por_nombre($pdo, $nombreProducto) {
    $stmt = $pdo->prepare("
        SELECT
            id_producto,
            nombre,
            id_categoria,
            precio_compra,
            precio_venta
        FROM Productos
        WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(:nombre))
        LIMIT 1
    ");

    $stmt->execute([
        ":nombre" => $nombreProducto
    ]);

    return $stmt->fetch(PDO::FETCH_ASSOC);
}

function buscar_relacion_proveedor_producto($pdo, $idProveedor, $idProducto) {
    $stmt = $pdo->prepare("
        SELECT
            id_prov_prod,
            precio_proveedor
        FROM ProveedorProductos
        WHERE id_proveedor = :id_proveedor
          AND id_producto = :id_producto
        LIMIT 1
    ");

    $stmt->execute([
        ":id_proveedor" => $idProveedor,
        ":id_producto" => $idProducto
    ]);

    return $stmt->fetch(PDO::FETCH_ASSOC);
}

function crear_producto($pdo, $item) {
    $nombreProducto = trim($item["nombre_producto"] ?? "");
    $idCategoria = $item["id_categoria"] ?? null;
    $precioCompra = (float) ($item["precio_unitario"] ?? 0);
    $precioVenta = (float) ($item["precio_venta"] ?? 0);

    if (!$nombreProducto || $precioCompra <= 0) {
        throw new Exception("Faltan datos del producto nuevo.");
    }

    if ($precioVenta <= 0) {
        $precioVenta = $precioCompra * 1.25;
    }

    $stmt = $pdo->prepare("
        INSERT INTO Productos
        (
            nombre,
            descripcion,
            id_categoria,
            precio_compra,
            precio_venta,
            inventario,
            stock_minimo,
            stock_maximo,
            estado,
            en_oferta,
            destacado,
            tiene_proveedor
        )
        VALUES
        (
            :nombre,
            '',
            :id_categoria,
            :precio_compra,
            :precio_venta,
            0,
            10,
            100,
            'activo',
            FALSE,
            FALSE,
            TRUE
        )
    ");

    $stmt->execute([
        ":nombre" => $nombreProducto,
        ":id_categoria" => $idCategoria ?: null,
        ":precio_compra" => $precioCompra,
        ":precio_venta" => $precioVenta
    ]);

    return (int) $pdo->lastInsertId();
}

function crear_relacion_proveedor_producto($pdo, $idProveedor, $idProducto, $precioProveedor) {
    $stmt = $pdo->prepare("
        INSERT INTO ProveedorProductos
        (
            id_proveedor,
            id_producto,
            precio_proveedor
        )
        VALUES
        (
            :id_proveedor,
            :id_producto,
            :precio_proveedor
        )
    ");

    $stmt->execute([
        ":id_proveedor" => $idProveedor,
        ":id_producto" => $idProducto,
        ":precio_proveedor" => $precioProveedor
    ]);

    return (int) $pdo->lastInsertId();
}

function preparar_item_compra($pdo, $idProveedor, $item) {
    $cantidad = (int) ($item["cantidad"] ?? 0);

    if ($cantidad <= 0) {
        throw new Exception("La cantidad debe ser mayor a 0.");
    }

    $idProveedorProducto = $item["id_proveedor_producto"] ?? null;

    if ($idProveedorProducto) {
        $stmt = $pdo->prepare("
            SELECT
                pp.id_prov_prod,
                pp.id_producto,
                pp.precio_proveedor,
                p.nombre AS producto
            FROM ProveedorProductos pp
            INNER JOIN Productos p
                ON pp.id_producto = p.id_producto
            WHERE pp.id_prov_prod = :id_prov_prod
              AND pp.id_proveedor = :id_proveedor
            LIMIT 1
        ");

        $stmt->execute([
            ":id_prov_prod" => $idProveedorProducto,
            ":id_proveedor" => $idProveedor
        ]);

        $relacion = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$relacion) {
            throw new Exception("El producto seleccionado no pertenece al proveedor.");
        }

        return [
            "id_proveedor_producto" => (int) $relacion["id_prov_prod"],
            "cantidad" => $cantidad,
            "precio_unitario" => (float) $relacion["precio_proveedor"]
        ];
    }

    if (!empty($item["nuevo_producto"])) {
        $nombreProducto = trim($item["nombre_producto"] ?? "");
        $precioProveedor = (float) ($item["precio_unitario"] ?? 0);

        if (!$nombreProducto || $precioProveedor <= 0) {
            throw new Exception("Faltan datos del producto nuevo.");
        }

        $productoExistente = buscar_producto_por_nombre($pdo, $nombreProducto);

        if ($productoExistente) {
            $idProducto = (int) $productoExistente["id_producto"];
            $relacionExistente = buscar_relacion_proveedor_producto($pdo, $idProveedor, $idProducto);

            if ($relacionExistente) {
                $idProveedorProducto = (int) $relacionExistente["id_prov_prod"];
                $precioProveedor = (float) $relacionExistente["precio_proveedor"];
            } else {
                $idProveedorProducto = crear_relacion_proveedor_producto(
                    $pdo,
                    $idProveedor,
                    $idProducto,
                    $precioProveedor
                );

                $stmtUpdateProducto = $pdo->prepare("
                    UPDATE Productos
                    SET
                        tiene_proveedor = TRUE,
                        precio_compra = :precio_compra
                    WHERE id_producto = :id_producto
                ");

                $stmtUpdateProducto->execute([
                    ":precio_compra" => $precioProveedor,
                    ":id_producto" => $idProducto
                ]);
            }
        } else {
            $idProducto = crear_producto($pdo, $item);

            $idProveedorProducto = crear_relacion_proveedor_producto(
                $pdo,
                $idProveedor,
                $idProducto,
                $precioProveedor
            );
        }

        return [
            "id_proveedor_producto" => (int) $idProveedorProducto,
            "cantidad" => $cantidad,
            "precio_unitario" => $precioProveedor
        ];
    }

    throw new Exception("Producto inválido en la compra.");
}

function insertar_detalles_compra($pdo, $idCompra, $itemsPreparados) {
    $stmtDetalle = $pdo->prepare("
        INSERT INTO DetalleCompra
        (
            id_compra,
            id_proveedor_producto,
            cantidad,
            precio_unitario,
            iva,
            descuento
        )
        VALUES
        (
            :id_compra,
            :id_proveedor_producto,
            :cantidad,
            :precio_unitario,
            0,
            0
        )
    ");

    foreach ($itemsPreparados as $item) {
        $stmtDetalle->execute([
            ":id_compra" => $idCompra,
            ":id_proveedor_producto" => $item["id_proveedor_producto"],
            ":cantidad" => $item["cantidad"],
            ":precio_unitario" => $item["precio_unitario"]
        ]);
    }
}

function obtener_compra_bloqueada($pdo, $idCompra) {
    $stmt = $pdo->prepare("
        SELECT
            id_compra,
            estado
        FROM Compras
        WHERE id_compra = :id_compra
        LIMIT 1
        FOR UPDATE
    ");

    $stmt->execute([
        ":id_compra" => $idCompra
    ]);

    return $stmt->fetch(PDO::FETCH_ASSOC);
}

function obtener_detalles_stock_compra($pdo, $idCompra) {
    $stmt = $pdo->prepare("
        SELECT
            pp.id_producto,
            SUM(dc.cantidad) AS cantidad
        FROM DetalleCompra dc
        INNER JOIN ProveedorProductos pp
            ON dc.id_proveedor_producto = pp.id_prov_prod
        WHERE dc.id_compra = :id_compra
        GROUP BY pp.id_producto
    ");

    $stmt->execute([
        ":id_compra" => $idCompra
    ]);

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function bloquear_productos_por_detalles($pdo, $detalles) {
    $idsProductos = array_values(array_unique(array_map(function ($detalle) {
        return (int) $detalle["id_producto"];
    }, $detalles)));

    if (count($idsProductos) === 0) {
        return;
    }

    $placeholders = implode(",", array_fill(0, count($idsProductos), "?"));

    $stmt = $pdo->prepare("
        SELECT id_producto
        FROM Productos
        WHERE id_producto IN ($placeholders)
        FOR UPDATE
    ");

    $stmt->execute($idsProductos);
}

function sumar_stock_compra($pdo, $idCompra) {
    $detalles = obtener_detalles_stock_compra($pdo, $idCompra);

    if (!$detalles) {
        return;
    }

    bloquear_productos_por_detalles($pdo, $detalles);

    $stmt = $pdo->prepare("
        UPDATE Productos
        SET inventario = inventario + :cantidad
        WHERE id_producto = :id_producto
    ");

    foreach ($detalles as $detalle) {
        $stmt->execute([
            ":cantidad" => (int) $detalle["cantidad"],
            ":id_producto" => (int) $detalle["id_producto"]
        ]);
    }
}

function restar_stock_compra($pdo, $idCompra) {
    $detalles = obtener_detalles_stock_compra($pdo, $idCompra);

    if (!$detalles) {
        return;
    }

    bloquear_productos_por_detalles($pdo, $detalles);

    $stmt = $pdo->prepare("
        UPDATE Productos
        SET inventario = GREATEST(inventario - :cantidad, 0)
        WHERE id_producto = :id_producto
    ");

    foreach ($detalles as $detalle) {
        $stmt->execute([
            ":cantidad" => (int) $detalle["cantidad"],
            ":id_producto" => (int) $detalle["id_producto"]
        ]);
    }
}

if ($metodo === "GET") {
    try {
        $id = $_GET["id"] ?? null;

        if ($id) {
            $stmt = $pdo->prepare("
                SELECT
                    c.id_compra,
                    c.id_proveedor,
                    pr.nombre AS proveedor,
                    c.referencia,
                    c.fecha_compra,
                    c.estado,
                    c.subtotal,
                    c.total_iva,
                    c.total_descuento,
                    c.pago_total,
                    c.observaciones
                FROM Compras c
                INNER JOIN Proveedores pr
                    ON c.id_proveedor = pr.id_proveedor
                WHERE c.id_compra = :id_compra
                LIMIT 1
            ");

            $stmt->execute([
                ":id_compra" => $id
            ]);

            $compra = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$compra) {
                responder([
                    "ok" => false,
                    "mensaje" => "Compra no encontrada."
                ], 404);
            }

            $stmtItems = $pdo->prepare("
                SELECT
                    dc.id_detalle_compra,
                    dc.id_proveedor_producto,
                    dc.cantidad,
                    dc.precio_unitario,
                    dc.iva,
                    dc.descuento,
                    dc.subtotal,
                    p.nombre AS producto
                FROM DetalleCompra dc
                INNER JOIN ProveedorProductos pp
                    ON dc.id_proveedor_producto = pp.id_prov_prod
                INNER JOIN Productos p
                    ON pp.id_producto = p.id_producto
                WHERE dc.id_compra = :id_compra
                ORDER BY dc.id_detalle_compra ASC
            ");

            $stmtItems->execute([
                ":id_compra" => $id
            ]);

            $compra["items"] = $stmtItems->fetchAll(PDO::FETCH_ASSOC);
            responder($compra);
        }

        $sql = "
            SELECT
                c.id_compra,
                c.id_proveedor,
                pr.nombre AS proveedor,
                c.referencia,
                c.fecha_compra,
                c.estado,
                c.pago_total,
                c.observaciones,
                COUNT(dc.id_detalle_compra) AS productos_count,
                GROUP_CONCAT(p.nombre ORDER BY p.nombre SEPARATOR ', ') AS productos_preview
            FROM Compras c
            INNER JOIN Proveedores pr
                ON c.id_proveedor = pr.id_proveedor
            LEFT JOIN DetalleCompra dc
                ON c.id_compra = dc.id_compra
            LEFT JOIN ProveedorProductos pp
                ON dc.id_proveedor_producto = pp.id_prov_prod
            LEFT JOIN Productos p
                ON pp.id_producto = p.id_producto
            GROUP BY
                c.id_compra,
                c.id_proveedor,
                pr.nombre,
                c.referencia,
                c.fecha_compra,
                c.estado,
                c.pago_total,
                c.observaciones
            ORDER BY c.id_compra DESC
        ";

        $stmt = $pdo->query($sql);
        responder($stmt->fetchAll(PDO::FETCH_ASSOC));

    } catch (Throwable $e) {
        responder([
            "ok" => false,
            "mensaje" => "Error al consultar compras: " . $e->getMessage()
        ], 500);
    }
}

if ($metodo === "POST") {
    try {
        $data = obtener_json();

        $idProveedor = $data["id_proveedor"] ?? null;
        $referencia = trim($data["referencia"] ?? "");
        $fechaCompra = $data["fecha_compra"] ?? date("Y-m-d");
        $estado = normalizar_estado($data["estado"] ?? "pendiente");
        $observaciones = trim($data["observaciones"] ?? "");
        $items = $data["items"] ?? [];

        if (!$idProveedor || !$referencia || !is_array($items) || count($items) === 0) {
            responder([
                "ok" => false,
                "mensaje" => "Faltan datos obligatorios de la compra."
            ], 400);
        }

        $pdo->beginTransaction();

        $itemsPreparados = [];
        $total = 0;

        foreach ($items as $item) {
            $itemPreparado = preparar_item_compra($pdo, $idProveedor, $item);
            $itemsPreparados[] = $itemPreparado;
            $total += $itemPreparado["cantidad"] * $itemPreparado["precio_unitario"];
        }

        $stmtCompra = $pdo->prepare("
            INSERT INTO Compras
            (
                id_proveedor,
                referencia,
                fecha_compra,
                estado,
                subtotal,
                total_iva,
                total_descuento,
                pago_total,
                observaciones
            )
            VALUES
            (
                :id_proveedor,
                :referencia,
                :fecha_compra,
                :estado,
                :subtotal,
                0,
                0,
                :pago_total,
                :observaciones
            )
        ");

        $stmtCompra->execute([
            ":id_proveedor" => $idProveedor,
            ":referencia" => $referencia,
            ":fecha_compra" => $fechaCompra,
            ":estado" => $estado,
            ":subtotal" => $total,
            ":pago_total" => $total,
            ":observaciones" => $observaciones
        ]);

        $idCompra = (int) $pdo->lastInsertId();

        insertar_detalles_compra($pdo, $idCompra, $itemsPreparados);

        $movimientoStock = "sin_cambio";

        if (compra_afecta_inventario($estado)) {
            sumar_stock_compra($pdo, $idCompra);
            $movimientoStock = "stock_sumado";
        }

        $pdo->commit();

        responder([
            "ok" => true,
            "mensaje" => "Compra creada correctamente.",
            "id_compra" => $idCompra,
            "estado" => $estado,
            "movimiento_stock" => $movimientoStock,
            "cuenta_como_compra" => compra_afecta_inventario($estado)
        ]);

    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        responder([
            "ok" => false,
            "mensaje" => "Error al crear compra: " . $e->getMessage()
        ], 500);
    }
}

if ($metodo === "PUT") {
    try {
        $data = obtener_json();

        $idCompra = (int) ($data["id_compra"] ?? 0);
        $idProveedor = $data["id_proveedor"] ?? null;
        $referencia = trim($data["referencia"] ?? "");
        $fechaCompra = $data["fecha_compra"] ?? date("Y-m-d");
        $estadoNuevo = normalizar_estado($data["estado"] ?? "pendiente");
        $observaciones = trim($data["observaciones"] ?? "");
        $items = $data["items"] ?? [];

        if (!$idCompra || !$idProveedor || !$referencia || !is_array($items) || count($items) === 0) {
            responder([
                "ok" => false,
                "mensaje" => "Faltan datos obligatorios para actualizar la compra."
            ], 400);
        }

        $pdo->beginTransaction();

        $compraActual = obtener_compra_bloqueada($pdo, $idCompra);

        if (!$compraActual) {
            throw new Exception("Compra no encontrada.");
        }

        $estadoAnterior = normalizar_estado($compraActual["estado"]);
        $movimientos = [];

        if (compra_afecta_inventario($estadoAnterior)) {
            restar_stock_compra($pdo, $idCompra);
            $movimientos[] = "stock_anterior_revertido";
        }

        $deleteDetalles = $pdo->prepare("
            DELETE FROM DetalleCompra
            WHERE id_compra = :id_compra
        ");

        $deleteDetalles->execute([
            ":id_compra" => $idCompra
        ]);

        $itemsPreparados = [];
        $total = 0;

        foreach ($items as $item) {
            $itemPreparado = preparar_item_compra($pdo, $idProveedor, $item);
            $itemsPreparados[] = $itemPreparado;
            $total += $itemPreparado["cantidad"] * $itemPreparado["precio_unitario"];
        }

        $stmtCompra = $pdo->prepare("
            UPDATE Compras SET
                id_proveedor = :id_proveedor,
                referencia = :referencia,
                fecha_compra = :fecha_compra,
                estado = :estado,
                subtotal = :subtotal,
                total_iva = 0,
                total_descuento = 0,
                pago_total = :pago_total,
                observaciones = :observaciones
            WHERE id_compra = :id_compra
        ");

        $stmtCompra->execute([
            ":id_compra" => $idCompra,
            ":id_proveedor" => $idProveedor,
            ":referencia" => $referencia,
            ":fecha_compra" => $fechaCompra,
            ":estado" => $estadoNuevo,
            ":subtotal" => $total,
            ":pago_total" => $total,
            ":observaciones" => $observaciones
        ]);

        insertar_detalles_compra($pdo, $idCompra, $itemsPreparados);

        if (compra_afecta_inventario($estadoNuevo)) {
            sumar_stock_compra($pdo, $idCompra);
            $movimientos[] = "stock_nuevo_sumado";
        }

        if (count($movimientos) === 0) {
            $movimientos[] = "sin_cambio";
        }

        $pdo->commit();

        responder([
            "ok" => true,
            "mensaje" => "Compra actualizada correctamente.",
            "estado_anterior" => $estadoAnterior,
            "estado" => $estadoNuevo,
            "movimiento_stock" => implode(",", $movimientos),
            "cuenta_como_compra" => compra_afecta_inventario($estadoNuevo)
        ]);

    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        responder([
            "ok" => false,
            "mensaje" => "Error al actualizar compra: " . $e->getMessage()
        ], 500);
    }
}

if ($metodo === "DELETE") {
    try {
        $idCompra = (int) ($_GET["id"] ?? 0);

        if (!$idCompra) {
            responder([
                "ok" => false,
                "mensaje" => "No se recibió el ID de la compra."
            ], 400);
        }

        $pdo->beginTransaction();

        $compraActual = obtener_compra_bloqueada($pdo, $idCompra);

        if (!$compraActual) {
            throw new Exception("Compra no encontrada.");
        }

        $estadoAnterior = normalizar_estado($compraActual["estado"]);
        $movimientoStock = "sin_cambio";

        if (compra_afecta_inventario($estadoAnterior)) {
            restar_stock_compra($pdo, $idCompra);
            $movimientoStock = "stock_revertido";
        }

        $stmtDetalles = $pdo->prepare("
            DELETE FROM DetalleCompra
            WHERE id_compra = :id_compra
        ");

        $stmtDetalles->execute([
            ":id_compra" => $idCompra
        ]);

        $stmtCompra = $pdo->prepare("
            DELETE FROM Compras
            WHERE id_compra = :id_compra
        ");

        $stmtCompra->execute([
            ":id_compra" => $idCompra
        ]);

        $pdo->commit();

        responder([
            "ok" => true,
            "mensaje" => "Compra eliminada correctamente.",
            "estado_anterior" => $estadoAnterior,
            "movimiento_stock" => $movimientoStock
        ]);

    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        responder([
            "ok" => false,
            "mensaje" => "Error al eliminar compra: " . $e->getMessage()
        ], 500);
    }
}

responder([
    "ok" => false,
    "mensaje" => "Método no permitido."
], 405);
